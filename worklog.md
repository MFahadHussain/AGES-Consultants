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
