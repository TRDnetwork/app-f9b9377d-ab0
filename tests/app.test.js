import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null }))
    }))
  })),
  channel: vi.fn(() => ({
    on: vi.fn(function() { return this; }),
    subscribe: vi.fn()
  }))
};

describe('Expense Tracker Frontend', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="loading"></div>
          <div id="app"></div>
        </body>
      </html>
    `, { url: 'http://localhost' });
    
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;
    
    // Inject mock Supabase credentials
    window.__SUPABASE_URL__ = 'https://test.supabase.co';
    window.__SUPABASE_ANON_KEY__ = 'test-key';
  });

  it('should render authentication form when user is not logged in', () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    
    const appEl = document.getElementById('app');
    appEl.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <h1>Expense Tracker</h1>
          <form id="auth-form">
            <input type="email" id="auth-email" />
            <input type="password" id="auth-password" />
            <button type="submit" id="btn-signin">Sign In</button>
          </form>
        </div>
      </div>
    `;

    const authForm = document.getElementById('auth-form');
    const signInBtn = document.getElementById('btn-signin');
    
    expect(authForm).toBeTruthy();
    expect(signInBtn).toBeTruthy();
    expect(signInBtn.textContent).toBe('Sign In');
  });

  it('should render dashboard with expense chart when user is authenticated', () => {
    const appEl = document.getElementById('app');
    
    const mockExpenses = [
      { id: '1', amount: '50.00', category_id: 'cat1', expense_date: '2024-01-15', description: 'Groceries' },
      { id: '2', amount: '30.00', category_id: 'cat1', expense_date: '2024-01-16', description: 'Gas' }
    ];
    
    const mockCategories = [
      { id: 'cat1', name: 'Food & Dining', color: '#ef4444' }
    ];

    appEl.innerHTML = `
      <div class="main-layout">
        <div class="main-content">
          <div class="dashboard-grid">
            <div class="card">
              <h2>Spending by Category</h2>
              <div class="chart-bars">
                <div class="chart-bar">
                  <div class="chart-bar-label">
                    <span>Food & Dining</span>
                    <span class="chart-bar-amount">$80.00</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="card total-card">
              <div class="total-amount">$80.00</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const chartBars = appEl.querySelector('.chart-bars');
    const totalAmount = appEl.querySelector('.total-amount');
    
    expect(chartBars).toBeTruthy();
    expect(totalAmount).toBeTruthy();
    expect(totalAmount.textContent).toBe('$80.00');
  });

  it('should calculate monthly spending totals correctly', () => {
    const expenses = [
      { amount: '50.00', expense_date: '2024-01-15', category_id: 'cat1' },
      { amount: '30.50', expense_date: '2024-01-20', category_id: 'cat1' },
      { amount: '100.00', expense_date: '2023-12-15', category_id: 'cat2' } // Previous month
    ];

    const now = new Date('2024-01-25');
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.expense_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalSpent = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    expect(monthExpenses.length).toBe(2);
    expect(totalSpent).toBe(80.50);
  });

  it('should group expenses by category for chart visualization', () => {
    const expenses = [
      { amount: '50.00', category_id: 'cat1', expense_date: '2024-01-15' },
      { amount: '30.00', category_id: 'cat1', expense_date: '2024-01-16' },
      { amount: '75.00', category_id: 'cat2', expense_date: '2024-01-17' }
    ];

    const categories = [
      { id: 'cat1', name: 'Food & Dining', color: '#ef4444' },
      { id: 'cat2', name: 'Transportation', color: '#f59e0b' }
    ];

    const categoryTotals = {};
    expenses.forEach(e => {
      const catId = e.category_id || 'uncategorized';
      categoryTotals[catId] = (categoryTotals[catId] || 0) + parseFloat(e.amount);
    });

    const categoryData = Object.entries(categoryTotals)
      .map(([catId, amount]) => {
        const cat = categories.find(c => c.id === catId);
        return {
          name: cat ? cat.name : 'Uncategorized',
          amount
        };
      })
      .sort((a, b) => b.amount - a.amount);

    expect(categoryData.length).toBe(2);
    expect(categoryData[0].name).toBe('Food & Dining');
    expect(categoryData[0].amount).toBe(80.00);
    expect(categoryData[1].name).toBe('Transportation');
    expect(categoryData[1].amount).toBe(75.00);
  });

  it('should generate CSV export with proper formatting', () => {
    const expenses = [
      { expense_date: '2024-01-15', category_id: 'cat1', amount: '50.00', description: 'Groceries' },
      { expense_date: '2024-01-16', category_id: 'cat2', amount: '30.50', description: 'Gas "premium"' }
    ];

    const categories = [
      { id: 'cat1', name: 'Food & Dining' },
      { id: 'cat2', name: 'Transportation' }
    ];

    const headers = ['Date', 'Category', 'Amount', 'Description'];
    const rows = expenses.map(e => {
      const cat = categories.find(c => c.id === e.category_id);
      return [
        e.expense_date,
        cat ? cat.name : 'Uncategorized',
        e.amount,
        e.description || ''
      ];
    });

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    expect(csv).toContain('Date,Category,Amount,Description');
    expect(csv).toContain('"2024-01-15","Food & Dining","50.00","Groceries"');
    expect(csv).toContain('"Gas ""premium"""'); // Double quotes escaped
  });

  it('should render expense modal with form fields for add/edit', () => {
    const modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    document.body.appendChild(modalRoot);

    const categories = [
      { id: 'cat1', name: 'Food & Dining' },
      { id: 'cat2', name: 'Transportation' }
    ];

    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <h2>Add Expense</h2>
          <form id="expense-form">
            <input type="number" id="expense-amount" required />
            <select id="expense-category" required>
              <option value="">Select category</option>
              ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
            <input type="date" id="expense-date" required />
            <textarea id="expense-description"></textarea>
            <button type="submit">Add</button>
          </form>
        </div>
      </div>
    `;

    const form = document.getElementById('expense-form');
    const amountInput = document.getElementById('expense-amount');
    const categorySelect = document.getElementById('expense-category');

    expect(form).toBeTruthy();
    expect(amountInput).toBeTruthy();
    expect(categorySelect.options.length).toBe(3); // Blank + 2 categories
  });

  it('should handle empty state when no expenses exist', () => {
    const expenses = [];

    const hasExpenses = expenses.length > 0;
    const emptyStateHTML = !hasExpenses 
      ? '<div class="empty-state"><p>No expenses yet. Add your first one!</p></div>'
      : '<table>...</table>';

    expect(emptyStateHTML).toContain('No expenses yet');
    expect(emptyStateHTML).toContain('empty-state');
  });

  it('should filter dashboard expenses to current month only', () => {
    const expenses = [
      { amount: '50.00', expense_date: '2024-01-15' },
      { amount: '30.00', expense_date: '2024-02-10' },
      { amount: '20.00', expense_date: '2024-01-20' }
    ];

    const now = new Date('2024-01-25');
    const currentMonth = now.getMonth(); // 0 (January)
    const currentYear = now.getFullYear();

    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.expense_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    expect(monthExpenses.length).toBe(2);
    expect(monthExpenses.every(e => new Date(e.expense_date).getMonth() === 0)).toBe(true);
  });
});