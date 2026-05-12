---
Task ID: 2
Agent: main
Task: Update Prisma schema from SQLite to PostgreSQL and create migration infrastructure

Key Changes:
- prisma/schema.prisma: Changed provider from sqlite to postgresql, added relationMode = "prisma", added onDelete/onUpdate: Restrict to all relations to satisfy PostgreSQL referential action cycle validation
- .env: Changed DATABASE_URL to PostgreSQL connection string
- src/lib/db.ts: Added environment-based logging and explicit datasources config
- package.json: Added db:migrate:prod, db:migrate:create, db:studio, db:seed, db:migrate:sqlite-to-pg scripts
- docker-compose.yml: PostgreSQL 16 + pgAdmin services
- docker/postgres/postgresql.conf, pg_hba.conf, init.sql: Production PostgreSQL config
- scripts/migrate-sqlite-to-pg.ts: SQLite to PG data migration with better-sqlite3
- scripts/backup-pg.sh, restore-pg.sh: PG backup/restore scripts
- .env.production.example, PRODUCTION.md: Production deployment docs
- backups/.gitkeep, docker/postgres/wal_archive/.gitkeep: Empty directory placeholders

Notes:
- NoAction is NOT supported with relationMode = "prisma" for PostgreSQL; used Restrict instead
- All self-relations (Role, Account, Project) use onDelete: Restrict, onUpdate: Restrict
- Other relations preserve their original onDelete (Cascade/SetNull) with onUpdate: Restrict added
- Prisma client regenerated successfully for PostgreSQL
- Old SQLite database file (db/custom.db) is preserved
