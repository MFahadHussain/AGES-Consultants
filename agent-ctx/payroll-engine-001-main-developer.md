# Task: Enhanced Payroll Engine for AcctFin ERP

## Agent: Main Developer
## Task ID: payroll-engine-001

### Summary
Rewrote the Payroll API and Payroll UI to create a comprehensive, production-ready Enhanced Payroll Engine for the AcctFin ERP system.

### Changes Made

#### 1. Payroll API (`/src/app/api/payroll/route.ts`)
Completely rewrote the API with the following actions:

- **Create Batch** (POST without action): Creates empty batch with period, name, projectId; auto-generates batch number
- **run-payroll** (CRITICAL): Full payroll calculation engine:
  - Loads active employees for period/project from EmployeeProjectAssignment
  - Loads attendance records (P, W, H, T, WH = eligible; CL, SL, EL, CO = leave; A, CD = absent)
  - Calculates allowances from EmployeeAllowance (customValue override or default)
  - Social Charges: 20% of salary × working ratio - leave deduction
  - EOBI: Employee 1%, Employer 5% (capped at minimum wage)
  - Provident Fund: Employee 8.33%, Employer 8.33%
  - Income Tax: Uses TaxSlab progressive calculation (annual taxable income × 12, slab-based)
  - Loan deduction from active disbursed loans
  - Net Pay = Gross - Total Deductions
  - Gratuity: 8.33% of basic
  - Creates PayrollBatchLine for each employee with full breakdowns (SC, tax, allowance JSON)
  - Updates PayrollBatch totals
- **add-line**: Manual employee line addition with all fields
- **update-line**: Update existing line with recalculation
- **delete-line**: Delete line with batch total recalculation
- **review**: draft → reviewed
- **approve**: reviewed → approved
- **send-back**: reviewed → draft
- **post-to-gl**: Creates balanced journal entries using PayrollAccountMapping (with fallback to account-roles):
  - Dr Salary Expense / Cr Salary Payable
  - Dr Allowance Expense / Cr Allowance Payable
  - Dr Social Charges Expense / Cr Social Charges Payable
  - Dr Salary Payable / Cr Income Tax Payable
  - Dr Salary Payable / Cr EOBI Payable
  - Dr Salary Payable / Cr PF Payable
  - Dr Salary Payable / Cr Bank (net pay)
  - Dr Employer EOBI / Cr EOBI Payable
  - Dr Employer PF / Cr PF Payable
  - Loan and Advance deduction entries

#### 2. Payroll UI (`/src/components/modules/payroll.tsx`)
Comprehensive UI with:

- **5 KPI Cards**: Total Gross, Total Deductions, Total Net Pay, Total Social Charges, Employer Charges
- **Workflow Status Bar**: Visual Draft → Reviewed → Approved → Posted progress indicator per batch
- **Expandable Batch Cards**: Show summary and employee lines table
- **Create Batch Dialog**: Name, Period, Project
- **Run Payroll Button**: Triggers run-payroll with loading state
- **Batch Detail View** (expanded):
  - 7 summary cards (Basic, Allowances, Gross, Deductions, Net Pay, SC, Employer Charges)
  - Full employee lines table: Employee, Code, Working/Eligible Days, Basic, Allowances, Gross, Tax, EOBI(E/R), PF(E/R), Loan, Net Pay, SC, Project
  - Click to expand line showing SC breakdown, tax breakdown, allowance details
  - Full Detail dialog with all breakdowns
  - Workflow action buttons based on status:
    - Draft: Run Payroll + Add Line + Submit for Review + Delete
    - Reviewed: Approve + Send Back
    - Approved: Post to GL
    - Posted: "Posted to GL" badge
- **Add/Edit Line Dialog**: Full form with employee selector, salary/attendance, deductions, employer charges
- **Post to GL Dialog**: Confirmation with journal entry preview table
- **Delete Confirmation Dialogs**: For both batch and line deletion

### Key Technical Decisions
- Used `PayrollAccountMapping` table for GL integration with fallback to `account-roles` utility
- Fragment keys used properly for expanded table rows
- Employee API response format handled correctly (`d.data` array)
- All currency calculations rounded to 2 decimal places
- Attendance default: if no records exist, assume full month present
- SC calculation ensures final value is never negative (Math.max(0, ...))
