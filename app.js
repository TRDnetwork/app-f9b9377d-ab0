import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { setupRealtime, teardownRealtime } from './realtime.js';

let supabase;
let currentUser = null;
let currentView = 'dashboard';
let expenses = [];
let categories = [];
let editingExpense = null;

async function init() {
  const loadingEl = document.getElementById('loading');
  const appEl = document.getElementById('app');

  try {
    // Check for injected credentials
    if (!window.__SUPABASE_URL__ || !window.__SUPABASE_ANON_KEY__) {
      appEl.innerHTML = '<div class="error-banner" style="margin: 24px;">Supabase credentials not injected. Cannot initialize app.</div>';
      return;
    }

    supabase = createClient(window.__SUPABASE_URL__, window.__SUPABASE_ANON_KEY__);

    // Try to get session (may throw SecurityError in sandboxed iframe)
    let session = null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error) session = data.session;
    } catch (e) {
      console.warn('getSession SecurityError (sandboxed iframe):', e);
    }

    if (session) {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error && data.user) {
          currentUser = data.user;
          await loadData();
          setupRealtime(supabase, handleRealtimeChange);
        }
      } catch (e) {
        console.warn('getUser error:', e);
      }
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        try {
          const { data, error } = await supabase.auth.getUser();
          if (!error && data.user) {
            currentUser = data.user;
            await loadData();
            setupRealtime(supabase, handleRealtimeChange);
            render();
          }
        } catch (e) {
          console.warn('Auth state change getUser error:', e);
        }
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        expenses = [];
        categories = [];
        teardownRealtime();
        render();
      }
    });

    render();
  } catch (err) {
    console.error('Init error:', err);
    appEl.innerHTML = `<div class="error-banner" style="margin: 24px;">Initialization error: ${err.message}</div>`;
  } finally {
    loadingEl.classList.add('hidden');
    appEl.classList.add('loaded');
  }
}

async function loadData() {
  try {
    const [expensesRes, categoriesRes] = await Promise.all([
      supabase.from('app_a401_expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('app_a401_categories').select('*').order('name')
    ]);

    if (expensesRes.error) throw expensesRes.error;
    if (categoriesRes.error) throw categoriesRes.error;

    expenses = expensesRes.data || [];
    categories = categoriesRes.data || [];
  } catch (err) {
    showToast(`Failed to load data: ${err.message}`, 'error');
  }
}

function handleRealtimeChange(payload) {
  const { eventType, new: newRecord, old: oldRecord, table } = payload;

  if (table === 'app_a401_expenses') {
    if (eventType === 'INSERT') {
      expenses.unshift(newRecord);
    } else if (eventType === 'UPDATE') {
      const idx = expenses.findIndex(e => e.id === newRecord.id);
      if (idx !== -1) expenses[idx] = newRecord;
    } else if (eventType === 'DELETE') {
      expenses = expenses.filter(e => e.id !== oldRecord.id);
    }
  } else if (table === 'app_a401_categories') {
    if (eventType === 'INSERT') {
      categories.push(newRecord);
      categories.sort((a, b) => a.name.localeCompare(b.name));
    } else if (eventType === 'UPDATE') {
      const idx = categories.findIndex(c => c.id === newRecord.id);
      if (idx !== -1) categories[idx] = newRecord;
    } else if (eventType === 'DELETE') {
      categories = categories.filter(c => c.id !== oldRecord.id);
    }
  }

  render();
}

function render() {
  const appEl = document.getElementById('app');
  if (!currentUser) {
    appEl.innerHTML = renderAuth();
    attachAuthListeners();
  } else {
    appEl.innerHTML = renderMain();
    attachMainListeners();
  }
}

function renderAuth() {
  return `
    <div class="auth-container">
      <div class="auth-card">
        <h1>Expense Tracker</h1>
        <p>Track your spending, manage your budget.</p>
        <div id="auth-error"></div>
        <form id="auth-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="auth-email" required autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" class="form-input" id="auth-password" required autocomplete="current-password" minlength="6">
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" id="btn-signup">Sign Up</button>
            <button type="submit" class="btn-primary" id="btn-signin">Sign In</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function attachAuthListeners() {
  const form = document.getElementById('auth-form');
  const signupBtn = document.getElementById('btn-signup');
  const errorEl = document.getElementById('auth-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    errorEl.innerHTML = '';

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      errorEl.innerHTML = `<div class="error-banner">${err.message}</div>`;
    }
  });

  signupBtn.addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    errorEl.innerHTML = '';

    if (!email || password.length < 6) {
      errorEl.innerHTML = '<div class="error-banner">Email required and password must be at least 6 characters.</div>';
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      errorEl.innerHTML = '<div class="error-banner" style="background: #D1FAE5; border-color: #86EFAC; color: #065F46;">Account created! Check your email to confirm, then sign in.</div>';
    } catch (err) {
      errorEl.innerHTML = `<div class="error-banner">${err.message}</div>`;
    }
  });
}

function renderMain() {
  return `
    <div class="main-layout">
      ${renderSidebar()}
      <div class="main-content">
        ${currentView === 'dashboard' ? renderDashboard() : renderAllExpenses()}
      </div>
    </div>
    <div id="modal-root"></div>
    <div id="toast-root"></div>
  `;
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="sidebar-brand">Expense Tracker</div>
      <ul class="sidebar-nav">
        <li><button class="${currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">Dashboard</button></li>
        <li><button class="${currentView === 'expenses' ? 'active' : ''}" data-view="expenses">All Expenses</button></li>
      </ul>
      <div class="sidebar-footer">
        <button class="btn-signout" id="btn-signout">Sign Out</button>
      </div>
    </aside>
  `;
}

function renderDashboard() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthExpenses = expenses.filter(e => {
    const d = new Date(e.expense_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalSpent = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const categoryTotals = {};
  monthExpenses.forEach(e => {
    const catId = e.category_id || 'uncategorized';
    categoryTotals[catId] = (categoryTotals[catId] || 0) + parseFloat(e.amount);
  });

  const categoryData = Object.entries(categoryTotals)
    .map(([catId, amount]) => {
      const cat = categories.find(c => c.id === catId);
      return {
        name: cat ? cat.name : 'Uncategorized',
        color: cat ? cat.color : '#6b7280',
        amount
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const maxAmount = categoryData.length ? Math.max(...categoryData.map(c => c.amount)) : 1;

  return `
    <div class="header">
      <h1>Dashboard</h1>
      <button class="btn-primary" id="btn-add-expense">+ Add Expense</button>
    </div>
    <div class="dashboard-grid">
      <div class="card">
        <h2>Spending by Category</h2>
        ${categoryData.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">📊</div><p>No expenses this month yet.</p></div>' : `
          <div class="chart-container">
            <div class="chart-bars">
              ${categoryData.map(cat => `
                <div class="chart-bar">
                  <div class="chart-bar-label">
                    <span>${cat.name}</span>
                    <span class="chart-bar-amount">$${cat.amount.toFixed(2)}</span>
                  </div>
                  <div class="chart-bar-fill">
                    <div class="chart-bar-progress" style="width: ${(cat.amount / maxAmount) * 100}%; background: ${cat.color};"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `}
      </div>
      <div class="card total-card">
        <div class="total-label">Total Spent This Month</div>
        <div class="total-amount">$${totalSpent.toFixed(2)}</div>
        <div class="month-selector">
          <button>${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</button>
        </div>
      </div>
    </div>
    <div class="card">
      <h2>Recent Expenses</h2>
      ${renderExpensesTable(expenses.slice(0, 10))}
    </div>
  `;
}

function renderAllExpenses() {
  return `
    <div class="header">
      <h1>All Expenses</h1>
      <div style="display: flex; gap: 12px;">
        <button class="btn-secondary" id="btn-export-csv">Export CSV</button>
        <button class="btn-primary" id="btn-add-expense">+ Add Expense</button>
      </div>
    </div>
    <div class="card">
      ${renderExpensesTable(expenses)}
    </div>
  `;
}

function renderExpensesTable(expensesList) {
  if (expensesList.length === 0) {
    return '<div class="empty-state"><div class="empty-state-icon">💸</div><p>No expenses yet. Add your first one!</p></div>';
  }

  return `
    <div class="expenses-table-container">
      <table class="expenses-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${expensesList.map(e => {
            const cat = categories.find(c => c.id === e.category_id);
            return `
              <tr>
                <td class="expense-date">${new Date(e.expense_date).toLocaleDateString()}</td>
                <td>${e.description || '—'}</td>
                <td>
                  ${cat ? `
                    <span class="expense-category">
                      <span class="category-dot" style="background: ${cat.color};"></span>
                      ${cat.name}
                    </span>
                  ` : '<span class="expense-category">Uncategorized</span>'}
                </td>
                <td class="expense-amount">$${parseFloat(e.amount).toFixed(2)}</td>
                <td class="expense-actions">
                  <button class="btn-icon" data-action="edit" data-id="${e.id}">Edit</button>
                  <button class="btn-icon danger" data-action="delete" data-id="${e.id}">Delete</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function attachMainListeners() {
  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentView = e.target.dataset.view;
      render();
    });
  });

  document.getElementById('btn-add-expense')?.addEventListener('click', () => {
    editingExpense = null;
    showExpenseModal();
  });

  document.getElementById('btn-export-csv')?.addEventListener('click', exportCSV);

  document.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      editingExpense = expenses.find(ex => ex.id === id);
      showExpenseModal();
    });
  });

  document.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      if (!confirm('Delete this expense?')) return;
      try {
        const { error } = await supabase.from('app_a401_expenses').delete().eq('id', id);
        if (error) throw error;
        showToast('Expense deleted', 'success');
      } catch (err) {
        showToast(`Delete failed: ${err.message}`, 'error');
      }
    });
  });
}

function showExpenseModal() {
  const modalRoot = document.getElementById('modal-root');
  const isEdit = !!editingExpense;

  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <h2>${isEdit ? 'Edit Expense' : 'Add Expense'}</h2>
        <form id="expense-form">
          <div class="form-group">
            <label class="form-label">Amount</label>
            <input type="number" step="0.01" min="0" class="form-input" id="expense-amount" value="${isEdit ? editingExpense.amount : ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-select" id="expense-category" required>
              <option value="">Select category</option>
              ${categories.map(c => `<option value="${c.id}" ${isEdit && editingExpense.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-input" id="expense-date" value="${isEdit ? editingExpense.expense_date : new Date().toISOString().split('T')[0]}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="expense-description">${isEdit ? (editingExpense.description || '') : ''}</textarea>
          </div>
          <div id="form-error"></div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('modal-cancel').addEventListener('click', () => {
    modalRoot.innerHTML = '';
  });

  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') modalRoot.innerHTML = '';
  });

  document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formError = document.getElementById('form-error');
    formError.innerHTML = '';

    const amount = document.getElementById('expense-amount').value;
    const category_id = document.getElementById('expense-category').value;
    const expense_date = document.getElementById('expense-date').value;
    const description = document.getElementById('expense-description').value.trim();

    if (!amount || !category_id || !expense_date) {
      formError.innerHTML = '<div class="error-inline">All required fields must be filled.</div>';
      return;
    }

    try {
      const payload = {
        user_id: currentUser.id,
        amount: parseFloat(amount),
        category_id,
        expense_date,
        description: description || null
      };

      if (isEdit) {
        const { error } = await supabase.from('app_a401_expenses').update(payload).eq('id', editingExpense.id);
        if (error) throw error;
        showToast('Expense updated', 'success');
      } else {
        const { error } = await supabase.from('app_a401_expenses').insert(payload);
        if (error) throw error;
        showToast('Expense added', 'success');
      }

      modalRoot.innerHTML = '';
    } catch (err) {
      formError.innerHTML = `<div class="error-inline">${err.message}</div>`;
    }
  });
}

function exportCSV() {
  if (expenses.length === 0) {
    showToast('No expenses to export', 'error');
    return;
  }

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

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('CSV exported', 'success');
}

function showToast(message, type = 'success') {
  const toastRoot = document.getElementById('toast-root');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastRoot.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

init();