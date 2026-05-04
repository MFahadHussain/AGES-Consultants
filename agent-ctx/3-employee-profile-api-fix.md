# Task 3 - Fix Employee Profile Component to Use Real API Data

## Agent: Main Agent
## Status: COMPLETED

## Summary of Changes

Replaced the Employee Profile component (`/src/components/modules/employee-profile.tsx`) to use real API data instead of hardcoded demo data. The file was fully rewritten (~1100 lines).

### What was removed:
1. **`EMPLOYEES` hardcoded array** (5 demo employees) → Replaced with `fetch('/api/employees?pageSize=200')` on mount
2. **`ATT_MAY_2026` hardcoded attendance** (~60 lines of per-day data) → Replaced with `fetch('/api/attendance?view=monthly&employeeId=...&month=...')` on employee select/month change
3. **`MONTHLY_ATT` hardcoded summaries** → Replaced with API-driven stats from attendance response
4. **`WD_PER_MONTH` hardcoded mapping** → No longer needed, derived from API data
5. **`DEFAULT_DOCS` hardcoded array** → Now generated dynamically from employee data
6. **`MONTHS` hardcoded list** → Replaced with `getRecentMonths()` utility that generates last 12 months
7. **`computeLocalSC()` function** → Removed entirely, replaced by payroll API results
8. **`buildSalaryHistory()` function** → Removed, replaced with data from `/api/payroll` batch lines
9. **`buildScLedger()` function** → Removed, SC ledger is now built from payroll batch data
10. **`buildLoans()` function** → Removed, replaced with `fetch('/api/loans?employeeId=...')`
11. **`buildAdvances()` function** → Removed, advances now derived from loans API (loanType "Advance Salary")

### What was added:
1. **Employee fetch on mount** via `/api/employees?pageSize=200` with proper field mapping from API schema to `EmployeeData` interface
2. **Attendance API integration** - Fetches monthly attendance with calendar view when employee/month changes, converts API calendar entries to the existing `AttEntry` format
3. **Updated `EmployeeData` interface** - Added `eobiEnabled`, `pfEnabled`, `incomeTaxEnabled`, `employeeCode`, `baseSalary`, `cnic` fields; made many fields nullable (`| null`)
4. **Salary history from payroll batches** - Fetches `/api/payroll` to get batch lines for the selected employee and maps them to `SalaryRow[]`
5. **EOBI/PF/Income Tax status badges** - Added "Statutory Status" section in the profile card showing green ✓ or gray ✗ for each
6. **Loans from API** - Fetches from `/api/loans?employeeId=...`, maps Loan records with installments to `LoanData[]`
7. **Advances from API** - Derived from loans API where `loanType === 'Advance Salary'`, mapped to `AdvanceData[]`
8. **SC ledger from payroll data** - Built from salary history rows instead of hardcoded data
9. **Loading states** - Added `employeesLoading`, `attLoading`, `loansLoading`, `salaryHistoryLoading` states with spinner UI
10. **Empty states** - "No employees found", "No attendance data", "No salary history", "No loans", "No SC ledger" messages
11. **Profile edit via API** - `saveEdit()` now calls `PUT /api/employees?id=...` instead of just updating local state
12. **Payroll calculation improvements** - Shows gross salary, income tax, loan deduction, net pay in the calculation results section
13. **Attendance for any month** - Previously only May 2026 worked; now attendance can be viewed for any month with API data

### API Mapping Details:
- Employee API fields mapped: `joiningDate→joinDate`, `contactNo→phone`, `presentAddress→location`, `employmentType→contractType`, `baseSalary→monthlySalary`, `bankName+bankAccountNumber→bank`
- Employee status normalized: `active→Active` (capitalized first letter)
- Attendance API: `calendar[].record.status` + `calendar[].dailyProject.project.code` mapped to `AttEntry`
- Loans API: `loanNumber→id`, `principalAmount→principal`, `balanceAmount→remaining`, `monthlyDeduction→emi`, `installments[].paidAmount→recovered`
- Advances: Filtered from loans where `loanType === 'Advance Salary'`

### Lint Results:
- 0 errors, 4 pre-existing warnings (unrelated to this change)
- Dev server returns 200 OK
