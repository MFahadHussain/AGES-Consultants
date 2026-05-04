# Task 4: Fix Payroll Batches UI — checkbox selection, approve by employee, Draft to GL workflow

## Agent: Main Agent
## Status: COMPLETED

## Summary of All Changes Made

### File Modified: `/src/components/modules/payroll.tsx`

### 1. New Imports
- Added `Checkbox` from `@/components/ui/checkbox`
- Added `FileText` icon from `lucide-react`

### 2. New Constants
- Added `lineStatusStyles` mapping: `draft` → amber, `approved` → emerald
- Added `'draft-to-gl'` status style (violet)
- Added `'draft-to-gl'` status label ("Draft to GL")
- Updated `workflowSteps` from `['draft', 'reviewed', 'approved', 'posted']` to `['draft', 'reviewed', 'approved', 'draft-to-gl']`

### 3. New State Variables
- `selectedLineIds: Set<string>` — tracks which line checkboxes are checked
- `draftToGLDialogOpen: boolean` — controls the Draft to GL confirmation dialog
- `processingAction: string | null` — tracks which async action is in progress (for loading states)

### 4. New Handlers
- `toggleLineSelection(lineId)` — toggle individual line checkbox
- `toggleSelectAllLines(batch)` — select/deselect all lines in a batch
- `handleApproveSelectedLines()` — calls `/api/payroll` with `action: 'approve-line'` and `lineIds`
- `handleApproveAllLines(batchId)` — calls `/api/payroll` with `action: 'approve-all-lines'`
- `handleDraftToGL(lineIds?)` — calls `/api/payroll` with `action: 'draft-to-gl'`, optional lineIds

### 5. Updated Batch Action Buttons
- **Draft status**: Added "Approve All" button next to "Run Payroll"
- **Reviewed status**: Added "Approve All Lines" button
- **Approved status**: Added "Draft to GL" button alongside "Post to GL"
- **Draft-to-GL status**: Shows "Draft Voucher Created" badge
- **Posted status**: Unchanged

### 6. Bulk Action Toolbar
Added above the employee lines table when batch is expanded:
- "Select All" checkbox with selection count ("X of Y selected")
- "Approve Selected" button (appears when lines selected)
- "Draft Selected to GL" button (appears when lines selected)
- "Clear Selection" button (appears when lines selected)

### 7. Updated Lines Table
- Added **Sel.** column header with checkboxes
- Added **Status** column showing lineStatus badge (Draft/Approved)
- Each row now has:
  - Checkbox for selection (clicking stops propagation)
  - lineStatus badge using `lineStatusStyles`
  - Row highlights when selected (`bg-primary/5`)
- Updated colSpan for expanded line details (from 17/18 to 20/21)

### 8. Updated Line Detail Dialog
- Added lineStatus badge next to employee name in the dialog title
- Added **Compliance Indicators** section at the top:
  - Line status badge (Draft/Approved)
  - EOBI: Active badge (when eobiEmployee > 0)
  - PF: Active badge (when pfEmployee > 0)
  - Income Tax: Deducted badge (when incomeTax > 0)
  - "No statutory deductions" badge (when all are zero)

### 9. Draft to GL Confirmation Dialog
- New AlertDialog with:
  - FileText icon in title
  - Description explaining draft voucher creation
  - Batch summary info (name, period, lines, net pay)
  - Violet info banner about what the draft voucher contains
  - "Create Draft Voucher" action button with loading state

### 10. Updated Workflow Bar
- Changed from: Draft → Reviewed → Approved → Posted to GL
- Changed to: Draft → Reviewed → Approved → Draft to GL

## Lint Status
- No ESLint errors in the modified file
- No TypeScript errors in the modified file
