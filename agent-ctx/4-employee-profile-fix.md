# Task 4: Employee Profile - Fix Months Dropdown and Add SC GL Pay Button

## Summary
Modified `/home/z/my-project/src/components/modules/employee-profile.tsx` with three key changes:

### 1. Fixed `recentMonths` (line ~441)
- Changed from `for (let i = 0; i < 12; i++)` (past only) to `for (let i = -12; i <= 12; i++)` (12 past + current + 12 future)
- Enables future month selection in attendance/payroll month dropdowns

### 2. Added State + Handler for SC GL Draft
- State: `scGLDraftLoading`, `scGLDraftVoucher`
- Handler: `handleCreateSCGLDraft()` — finds approved batch with pending SC, fetches open FY, calls `/api/payroll` with `create-sc-gl-draft` action

### 3. Added UI in `renderSocialCharges()`
- "Create SC GL Draft" button (visible only when pending SC months exist)
- Pending SC month count indicator
- SC GL Draft Voucher card with DRAFT badge, voucher number, DR/CR summary, and entries table

### Other Changes
- Added `Badge` import from `@/components/ui/badge`

### No Changes To
- Salary calculation logic
- Attendance module
- Profile card rendering
- Any other module
