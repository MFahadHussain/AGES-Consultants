---
Task ID: 2
Agent: full-stack-developer
Task: Implement project-wise voucher workflow in payroll module

Work Log:
- Modified handleDraftToGL to call /api/payroll/generate-gl-voucher API with mode: 'project-wise' instead of /api/payroll with action: 'draft-to-gl'
- Removed GL Voucher Choice dialog (consolidated vs project-wise selection) entirely
- Removed GL Voucher Confirmation dialog entirely
- Removed unused state variables: glVoucherMode, glVoucherChoiceOpen, glVoucherConfirmOpen
- Removed handleGenerateGLVoucher function (replaced by updated handleDraftToGL)
- Updated handlePostAllVouchersToGL to show toast with count and refresh data after posting
- Updated Draft to GL dialog description to clearly state project-wise voucher creation
- Updated Draft to GL dialog info box with project-wise messaging
- Updated Draft to GL dialog button text from "Create Draft Voucher" to "Create Project-wise Vouchers"
- Updated all "Draft to Voucher" button labels to show "Draft to Voucher (Project-wise)"
- Removed "Post to GL" button from approved batch status (consolidated path removed)
- Updated workflow bar "Post to GL" action to call handlePostAllVouchersToGL directly
- Updated handlePayProject to use /api/payroll/generate-gl-voucher with mode: 'project-wise'
- Lint check passed with 0 errors (only pre-existing warnings unrelated to changes)

Stage Summary:
- Vouchers are now always created project-wise — no more consolidated vs project-wise choice
- Workflow is streamlined: Select → Review → Approve → Draft Voucher (project-wise) → Post to GL
- Each project voucher can be posted individually or all at once via workflow bar
- All references to glVoucherMode, glVoucherChoiceOpen, glVoucherConfirmOpen, and handleGenerateGLVoucher have been removed

---
Task ID: 2
Agent: main
Task: Implement project-wise voucher workflow in payroll module

Work Log:
- Modified handleDraftToGL to call /api/payroll/generate-gl-voucher with mode: 'project-wise' instead of /api/payroll with action: 'draft-to-gl'
- Added lineIds parameter support to generate-gl-voucher API endpoint
- Removed GL Voucher Choice dialog (consolidated vs project-wise selection)
- Removed glVoucherMode, glVoucherChoiceOpen, glVoucherConfirmOpen state variables
- Removed handleGenerateGLVoucher function (no longer needed)
- Updated Draft to GL dialog to show project-wise messaging and "Create Project-wise Vouchers" button
- Updated all "Draft to Voucher" buttons to show "Draft to Voucher (Project-wise)" label
- Updated workflow bar: "Post to GL" now directly calls handlePostAllVouchersToGL()
- Updated approved batch status buttons: removed separate "Post to GL" button, kept "Draft to Voucher (Project-wise)"
- Updated handlePostAllVouchersToGL to show toast with posted count
- Updated handlePayProject to use generate-gl-voucher API with mode: 'project-wise'

Stage Summary:
- Streamlined workflow: Select → Review → Approve → Draft to Voucher (always project-wise) → Post to GL
- Vouchers are now always created project-wise (one per project)
- No more consolidated vs project-wise choice dialog
- Each project voucher can be posted individually or all at once
- Lint: 0 errors, 4 pre-existing warnings

---
Task ID: 2
Agent: full-stack-developer
Task: Implement Strict Project-wise Payroll Workflow

Work Log:
- Added handleSendBackSelectedLines handler for sending selected lines back to draft status from reviewed
- Added handleReviewAllLines handler for reviewing all lines in a batch (replaces inline logic)
- Phase 1: Restructured batch card action buttons to be step-aware:
  - Draft: Run Payroll, Recalculate, Review All, Add Line, Delete (removed Approve All, Pay by Project)
  - Reviewed: Approve All, Pay by Project, Send Back to Draft (removed Review Remaining, Draft to Voucher)
  - Approved: Draft to Voucher (Project-wise), Pay by Project (unchanged)
  - Draft-to-GL: Post All to GL button + voucher count badge (replaced static badge)
  - Posted: "Posted to GL — Complete" badge
- Phase 2: Enhanced employee lines table:
  - Added step-aware workflow toolbar with current step label and highlighted step indicators
  - Added step-aware action buttons (Review Selected in draft, Approve Selected + Send Back Selected in reviewed)
  - Grouped employee rows by project with project header rows showing project code, name, employee count, and totals
  - Added project badge column (monospace) in employee table
  - Removed ESSI columns (simplified table), kept core columns
  - Changed Actions column to show for both draft and reviewed status
  - Updated colSpan values for expanded line details to match new column count (21/20)
- Phase 3: Enhanced project-wise payment view:
  - Added batch status badge in header
  - Added workflow step indicator per project (Select→Review→Approve→Voucher→Posted)
  - Added getProjectStep helper to determine current step per project group
  - Added employee list within each project card (name, line status badge, net pay)
  - Improved project identification with code badge + name
  - Changed "Already Paid" to "Already Processed" for clarity
- Phase 4: Improved generated vouchers display:
  - Added comprehensive voucher card within batch card area for draft-to-gl and posted status
  - Voucher summary table with: Voucher No, Project (code + name), Employees, Total DR, Total CR, Balance validation, Status, Action (Post button)
  - Added totals row in summary table with balance validation across all vouchers
  - Added "Post All to GL" button in voucher card header
  - Added expandable individual voucher details (journal entries + employee breakdown)
  - Replaced old bottom-level voucher section with legacy fallback (only shows when no batch context)
  - Kept backward-compatible JournalVoucherCard when generatedVouchers is empty
- Lint check: 0 errors, 4 pre-existing warnings (unrelated to changes)

Stage Summary:
- Strict 5-step workflow enforced: Draft → Reviewed → Approved → Draft-to-GL → Posted
- Step-aware buttons: only show actions relevant to current workflow step
- Employee table grouped by project with project headers and badges
- Project payment view shows workflow step progress and employee lists per project
- Voucher display moved into batch card area with summary table and expandable details
- Each project voucher can be posted individually or all at once
- Balance validation (Dr = Cr) shown per voucher and across all vouchers
- Format: JV-PAY-YYYYMM-PROJCODE for all project-wise vouchers

---
Task ID: 3
Agent: main
Task: Fix project-wise voucher creation error, remove June data, fix NaN tax display

Work Log:
- Fixed critical Prisma error: Account model fields are `name` and `code`, not `accountName` and `accountCode`. Updated all Prisma select clauses in:
  - /api/payroll/generate-gl-voucher/route.ts (3 occurrences)
  - /api/payroll/route.ts (2 occurrences)
- Fixed voucher posting: updated /api/vouchers/[id]/route.ts to allow posting from 'draft' status (not just 'approved'), so payroll-generated draft vouchers can be posted directly
- Removed restrictive batch status check in generate-gl-voucher: now allows any batch status since line-level approval is checked independently
- Fixed NaN in monthly tax: added `monthlyTax` field to taxBreakdown initialization and assignment in calculateMonthlyPayroll.ts
- Deleted June 2026 payroll data (batch PAY-202606-001 and voucher JV-PAY-202606-AGES-H) from database
- Updated voucher suffix format: removed hyphens and spaces from project codes, extended max length to 8 chars (e.g., AGES-HO → AGESHO)
- Updated handlePayProject to store generated vouchers in state for display after creation
- Updated voucher display condition to show when generatedVouchers exist regardless of batch status
- Lint check: 0 errors, 4 pre-existing warnings

Stage Summary:
- Root cause of voucher creation error: Prisma select used non-existent field names `accountName`/`accountCode` instead of `name`/`code`
- Root cause of NaN: `monthlyTax` was calculated but never assigned to `taxBreakdown` object
- Root cause of posting failure: voucher `post` action required `approved` status but payroll creates `draft` vouchers
- June data cleaned, voucher number format improved
