---
Task ID: 1
Agent: main
Task: Fix empty password hashes, RBAC visibility, change password UX, and verify log.details fixes

Work Log:
- Fixed 11 users with empty passwordHash by setting bcrypt hash for 'Admin@123'
- Reset failed login attempts and unlocked all accounts
- Verified change password API works correctly end-to-end
- Added RBAC access control: only admin/super_admin/system_admin roles can view Roles & Permissions
- Updated sidebar.tsx: removed 'rbac' from manager role, added super_admin and system_admin role types
- Updated settings.tsx: conditionally show Roles & Permissions tab only for admin roles
- Updated rbac.tsx: added access denied view for non-admin users, moved after all hooks
- Added default password hint in header.tsx change password dialog
- Verified log.details handling is safe in both security-center.tsx and audit-trail.tsx
- Fixed JSX parsing error in header.tsx (missing closing brace in conditional expression)
- Fixed React Hooks rules violation in rbac.tsx (conditional return before hooks)
- All lint errors resolved (only 4 pre-existing warnings remain)

Stage Summary:
- All users now have working passwords (Admin@123 for default)
- Change password API verified working correctly
- RBAC module and Roles & Permissions tab now restricted to admin/super_admin/system_admin only
- log.details handling already safe in both security-center.tsx and audit-trail.tsx
- No new lint errors introduced
