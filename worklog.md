---
Task ID: 1
Agent: Main Agent
Task: Fix voucher creation not showing in ledgers and voucher list

Work Log:
- Investigated the root cause: POST /api/vouchers was returning 500 error
- Found 3 bugs:
  1. VoucherApproval table has FK to User, but userId was hardcoded as 'system' (no such user exists) → FK violation
  2. AuditLog creation could fail and crash the entire request (no try-catch)
  3. Ledger API only showed approved/posted vouchers, but new vouchers are created as 'draft'
- Fixed src/app/api/vouchers/route.ts:
  - Use getSystemUserId() instead of hardcoded 'system' for createdBy
  - Wrap audit log creation in try-catch so voucher creation doesn't fail
  - Added autoPost option to create vouchers directly as 'posted'
  - Changed ordering from date desc to createdAt desc for better visibility
- Fixed src/app/api/vouchers/[id]/route.ts:
  - Replaced all hardcoded 'system' userId with getSystemUserId() result
  - Wrapped all audit log and approval creations in try-catch
- Fixed src/app/api/ledgers/route.ts:
  - Added status filter parameter ('posted', 'approved', 'all')
  - Default still shows approved/posted vouchers in ledgers
  - Added voucher status display in ledger entries
- Fixed src/app/api/reports/route.ts:
  - Changed from status: 'posted' to status: { in: ['approved', 'posted'] }
  - Added status query parameter support
- Updated src/components/modules/voucher-management.tsx:
  - Added "Auto Post to General Ledger" checkbox (default: ON)
  - Button text changes based on autoPost: "Create & Post to GL" vs "Create as Draft"
  - Better error handling in handleStatusChange
  - Improved toast messages
- Updated src/components/modules/ledgers.tsx:
  - Added status filter dropdown (Approved & Posted / Reviewed & Above / All incl. Drafts)
  - Added Refresh button
  - Added voucher status badge in ledger entries
  - Updated empty state messages
- Reduced Prisma log level from 'query' to 'error' to reduce memory pressure

Stage Summary:
- Voucher creation now works (POST /api/vouchers returns 201)
- Vouchers with autoPost=true are immediately posted to GL and visible in ledgers
- Draft vouchers can be Quick Posted from the voucher list
- Ledger API now supports status filtering
- All FK references use valid User IDs via getSystemUserId()

---
Task ID: 5
Agent: Main Agent
Task: Complete role-based workflow fixes and enhancements

Work Log:
- Fixed auto-post permission bypass: autoPost checkbox only visible for users with quick_post permission (Admin)
- Non-admin users now see "Approval Workflow Required" info box explaining their role needs approval
- autoPost is forced to false at API level when user lacks quick_post permission
- Fixed detail dialog Reject button: added status check (can't reject already rejected or posted vouchers)
- Gate Duplicate button by hasPermission('edit') in list view and all detail dialog sections
- Gate "New Voucher" button by hasPermission('edit') - viewers/auditors can't create vouchers
- Added handler-level permission guards to handleEdit, handleDeleteClick, and handleDuplicate
- Enhanced WorkflowSteps component to use currentRole prop:
  - Highlights actionable step with amber ring and Shield icon
  - Shows which step the current role can act on (e.g., Manager sees "Manager reviews" highlighted)
  - Role label text in amber when it's the user's actionable step
- Tested all workflow actions via API:
  - Accountant submits (draft → pending) ✅
  - Manager approves (pending → approved) ✅
  - Admin posts (approved → posted) ✅
  - Admin quick posts (draft → posted) ✅
  - Admin revokes (posted → draft) ✅
  - Viewer submit rejected with 403 ✅
  - Accountant quick_post rejected with 403 ✅
- Removed output: "standalone" from next.config.ts to fix next start
- Lint passes with no errors

Stage Summary:
- Role-based workflow is now fully enforced at both UI and handler levels
- Auto-post can only be used by Admin role (both UI checkbox and API guard)
- Duplicate, Edit, Delete, and New Voucher all require edit permission
- WorkflowSteps visually highlights which step the current role can act on
- Reject button properly checks voucher status in detail dialog
- All workflow API endpoints tested and working with role-based access control
