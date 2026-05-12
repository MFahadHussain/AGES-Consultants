# AcctFin ERP - Production Deployment Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Database Setup (PostgreSQL)](#database-setup-postgresql)
4. [Application Deployment](#application-deployment)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [Backup Strategy](#backup-strategy)
7. [Monitoring & Health Checks](#monitoring--health-checks)
8. [Migration from SQLite](#migration-from-sqlite)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Nginx/     │────▶│   Next.js App    │────▶│  PostgreSQL  │
│   Caddy      │     │   (Port 3000)    │     │  (Port 5432) │
└──────────────┘     └──────────────────┘     └──────────────┘
```

---

## Prerequisites

- **Node.js** 18+ or **Bun** 1.0+
- **PostgreSQL** 16+
- **Docker** & **Docker Compose** (optional, for containerized setup)
- **4GB RAM** minimum (8GB recommended for production)
- **20GB disk** minimum (varies by data volume)

---

## Database Setup (PostgreSQL)

### Option A: Docker Compose (Recommended)

1. Copy the environment template:
   ```bash
   cp .env.production.example .env
   ```

2. Edit `.env` and set strong passwords:
   ```bash
   POSTGRES_PASSWORD="your_secure_password"
   DATABASE_URL="postgresql://acctfin_admin:your_secure_password@localhost:5432/acctfin_erp?schema=public&connection_limit=20&pool_timeout=10"
   ```

3. Start PostgreSQL:
   ```bash
   docker compose up -d postgres
   ```

4. Verify the database is running:
   ```bash
   docker compose exec postgres pg_isready -U acctfin_admin -d acctfin_erp
   ```

### Option B: Manual PostgreSQL Installation

1. Install PostgreSQL 16:
   ```bash
   # Ubuntu/Debian
   sudo apt install postgresql-16

   # macOS
   brew install postgresql@16
   ```

2. Create the database and user:
   ```sql
   CREATE USER acctfin_admin WITH PASSWORD 'your_secure_password';
   CREATE DATABASE acctfin_erp OWNER acctfin_admin;
   GRANT ALL PRIVILEGES ON DATABASE acctfin_erp TO acctfin_admin;
   ```

3. Enable required extensions:
   ```sql
   \c acctfin_erp
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
   CREATE EXTENSION IF NOT EXISTS "btree_gin";
   CREATE EXTENSION IF NOT EXISTS "btree_gist";
   ```

### Apply Schema

```bash
# Generate Prisma client for PostgreSQL
bun run db:generate

# Push schema to PostgreSQL (creates all tables)
bun run db:push

# OR use migrations for production
bun run db:migrate:prod
```

---

## Application Deployment

### Build & Start

```bash
# Install dependencies
bun install

# Build the application
bun run build

# Start the production server
bun run start
```

### Environment Variables

Ensure these are set in production:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `NEXTAUTH_SECRET` | Random secret for JWT signing | ✅ |
| `NEXTAUTH_URL` | Public URL of the application | ✅ |
| `NODE_ENV` | Set to `production` | ✅ |

---

## SSL/TLS Configuration

### With Caddy (Recommended)

Caddy automatically provisions SSL certificates via Let's Encrypt:

```Caddyfile
your-domain.com {
    reverse_proxy localhost:3000
}
```

### With Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Enable SSL in PostgreSQL

1. Generate certificates:
   ```bash
   openssl req -new -x509 -days 365 -nodes -text \
     -out server.crt -keyout server.key -subj "/CN=acctfin-db"
   ```

2. Update `postgresql.conf`:
   ```
   ssl = on
   ssl_cert_file = '/etc/postgresql/server.crt'
   ssl_key_file = '/etc/postgresql/server.key'
   ```

3. Update `DATABASE_URL`:
   ```
   DATABASE_URL="postgresql://acctfin_admin:password@host:5432/acctfin_erp?schema=public&sslmode=require"
   ```

---

## Backup Strategy

### Automated Daily Backups

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * /path/to/acctfin-erp/scripts/backup-pg.sh --full >> /var/log/acctfin-backup.log 2>&1
```

### Manual Backup

```bash
# Full backup (custom format, compressed)
./scripts/backup-pg.sh --full

# Schema-only backup
./scripts/backup-pg.sh --schema

# Data-only backup
./scripts/backup-pg.sh --data
```

### Restore

```bash
# Restore from backup (with confirmation)
./scripts/restore-pg.sh ./backups/acctfin_erp_full_20250101_020000.dump

# Drop and recreate database before restore
./scripts/restore-pg.sh ./backups/acctfin_erp_full_20250101_020000.dump --drop-existing
```

### WAL Archiving

The PostgreSQL configuration enables WAL archiving for Point-in-Time Recovery (PITR). WAL files are stored in `/backups/wal_archive/`. Ensure this directory has sufficient disk space.

---

## Monitoring & Health Checks

### Database Health

```bash
# Check database connectivity
docker compose exec postgres pg_isready -U acctfin_admin -d acctfin_erp

# Check active connections
psql -U acctfin_admin -d acctfin_erp -c "SELECT count(*) FROM pg_stat_activity;"

# Check database size
psql -U acctfin_admin -d acctfin_erp -c "SELECT pg_size_pretty(pg_database_size('acctfin_erp'));"
```

### Application Health

```bash
# Check if the app is running
curl -f http://localhost:3000/api/health || echo "App is down!"
```

### pg_stat_statements

The `pg_stat_statements` extension is enabled for query performance monitoring:

```sql
-- Top 10 slowest queries
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Migration from SQLite

If migrating from an existing SQLite database:

1. Ensure the SQLite database file exists at `db/custom.db`
2. Start PostgreSQL
3. Push the schema to PostgreSQL:
   ```bash
   bun run db:push
   ```
4. Run the migration script:
   ```bash
   # Set the SQLite database path (default: db/custom.db)
   export SQLITE_DB_PATH="./db/custom.db"

   # Run the migration
   bun run db:migrate:sqlite-to-pg
   ```

5. Verify data integrity by checking record counts in key tables.

See `scripts/migrate-sqlite-to-pg.ts` for detailed options.

---

## Troubleshooting

### Connection Refused

- Verify PostgreSQL is running: `docker compose ps` or `pg_isready`
- Check `DATABASE_URL` in `.env`
- Ensure `pg_hba.conf` allows connections from your IP

### Migration Errors

- Reset the database: `bun run db:reset` (⚠️ destroys all data)
- Check Prisma schema for PostgreSQL compatibility issues
- Review the migration log for specific errors

### Performance Issues

- Check `pg_stat_statements` for slow queries
- Ensure proper indexes exist (Prisma creates them automatically)
- Increase `shared_buffers` and `effective_cache_size` in `postgresql.conf`
- Consider upgrading to `Decimal` type for financial fields (see schema note)

### Permission Errors

- Ensure the PostgreSQL user has appropriate permissions
- Check `pg_hba.conf` for authentication method
- Verify the `DATABASE_URL` credentials

---

## Security Checklist

- [ ] Change default passwords in `.env`
- [ ] Enable SSL for PostgreSQL connections
- [ ] Restrict `pg_hba.conf` to known IPs
- [ ] Set `NEXTAUTH_SECRET` to a strong random value
- [ ] Enable `statement_timeout` in PostgreSQL config
- [ ] Set up automated backups
- [ ] Enable firewall rules (only expose ports 80/443)
- [ ] Review and restrict CORS settings
- [ ] Enable audit logging in the application
- [ ] Regularly update dependencies: `bun update`
