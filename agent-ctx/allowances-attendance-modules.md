# Allowances & Attendance Modules - Work Record

## Task: Build AllowancesModule and AttendanceModule

### AllowancesModule (`src/components/modules/allowances.tsx`)
- Two tabs: Allowance Definitions + Employee Assignments
- KPI cards: Total Allowances, Active Assignments, Taxable Count, Project-Specific Count
- Tab 1: Full CRUD for Allowance master (code, name, type, value, taxable, project-specific, active)
- Tab 2: Full CRUD for EmployeeAllowance (employee, allowance, custom value, project, effective date, status)
- Filter by employee in assignments tab
- Filter by active/inactive in definitions tab
- Uses `/api/allowances`, `/api/employee-allowances`, `/api/employees`, `/api/projects`

### AttendanceModule (`src/components/modules/attendance.tsx`)
- Monthly attendance grid UI with click-to-cycle status cells
- KPI cards: Total Records, Present %, Leave Days, Absent Days
- Filters: Employee selector, month picker with prev/next navigation
- Grid: rows=employees, columns=days(1-31), color-coded status cells
- Summary columns: Present, Absent, Leave, SC-Earn, SC-Deduct per employee
- Bulk save with POST to `/api/attendance` (bulk upsert mode)
- Quick-fill toolbar for selected employee
- Status legend with SC impact indicators
- Weekend highlighting in grid headers
- Changed cells highlighted with ring border

### APIs Used (all pre-existing, no changes needed)
- `/api/allowances` - CRUD for Allowance master
- `/api/employee-allowances` - CRUD for EmployeeAllowance
- `/api/employees` - Employee dropdown
- `/api/projects` - Project dropdown
- `/api/attendance` - CRUD with bulk upsert support

### Lint Status
- 0 errors, 4 warnings (all pre-existing in other files)
- Dev server running on port 3000
