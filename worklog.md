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

---
Task ID: 2
Agent: main
Task: Update Prisma schema from SQLite to PostgreSQL and create migration infrastructure

Work Log:
- Updated prisma/schema.prisma: changed datasource provider from sqlite to postgresql, added relationMode = "prisma"
- Added comment at top of schema recommending future migration of Float fields to Decimal for financial precision
- Fixed PostgreSQL referential action cycles: added onDelete: Restrict, onUpdate: Restrict to self-relations (Role→Role, Account→Account, Project→Project) and onUpdate: Restrict to all other relations (NoAction not supported with relationMode = "prisma", used Restrict per Prisma docs)
- Updated .env: changed DATABASE_URL from SQLite file path to PostgreSQL connection string with connection pooling params
- Updated src/lib/db.ts: added environment-based PrismaClient logging (query/error/warn in dev, error only in prod), added datasources config for explicit URL
- Updated package.json: added new scripts (db:migrate:prod, db:migrate:create, db:studio, db:seed, db:migrate:sqlite-to-pg)
- Created docker-compose.yml: PostgreSQL 16 Alpine with health checks, persistent volumes, network isolation, resource limits, pgAdmin optional service
- Created docker/postgres/postgresql.conf: optimized for 2GB container, WAL archiving, SSD-friendly query planning, audit logging, autovacuum, statement timeouts
- Created docker/postgres/pg_hba.conf: scram-sha-256 auth for Docker networks, reject all other connections
- Created docker/postgres/init.sql: UUID/PgCrypto extensions, pg_stat_statements, UTC timezone, btree_gin/gist
- Created scripts/migrate-sqlite-to-pg.ts: comprehensive migration script with better-sqlite3 reader, type coercion, FK-respecting migration order, batch processing, dry-run support, progress reporting
- Created scripts/backup-pg.sh: PostgreSQL backup script with full/schema/data modes, gzip compression, 30-day retention cleanup
- Created scripts/restore-pg.sh: PostgreSQL restore script with pg_restore/psql support, drop-existing option, dry-run mode
- Created .env.production.example: template for production deployment with all required environment variables
- Created PRODUCTION.md: comprehensive deployment guide covering architecture, database setup, SSL/TLS, backup strategy, monitoring, migration from SQLite, troubleshooting, security checklist
- Created backups/.gitkeep and docker/postgres/wal_archive/.gitkeep for empty directories
- Installed better-sqlite3 and @types/better-sqlite3 as dev dependencies
- Successfully regenerated Prisma client for PostgreSQL (bun run db:generate)
- Lint check passes (0 errors, 4 pre-existing warnings only)

Stage Summary:
- Prisma schema fully migrated from SQLite to PostgreSQL with all referential actions compatible
- Complete Docker infrastructure for PostgreSQL 16 with production-ready configuration
- Comprehensive data migration script from SQLite to PostgreSQL
- Backup/restore scripts for PostgreSQL
- Production deployment documentation
- All lint checks pass
