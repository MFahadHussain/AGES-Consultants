# Task 2: Payroll API Enhancement — Work Record

## Task Summary
Add two new actions to `/src/app/api/payroll/route.ts`:
1. `post-to-gl-project-wise` — Creates one Journal Voucher per project for an approved batch
2. `create-sc-gl-draft` — Creates a draft GL voucher specifically for Social Charges of a batch

## Implementation Details

### post-to-gl-project-wise
- **Input**: `{ action: 'post-to-gl-project-wise', batchId, financialYearId }`
- **Validation**: batch must exist, be approved, not already posted to GL
- **Line grouping**: Resolves projectId per line using `line.projectId || employee.defaultProjectId || null`, then groups lines by resolved projectId
- **Per-project voucher**: Creates separate JV for each project with project-specific totals
  - Voucher number: `JV-PAY-{YYYYMM}-{PROJCODE}` (e.g., `JV-PAY-202501-AJK-HPP-001`)
  - DR entries: Salary Expense, Allowance Expense, EOBI Expense Employer, PF Expense Employer, Gratuity Expense, SC Expense
  - CR entries: Salaries Payable, Income Tax Payable, EOBI Payable Employee, PF Payable Employee, SC Payable, Loan Deduction Payable, Advance Recovery Payable
  - Balance validation: totalDR must equal totalCR (tolerance 0.01)
  - Sets `voucher.projectId` to the project's id
- **Post-batch**: Marks batch as posted with first voucher's ID in `postedVoucherId`
- **Audit**: Logs cross-charging when line.projectId differs from voucher's projectId

### create-sc-gl-draft
- **Input**: `{ action: 'create-sc-gl-draft', batchId, financialYearId }`
- **Validation**: batch must exist, be approved
- **Logic**: Sums all socialCharges from lines, creates single JV
  - Voucher number: `JV-SC-{YYYYMM}-{NNN}` (e.g., `JV-SC-202501-001`)
  - DR: Social Charges Expense (total SC amount)
  - CR: Social Charges Payable (total SC amount)
  - Narration: "Social Charges GL Draft for batch {batchNumber}"
- **Does NOT** mark batch as posted (it's just a draft)

## Key Design Decisions
- Uses same PayrollAccountMapping + findAccountByRole fallback pattern as existing `post-to-gl`
- All amounts use `Math.round(amount * 100) / 100` for 2-decimal precision
- Project code from `Project.code` field used in voucher number
- Lines with no project grouped under `NOPROJ` code
- Employee defaultProjectId loaded in bulk query (not N+1)

## Files Modified
- `/src/app/api/payroll/route.ts` — Added ~400 lines (actions 10 and 11)

## Verification
- `bun run lint` passes with 0 errors
- API endpoint `/api/payroll` returns 200
