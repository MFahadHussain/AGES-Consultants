# Task 3: Build GL Journal Voucher Workflow UI in Payroll Module

**Agent**: frontend-payroll-gl-voucher
**File Modified**: `/home/z/my-project/src/components/modules/payroll.tsx`

## Changes Made

### 1. Added GL Voucher Workflow State Variables (line ~309)
- `glVoucherMode` - tracks 'consolidated' | 'project-wise' | null selection
- `glVoucherChoiceOpen` - controls the choice modal dialog
- `glVoucherConfirmOpen` - controls the confirmation alert dialog
- `generatedVouchers` - stores generated voucher data from API
- `glVoucherLoading` - loading state during voucher generation
- `expandedVoucherEmp` - tracks which voucher's employee breakdown is expanded

### 2. Replaced "Post to GL" Button Behavior (line ~2113)
- Changed from `setPostDialogOpen(true)` to `setGlVoucherChoiceOpen(true)`
- Now opens the GL voucher choice modal instead of the old post dialog
- Existing "Draft to GL" button preserved unchanged

### 3. Updated Workflow Bar (line ~941)
- Changed the workflow status bar's "Post to GL" action button to open choice modal
- Changed from `setPostDialogOpen(true)` to `setGlVoucherChoiceOpen(true)`

### 4. Added handleGenerateGLVoucher Handler (line ~454)
- Calls `/api/payroll/generate-gl-voucher` with batchId, mode, financialYearId
- Sets generatedVouchers from API response
- Closes both choice and confirm dialogs on success
- Shows toast with voucher count

### 5. Added handlePostVoucherToGL Handler (line ~488)
- Calls `/api/vouchers/{voucherId}` with PUT and action: 'post'
- Updates generatedVouchers state to mark voucher as 'posted'
- Refreshes data on success

### 6. Added handlePostAllVouchersToGL Handler (line ~504)
- Iterates all draft vouchers and posts each one sequentially
- Used by "Post All to GL" button in summary card

### 7. Added GL Voucher Choice Modal Dialog (line ~2683)
- Two card-style options: Single Voucher (consolidated) and Project-wise Vouchers
- Visual selection with emerald border highlight
- Shows batch info (batch number, period, employees, total net pay)
- Preview of voucher number format for each option
- Cancel and Generate buttons with loading state

### 8. Added GL Voucher Confirmation AlertDialog (line ~2732)
- Shows which mode was selected (consolidated/project-wise)
- Confirms that draft vouchers will be created
- Confirm & Generate button with loading spinner

### 9. Added Generated GL Voucher Cards Display (line ~2482)
- Summary card for project-wise mode showing all vouchers in a table with totals
- Individual voucher cards with:
  - Journal entry table (Account, Debit, Credit, Note)
  - Color-coded rows (red for debit, green for credit)
  - Balance validation badge
  - Project badge for project-wise vouchers
  - Employee breakdown expandable section (for project vouchers)
  - Print button and "Post to GL →" button for draft balanced vouchers
  - Unbalanced warning with AlertCircle icon

## Preserved
- Existing `JournalVoucherCard` component unchanged
- Existing `Draft to GL` button on approved batches unchanged
- Existing `handlePostToGL` function unchanged
- All payroll calculation logic, attendance module, batch workflow stages unchanged
- No changes to other modules, sidebar, topbar, or styling

## Lint Results
- 0 errors, 4 pre-existing warnings (from FAMS module, not from this change)
