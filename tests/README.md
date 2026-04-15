# Expense Tracker Test Suite

This directory contains comprehensive tests for the Expense Tracker SaaS application (app_a401).

## Test Files

### `app.test.js`
Frontend unit tests covering:
- Authentication UI rendering (login/signup forms)
- Dashboard display with monthly spending charts
- Expense table rendering and filtering
- CSV export generation with proper escaping
- Modal forms for add/edit expense
- Empty state handling
- Category grouping and calculation logic
- Month filtering for current period

Uses Vitest with JSDOM to simulate browser environment and mocks Supabase client.

### `api.test.js`
Backend API integration tests covering:
- User authentication (signIn, signUp, signOut)
- Expense CRUD operations (create, read, update, delete)
- Category fetching with ordering
- RLS policy enforcement via user_id scoping
- Realtime subscription setup
- Error handling for auth and database failures
- Query structure validation

All Supabase calls are mocked to test logic without live database.

## Running Tests

### Install Dependencies
```bash
npm install vitest jsdom @supabase/supabase-js --save-dev
```

### Run All Tests
```bash
npm test
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Run Specific Test File
```bash
npm test tests/app.test.js
```

### Watch Mode (auto-rerun on changes)
```bash
npm test -- --watch
```

## Test Coverage

**Frontend Tests (app.test.js):**
- ✅ Auth form rendering and validation
- ✅ Dashboard chart visualization
- ✅ Monthly spending calculations
- ✅ Category grouping and sorting
- ✅ CSV export with special character escaping
- ✅ Modal form rendering
- ✅ Empty state display
- ✅ Date filtering logic

**API Tests (api.test.js):**
- ✅ Authentication flows
- ✅ Expense table queries with RLS
- ✅ Insert/update/delete operations
- ✅ Category queries
- ✅ Error handling
- ✅ Realtime subscriptions
- ✅ RLS enforcement validation

## Notes

- All tests use mocked Supabase client to avoid live database calls
- JSDOM simulates browser DOM for frontend tests
- Tests validate logic, not styling or visual design
- RLS tests verify query structure (actual enforcement happens in Supabase)
- Realtime tests confirm subscription setup (live updates tested manually)

## Future Enhancements

- Add E2E tests with Playwright for full user flows
- Add performance benchmarks for large expense datasets
- Test CSV export with various edge cases (unicode, large files)
- Add accessibility tests for keyboard navigation and screen readers