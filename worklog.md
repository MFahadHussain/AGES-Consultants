---
Task ID: 1
Agent: Main Agent
Task: Fix Payroll Batches - Use Attendance-Driven Calculator, Add New Employee Data

Work Log:
- Read and analyzed the entire codebase: Prisma schema, attendance API, payroll API, calculateMonthlyPayroll, payroll component, seed data
- Rewrote `calculateMonthlyPayroll.ts` to support project-specific salaries from EmployeeProjectAssignment
  - Added ProjectAllocation interface with projectDailyRate, projectSalary, designation
  - Added PayrollResult with allowances, deductions, grossSalary, netPay, gratuity, taxBreakdown, scBreakdown
  - When all projects have assignment salaries: total = sum of (assignment salary / daysInMonth) * days on project
  - When some have salaries: mixed calculation with fallback to baseSalary
  - Deletes stale ProjectCostLedger entries on recalculation
- Rewrote `/api/payroll/route.ts` run-payroll action to use `calculateMonthlyPayroll`
  - Replaced 200+ lines of inline calculation with calls to the calculator
  - Creates PayrollBatchLine records from calculator results
  - Includes project distribution data
- Created `/api/seed-payroll-reset/route.ts` to clear old data and seed new
  - Clears: PayrollBatchLine, ProjectCostLedger, PayrollBatch, AttendanceDailyProject, Attendance, EmployeeAllowance, EmployeeProjectAssignment, EmployeeSalaryHistory, FinalSettlement, LoanInstallment, Loan, Employee
  - Seeds: Tax Slabs, Allowances, GL Mappings, Projects, Employee (Assad Ali Khan), Project Assignments with per-project salary
  - Generates attendance for current month with rotating project distribution
- Created `/api/payroll/project-cost/route.ts` for Project Cost Ledger data
  - Returns entries, byEmployee grouping, byProject grouping, grandTotal
- Updated `preRunValidation.ts` to include CL/SL/EL in BILLABLE_STATUSES
- Updated payroll frontend component to use backend calculator API and show project cost breakdown

Stage Summary:
- Assad Ali Khan created with 7 project assignments: AGES HO (265K), Jabba Dam (265K), Kurram Tangi Dam (265K), Hingol Dam (265K), 03 Dams (265K), PHLCE (388,098), Balakot HPP (451,576)
- Base salary set to total: 2,164,674 PKR
- Payroll Run uses Attendance-Driven Calculator that respects project-specific salaries
- Project Cost Ledger is populated with per-project salary share, SC share, and component breakdowns
- All APIs tested and working: seed, attendance save, payroll calculate, run-payroll, project-cost
