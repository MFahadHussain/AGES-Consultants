# Task 2: Fix calculateMonthlyPayroll.ts and payroll API route

## Summary of Changes

### 1. `/src/lib/payroll/calculateMonthlyPayroll.ts`

**EOBI section (lines ~463-467)** — Changed from always calculating EOBI to only calculating when `employee.eobiEnabled === true`:
- If `employee.eobiEnabled === true`: calculates `eobiEmployee` and `eobiEmployer` as before
- Otherwise: both set to `0`

**PF section (lines ~469-471)** — Changed from always calculating Provident Fund to only calculating when `employee.pfEnabled === true`:
- If `employee.pfEnabled === true`: calculates `pfEmployee` and `pfEmployer` as before
- Otherwise: both set to `0`

**Income Tax section (line ~488)** — Added check `employee.incomeTaxEnabled !== false` to the existing condition:
- Before: `if (taxSlabs.length > 0 && grossSalary > 0)`
- After: `if (taxSlabs.length > 0 && grossSalary > 0 && employee.incomeTaxEnabled !== false)`
- Since default is `true`, this only skips tax when explicitly set to `false`

### 2. `/src/app/api/payroll/route.ts`

**`recalcBatchTotals` function** — Updated to filter lines by `lineStatus = 'approved'` when batch status is `'approved'` or `'posted'`:
- Fetches the batch first to check status
- If status is approved/posted, only includes lines with `lineStatus: 'approved'` in totals
- For draft/reviewed batches, includes all lines (existing behavior)

**New `approve-line` action** — Approve individual line(s):
- Accepts `{ action: 'approve-line', lineId: string }` or `{ action: 'approve-line', lineIds: string[] }`
- Validates that lines exist and their parent batch has status 'reviewed' or 'approved'
- Updates `lineStatus` to 'approved' for specified lines
- Recalculates batch totals for affected batches

**New `approve-all-lines` action** — Approve all lines in a batch:
- Accepts `{ action: 'approve-all-lines', batchId: string }`
- Validates batch status is 'reviewed' or 'approved'
- Sets `lineStatus = 'approved'` for ALL lines in the batch
- Recalculates batch totals

**New `draft-to-gl` action** — Post only approved lines to GL as a draft voucher:
- Accepts `{ action: 'draft-to-gl', batchId: string, financialYearId: string, lineIds?: string[] }`
- If `lineIds` provided, only posts those lines (must also have `lineStatus: 'approved'`)
- Otherwise posts ALL lines with `lineStatus: 'approved'`
- Returns error if no approved lines exist
- Calculates totals from approved lines only
- Creates a voucher with status `'draft'` (not posted)
- Sets batch's `postedToGL = true` and `status = 'posted'`
- Same GL entry logic as `post-to-gl` but filtered to approved lines
- Creates audit log entries for cross-charged lines

**Updated `run-payroll` action** — Sets `lineStatus: 'draft'` for all new lines created

**Updated `post-to-gl` action** — Added check that all lines have `lineStatus = 'approved'` before posting:
- Returns error with count of unapproved lines and their current status

### 3. `/src/app/api/seed-payroll-reset/route.ts`

**ASSAD_DATA constant** — Changed `eobiEnabled: false` to `eobiEnabled: true` and added `incomeTaxEnabled: true`

**Employee creation** — Added `incomeTaxEnabled: ASSAD_DATA.incomeTaxEnabled` to the employee create data

## Lint Result
- 0 errors, 4 warnings (all pre-existing, unrelated to changes)
