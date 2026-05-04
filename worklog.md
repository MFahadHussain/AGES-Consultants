---
Task ID: 1
Agent: Main Agent
Task: Fix TypeError in employee-profile.tsx + Implement Multi-Contract Payroll Engine

Work Log:
- Fixed `startEdit` function bug where `setEditMode(true)` was outside the `if (emp)` block
- The existing null guard at line 1871 was already in place for the TypeError
- Rewrote `calculateMonthlyPayroll.ts` from v2.0 (multi-project allocation) to v3.0 (multi-contract)
- Key change: Each EmployeeProjectAssignment is a contract with its own salary
- Per-contract: Daily Rate = Contract Salary / Calendar Days; Earned = Daily Rate × Days Worked
- Combined: Total Monthly Income = Sum of all contract earned salaries
- Tax applied on COMBINED income using YTD + Rolling Projection (FBR Pakistan)
- Added `contractEarnings` JSON field to PayrollBatchLine Prisma schema
- Updated payroll API routes to store contractEarnings alongside projectAllocations
- Updated employee-profile.tsx types to include ContractEarningRow and contractEarnings in SalaryRow
- Updated payslip expanded view to show Multi-Contract Earnings table
- Updated renderProjectCostDistribution to show multi-contract breakdown with visual bar
- Updated payroll module dialog to show multi-contract earnings in line detail view

Stage Summary:
- Multi-contract payroll engine v3.0 completed
- Schema updated with `contractEarnings` field
- All lint checks pass (0 errors)
- Backend API stores both projectAllocations and contractEarnings JSON
- Frontend displays multi-contract breakdown in both employee profile and payroll module

---
Task ID: 2
Agent: Main Agent
Task: Interactive toggles, reports verification, print module multi-contract support

Work Log:
- Added interactive toggle buttons for EOBI/PF/IncomeTax/ESSI/Gratuity in employee profile
- Toggles are clickable by admin, update employee settings via PUT API
- Each toggle has tooltip showing deduction details (e.g., "Employee Rs 370 / Employer Rs 870")
- Verified all 14 report types are implemented in payroll/reports API
- Verified FBR PSID report with correct format (Payment_Section, TaxPayer_NTN, etc.)
- Updated payroll-slips.tsx to include contractEarnings field in PayrollLine type
- Added multi-contract earnings table to salary slip print preview
- Multi-contract section shows: Contract Salary, Daily Rate, Days Worked, Absents, Earned Salary
- Falls back to project allocation view when no contract earnings data
- Verified payroll workflow UI (Draft → Review → Approve → Draft to GL) already complete

Stage Summary:
- All 8 todos completed successfully
- Multi-contract payroll system fully functional from engine to UI to print
- Employee toggles interactive and saving to API
- Print module generates salary slips with contract breakdown
- All lint checks pass, dev server running on port 3000
