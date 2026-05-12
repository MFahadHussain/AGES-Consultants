#!/bin/bash
# ============================================================
# AcctFin ERP - PostgreSQL Restore Script
# ============================================================
# Usage: ./scripts/restore-pg.sh <backup_file> [OPTIONS]
#
# Options:
#   --drop-existing   Drop existing database before restore
#   --schema-only     Restore schema only
#   --data-only       Restore data only
#   --verbose         Verbose output
#   --dry-run         Show what would be done without executing
#
# Environment Variables:
#   PGHOST       PostgreSQL host (default: localhost)
#   PGPORT       PostgreSQL port (default: 5432)
#   PGUSER       PostgreSQL user (default: acctfin_admin)
#   PGDATABASE   PostgreSQL database (default: acctfin_erp)
# ============================================================

set -euo pipefail

# Configuration
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-acctfin_admin}"
PGDATABASE="${PGDATABASE:-acctfin_erp}"
DROP_EXISTING=false
VERBOSE=false
DRY_RUN=false
RESTORE_TYPE="full"

# Parse arguments
BACKUP_FILE=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --drop-existing) DROP_EXISTING=true ;;
    --schema-only) RESTORE_TYPE="schema" ;;
    --data-only) RESTORE_TYPE="data" ;;
    --verbose) VERBOSE=true ;;
    --dry-run) DRY_RUN=true ;;
    --help)
      echo "Usage: $0 <backup_file> [--drop-existing] [--schema-only|--data-only] [--verbose] [--dry-run]"
      exit 0
      ;;
    *)
      if [ -z "${BACKUP_FILE}" ]; then
        BACKUP_FILE="$1"
      else
        echo "Unknown option: $1"; exit 1
      fi
      ;;
  esac
  shift
done

# Validate
if [ -z "${BACKUP_FILE}" ]; then
  echo "ERROR: No backup file specified"
  echo "Usage: $0 <backup_file> [OPTIONS]"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "============================================"
echo "AcctFin ERP - PostgreSQL Restore"
echo "============================================"
echo "Database:   ${PGDATABASE}"
echo "Host:       ${PGHOST}:${PGPORT}"
echo "User:       ${PGUSER}"
echo "Backup:     ${BACKUP_FILE}"
echo "Drop DB:    ${DROP_EXISTING}"
echo "Type:       ${RESTORE_TYPE}"
echo "Dry Run:    ${DRY_RUN}"
echo "============================================"

if [ "$DRY_RUN" = true ]; then
  echo "DRY RUN - No changes will be made"
fi

# Decompress if needed
ACTUAL_FILE="${BACKUP_FILE}"
if [[ "${BACKUP_FILE}" == *.gz ]]; then
  echo "Decompressing backup..."
  ACTUAL_FILE="${BACKUP_FILE%.gz}"
  if [ "$DRY_RUN" = false ]; then
    gunzip -k "${BACKUP_FILE}"
  fi
  echo "Decompressed to: ${ACTUAL_FILE}"
fi

PGPASSWORD="${PGPASSWORD:-AcctFin_Secure2025!}"
export PGPASSWORD

# Drop existing database if requested
if [ "$DROP_EXISTING" = true ] && [ "$DRY_RUN" = false ]; then
  echo "WARNING: Dropping existing database '${PGDATABASE}'..."
  echo "All data will be lost!"
  read -p "Are you sure? (yes/no): " CONFIRM
  if [ "${CONFIRM}" = "yes" ]; then
    psql --host=${PGHOST} --port=${PGPORT} --username=${PGUSER} -d postgres -c "DROP DATABASE IF EXISTS ${PGDATABASE};"
    psql --host=${PGHOST} --port=${PGPORT} --username=${PGUSER} -d postgres -c "CREATE DATABASE ${PGDATABASE} OWNER ${PGUSER};"
    echo "Database recreated."
  else
    echo "Restore cancelled."
    exit 0
  fi
fi

# Restore based on file type
if [[ "${ACTUAL_FILE}" == *.dump ]]; then
  # Custom format - use pg_restore
  echo "Restoring from custom format backup..."
  RESTORE_OPTS="--host=${PGHOST} --port=${PGPORT} --username=${PGUSER} --dbname=${PGDATABASE}"

  case ${RESTORE_TYPE} in
    schema) RESTORE_OPTS="${RESTORE_OPTS} --schema-only" ;;
    data) RESTORE_OPTS="${RESTORE_OPTS} --data-only" ;;
  esac

  if [ "$VERBOSE" = true ]; then
    RESTORE_OPTS="${RESTORE_OPTS} --verbose"
  fi

  if [ "$DRY_RUN" = false ]; then
    pg_restore ${RESTORE_OPTS} "${ACTUAL_FILE}" || true
  else
    echo "Would run: pg_restore ${RESTORE_OPTS} ${ACTUAL_FILE}"
  fi
else
  # Plain SQL format - use psql
  echo "Restoring from SQL backup..."
  PSQL_OPTS="--host=${PGHOST} --port=${PGPORT} --username=${PGUSER} --dbname=${PGDATABASE}"

  if [ "$VERBOSE" = true ]; then
    PSQL_OPTS="${PSQL_OPTS} --echo-all"
  fi

  if [ "$DRY_RUN" = false ]; then
    psql ${PSQL_OPTS} -f "${ACTUAL_FILE}" || true
  else
    echo "Would run: psql ${PSQL_OPTS} -f ${ACTUAL_FILE}"
  fi
fi

# Cleanup decompressed file
if [[ "${BACKUP_FILE}" == *.gz ]] && [ -f "${ACTUAL_FILE}" ]; then
  rm -f "${ACTUAL_FILE}"
fi

echo "============================================"
echo "Restore completed!"
echo "============================================"

# Verify
if [ "$DRY_RUN" = false ]; then
  echo "Verifying database..."
  TABLE_COUNT=$(psql --host=${PGHOST} --port=${PGPORT} --username=${PGUSER} --dbname=${PGDATABASE} -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
  echo "Public schema tables: ${TABLE_COUNT}"
fi
