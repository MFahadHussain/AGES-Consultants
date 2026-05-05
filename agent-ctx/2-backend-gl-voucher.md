# Task 2 - backend-gl-voucher Agent Work Record

## Task
Build a new API endpoint for GL voucher generation with project-wise splitting

## File Created
- `/home/z/my-project/src/app/api/payroll/generate-gl-voucher/route.ts`

## Implementation Details

### POST /api/payroll/generate-gl-voucher

Three modes supported:

1. **Consolidated** (`mode: "consolidated"`): Single JV for all employees/projects
   - Voucher number: `JV-PAY-{YYYYMM}-001`
   - Uses `buildGlEntries` pattern from existing payroll route
   - PayrollAccountMapping + account role fallbacks for GL account lookups

2. **Project-wise** (`mode: "project-wise"`): Separate JV per project
   - Voucher number: `JV-PAY-{YYYYMM}-{PROJECT_CODE}`
   - Parses `projectAllocations` and `contractEarnings` JSON from batch lines
   - Splits amounts proportionally using allocation ratio
   - Includes `employeeLines` breakdown showing per-employee contribution
   - Uses `buildProjectGlEntries` with structured DR/CR pattern
   - Each entry has `projectId` at line level

3. **SC-only** (`mode: "sc-only"`): Social Charges only voucher
   - Voucher number: `JV-SC-{YYYYMM}-{empCode}`
   - Simple 2-line: DR Social Charges Expense, CR Social Charges Payable

### Key Design Decisions
- Reused `findAccountByRole` and `findFirstBankAccount` from `@/lib/account-roles`
- Replicated `buildGlEntries` logic locally (can't import from route.ts private function)
- Created separate `buildProjectGlEntries` for project-wise mode with DR/CR pattern per task spec
- All amounts `Math.round()` to avoid floating point issues
- Proper error handling with HTTP status codes

### Validation
- Lint: 0 errors (4 pre-existing warnings, none from new file)
- Dev server: HTTP 200
- No existing files modified
