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
