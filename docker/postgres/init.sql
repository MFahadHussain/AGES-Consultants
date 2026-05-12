-- ============================================================
-- AcctFin ERP PostgreSQL Initialization Script
-- ============================================================

-- Create application schema if not exists
CREATE SCHEMA IF NOT EXISTS public;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";        -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";          -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query performance monitoring
CREATE EXTENSION IF NOT EXISTS "btree_gin";          -- Composite index support
CREATE EXTENSION IF NOT EXISTS "btree_gist";         -- Composite index support

-- Create read-only user for reporting (optional)
-- DO NOT run in development
-- CREATE ROLE acctfin_reader WITH LOGIN PASSWORD 'Reader_Pass2025!';
-- GRANT CONNECT ON DATABASE acctfin_erp TO acctfin_reader;
-- GRANT USAGE ON SCHEMA public TO acctfin_reader;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO acctfin_reader;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO acctfin_reader;

-- Create application user with restricted privileges
-- (already created via POSTGRES_USER env var)

-- Set default tablespace
SET default_tablespace = '';

-- Ensure UTC timezone for financial consistency
SET timezone = 'UTC';

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'AcctFin ERP database initialized successfully at %', now();
END
$$;
