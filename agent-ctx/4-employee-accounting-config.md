# Task 4 - Employee Accounting Config

## Summary
Added "Accounting" tab to Employee Master form with 5 searchable account dropdown selectors for salary voucher generation configuration.

## Changes Made

### Frontend (`src/components/modules/employee-master.tsx`)
- Added 5 accounting fields to emptyForm state
- Added `accounts` state + `fetchAccounts` function (fetches from `/api/accounts?isActive=true`, filters `allowPosting=true`)
- Added `BookOpen` icon and `AccountCombobox` component imports
- Created `renderAccountingTab()` with:
  - 2 Debit accounts (EXPENSE type): Salary Expense, SC Expense
  - 3 Credit accounts (LIABILITY type): Salary Payable, SC Payable, Tax Payable
  - Warning/success indicators
  - Each field uses AccountCombobox with type-filtered accounts
- Added Accounting tab to Create, Edit, and View dialogs
- Warning badge (AlertTriangle) on Accounting tab when accounts unconfigured
- Updated tab navigation arrays to include 'accounting'

### Backend (`src/app/api/employees/route.ts`)
- GET: Added includes for 5 account relations (salaryExpenseAccount, scExpenseAccount, salaryPayableAccount, scPayableAccount, taxPayableAccount)
- POST: Added 5 account ID fields to createData
- PUT: Added 5 account ID fields to updateData with null handling
- All responses include account relation data

## Lint Result
0 errors, 4 pre-existing warnings (unrelated to changes)
