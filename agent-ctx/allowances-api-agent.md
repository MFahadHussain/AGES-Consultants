# Task: Allowances & Employee Allowances API

## Summary

Created two production-quality API route files for the AcctFin ERP system:

### 1. `/src/app/api/allowances/route.ts` — Allowance Master CRUD

| Method | Description |
|--------|-------------|
| **GET** | List all allowances with optional `?isActive=true|false` filter; includes `_count` of employeeAllowances for each record |
| **POST** | Create allowance; validates required fields (`code`, `name`), unique `code`, valid `allowanceType` (fixed/percentage), non-negative `value`, percentage ≤ 100; creates audit log |
| **PUT** | Update allowance via `?id=xxx`; validates existence, code uniqueness on rename, type/value constraints; partial update (only provided fields); audit log |
| **DELETE** | Soft delete (`isActive=false`) if allowance is referenced by employee allowances; hard delete if unreferenced; audit log for both paths |

### 2. `/src/app/api/employee-allowances/route.ts` — EmployeeAllowance CRUD

| Method | Description |
|--------|-------------|
| **GET** | List employee allowances with filters: `?employeeId=`, `?allowanceId=`, `?projectId=`, `?isActive=`; includes full `employee` (selected fields) and `allowance` relations |
| **POST** | Create employee allowance; validates `employeeId` exists in Employee table, `allowanceId` exists in Allowance table, project-specific constraints, `customValue` non-negative, duplicate detection (same employee+allowance+project); audit log |
| **PUT** | Update via `?id=xxx`; validates existence, allowance project-specific constraints if switching allowanceId, projectId existence, customValue; partial update; audit log |
| **DELETE** | Hard delete via `?id=xxx`; validates existence; audit log with descriptive details |

## Key Design Decisions

- **Soft vs Hard Delete**: Allowances use soft delete when referenced (`isActive=false`) and hard delete when not, preventing data integrity issues while keeping history.
- **Duplicate Prevention**: EmployeeAllowance POST checks for existing active records with the same employee+allowance+project combination.
- **Project-Specific Validation**: If an allowance's `isProjectSpecific` is `false`, the API rejects `projectId` to prevent misuse.
- **Audit Trail**: All CUD operations create `AuditLog` entries following existing project patterns.
- **Consistent Error Responses**: All endpoints return structured `{ error: string }` with appropriate HTTP status codes (400, 404, 409, 500).
- **Partial Updates**: PUT handlers only update fields that are explicitly provided in the request body.

## Database

The Prisma schema already had `Allowance` and `EmployeeAllowance` models — no schema changes were needed. `db:push` confirmed the database is in sync.

## Lint

0 errors on the new files (4 pre-existing warnings in fams routes).
