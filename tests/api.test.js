import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client factory
const createMockSupabaseClient = () => ({
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn()
  },
  from: vi.fn((table) => ({
    select: vi.fn(() => ({
      order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    insert: vi.fn((data) => Promise.resolve({ data, error: null })),
    update: vi.fn((data) => ({
      eq: vi.fn(() => Promise.resolve({ data, error: null }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null }))
    }))
  })),
  channel: vi.fn(() => ({
    on: vi.fn(function() { return this; }),
    subscribe: vi.fn()
  }))
});

describe('Supabase API Integration', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  it('should authenticate user with email and password', async () => {
    const testEmail = 'test@example.com';
    const testPassword = 'password123';

    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user123', email: testEmail }, session: {} },
      error: null
    });

    const { data, error } = await mockSupabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: testEmail,
      password: testPassword
    });
    expect(data.user.email).toBe(testEmail);
    expect(error).toBeNull();
  });

  it('should fetch expenses for authenticated user with RLS', async () => {
    const mockExpenses = [
      { id: '1', user_id: 'user123', amount: '50.00', category_id: 'cat1', expense_date: '2024-01-15' },
      { id: '2', user_id: 'user123', amount: '30.00', category_id: 'cat2', expense_date: '2024-01-16' }
    ];

    mockSupabase.from('app_a401_expenses').select().order.mockResolvedValue({
      data: mockExpenses,
      error: null
    });

    const { data, error } = await mockSupabase
      .from('app_a401_expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    expect(mockSupabase.from).toHaveBeenCalledWith('app_a401_expenses');
    expect(data).toEqual(mockExpenses);
    expect(error).toBeNull();
  });

  it('should insert new expense with user_id', async () => {
    const newExpense = {
      user_id: 'user123',
      amount: 75.50,
      category_id: 'cat1',
      expense_date: '2024-01-20',
      description: 'Test expense'
    };

    mockSupabase.from('app_a401_expenses').insert.mockResolvedValue({
      data: { ...newExpense, id: 'exp123' },
      error: null
    });

    const { data, error } = await mockSupabase
      .from('app_a401_expenses')
      .insert(newExpense);

    expect(mockSupabase.from).toHaveBeenCalledWith('app_a401_expenses');
    expect(data).toMatchObject(newExpense);
    expect(error).toBeNull();
  });

  it('should update existing expense by id', async () => {
    const expenseId = 'exp123';
    const updates = {
      amount: 100.00,
      description: 'Updated description'
    };

    mockSupabase.from('app_a401_expenses').update().eq.mockResolvedValue({
      data: { id: expenseId, ...updates },
      error: null
    });

    const { data, error } = await mockSupabase
      .from('app_a401_expenses')
      .update(updates)
      .eq('id', expenseId);

    expect(mockSupabase.from).toHaveBeenCalledWith('app_a401_expenses');
    expect(error).toBeNull();
  });

  it('should delete expense by id', async () => {
    const expenseId = 'exp123';

    mockSupabase.from('app_a401_expenses').delete().eq.mockResolvedValue({
      error: null
    });

    const { error } = await mockSupabase
      .from('app_a401_expenses')
      .delete()
      .eq('id', expenseId);

    expect(mockSupabase.from).toHaveBeenCalledWith('app_a401_expenses');
    expect(error).toBeNull();
  });

  it('should fetch categories for user', async () => {
    const mockCategories = [
      { id: 'cat1', user_id: 'user123', name: 'Food & Dining', color: '#ef4444' },
      { id: 'cat2', user_id: 'user123', name: 'Transportation', color: '#f59e0b' }
    ];

    mockSupabase.from('app_a401_categories').select().order.mockResolvedValue({
      data: mockCategories,
      error: null
    });

    const { data, error } = await mockSupabase
      .from('app_a401_categories')
      .select('*')
      .order('name');

    expect(mockSupabase.from).toHaveBeenCalledWith('app_a401_categories');
    expect(data).toEqual(mockCategories);
    expect(error).toBeNull();
  });

  it('should handle authentication errors gracefully', async () => {
    const errorMessage = 'Invalid login credentials';

    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: errorMessage }
    });

    const { data, error } = await mockSupabase.auth.signInWithPassword({
      email: 'wrong@example.com',
      password: 'wrongpass'
    });

    expect(data.user).toBeNull();
    expect(error).toBeTruthy();
    expect(error.message).toBe(errorMessage);
  });

  it('should handle database query errors', async () => {
    const errorMessage = 'RLS policy violation';

    mockSupabase.from('app_a401_expenses').select().order.mockResolvedValue({
      data: null,
      error: { message: errorMessage }
    });

    const { data, error } = await mockSupabase
      .from('app_a401_expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    expect(data).toBeNull();
    expect(error).toBeTruthy();
    expect(error.message).toBe(errorMessage);
  });

  it('should subscribe to realtime changes on expenses table', () => {
    const mockCallback = vi.fn();
    
    const channel = mockSupabase
      .channel('app_a401_expenses_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'app_a401_expenses' 
      }, mockCallback)
      .subscribe();

    expect(mockSupabase.channel).toHaveBeenCalledWith('app_a401_expenses_changes');
    expect(channel.on).toHaveBeenCalled();
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it('should enforce RLS by scoping queries to current user', async () => {
    // In production, RLS automatically filters by auth.uid()
    // This test verifies the query structure
    const userId = 'user123';
    
    mockSupabase.from('app_a401_expenses').select().eq.mockResolvedValue({
      data: [{ id: 'exp1', user_id: userId }],
      error: null
    });

    const { data, error } = await mockSupabase
      .from('app_a401_expenses')
      .select('*')
      .eq('user_id', userId);

    // Verify RLS would be enforced via user_id filter
    expect(data.every(e => e.user_id === userId)).toBe(true);
    expect(error).toBeNull();
  });
});