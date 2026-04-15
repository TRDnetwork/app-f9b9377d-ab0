let channels = [];

export function setupRealtime(supabase, onChange) {
  teardownRealtime();

  const expensesChannel = supabase
    .channel('app_a401_expenses_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_a401_expenses' }, (payload) => {
      onChange({ ...payload, table: 'app_a401_expenses' });
    })
    .subscribe();

  const categoriesChannel = supabase
    .channel('app_a401_categories_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_a401_categories' }, (payload) => {
      onChange({ ...payload, table: 'app_a401_categories' });
    })
    .subscribe();

  channels.push(expensesChannel, categoriesChannel);
}

export function teardownRealtime() {
  channels.forEach(ch => {
    ch.unsubscribe();
  });
  channels = [];
}