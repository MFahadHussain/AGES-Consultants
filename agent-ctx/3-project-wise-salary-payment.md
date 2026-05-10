# Task 3: Project-wise Salary Payment Agent — Work Log

## Summary
Added "Pay Salary Project Wise" functionality to the Payroll Engine module. Users can now pay salary grouped by project instead of only at the batch level.

## Changes Made

### File: `/home/z/my-project/src/components/modules/payroll.tsx`

#### 1. New icon imports (line 20)
- Added `FolderOpen` and `DollarSign` to lucide-react imports for the project-wise payment UI.

#### 2. New state variables (lines 323-325)
- `projectPayView: string | null` — stores the batchId when project-wise payment view is active, null when closed.
- `payingProjectId: string | null` — tracks which project is currently being paid (for loading state).

#### 3. New helper function: `getProjectCode` (lines 765-768)
- Returns the project code for a given projectId, or 'N/A' if not found.

#### 4. New interface: `ProjectPayGroup` (lines 774-787)
- Defines the shape of grouped project data:
  - `projectId`, `projectName`, `projectCode`
  - `employeeCount`, `totalGross`, `totalDeductions`, `totalNetPay`, `totalSocialCharges`
  - `lineIds` (array of line IDs in this project)
  - `allLinesApproved`, `anyLinesApproved`, `allLinesPaid` (status tracking)

#### 5. New function: `computeProjectPayGroups` (lines 789-839)
- Groups batch lines by `projectId`
- Lines with null `projectId` are grouped under "Unassigned"
- Calculates totals (gross, deductions, net pay, social charges) per project
- Tracks line status (all approved, any approved, all paid)
- Sorts: assigned projects first (alphabetically), unassigned last

#### 6. New handler: `handlePayProject` (lines 842-897)
- When "Pay Project" is clicked for a project:
  1. If batch is in draft, submits for review first
  2. Approves the specific line IDs for that project via `approve-line` API
  3. Creates a draft-to-GL voucher for those approved lines via `draft-to-gl` API
  4. Shows success toast with project name and amount paid
  5. Refreshes data

#### 7. "Pay by Project" button added in batch action areas (3 locations)
- Draft status batch actions (line 2258-2261)
- Reviewed status batch actions (line 2277-2279)
- Approved status batch actions (line 2293-2295)
- Button uses `FolderOpen` icon, emerald styling, toggles `projectPayView`

#### 8. Project-wise Payment View (lines 2334-2464)
- Shown inside the expanded batch content when `projectPayView === batch.id`
- **Header**: Title with FolderOpen icon, project count badge, close button
- **Summary Card**: Shows totals across all projects (Projects, Employees, Gross, Deductions, Net Pay, Social Charges)
- **Project Cards Grid**: 1/2/3 columns responsive grid
  - Each card shows:
    - Project name & code as header
    - Status badge (Draft/Partial/Paid)
    - Stats grid (Employees, Gross, Deductions, Net Pay, Social Charges)
    - "Pay Project" button with net pay amount, or "Already Paid" if all lines approved
    - Loading state while processing

## API Interactions
The feature reuses existing API endpoints:
- `POST /api/payroll` with action `review` — submit batch for review
- `POST /api/payroll` with action `approve-line` — approve specific line IDs
- `POST /api/payroll` with action `draft-to-gl` — create draft GL voucher for approved lines

No new API endpoints were created. The existing workflow is composed in sequence per project.

## Lint Results
- 0 errors, 4 pre-existing warnings (unrelated to changes)
