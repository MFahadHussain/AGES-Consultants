#!/bin/bash
# ============================================================
# AcctFin ERP - PostgreSQL Backup Script
# ============================================================
# Usage: ./scripts/backup-pg.sh [OPTIONS]
#
# Options:
#   --full       Full backup with WAL archive (default)
#   --schema     Schema-only backup
#   --data       Data-only backup
#   --compress   Use gzip compression (default)
#   --no-compress No compression
#   --verbose    Verbose output
#
# Environment Variables:
#   PGHOST       PostgreSQL host (default: localhost)
#   PGPORT       PostgreSQL port (default: 5432)
#   PGUSER       PostgreSQL user (default: acctfin_admin)
#   PGDATABASE   PostgreSQL database (default: acctfin_erp)
#   BACKUP_DIR   Backup directory (default: ./backups)
# ============================================================

set -euo pipefail

# Configuration
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-acctfin_admin}"
PGDATABASE="${PGDATABASE:-acctfin_erp}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_TYPE="full"
COMPRESS=true
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --full) BACKUP_TYPE="full" ;;
    --schema) BACKUP_TYPE="schema" ;;
    --data) BACKUP_TYPE="data" ;;
    --compress) COMPRESS=true ;;
    --no-compress) COMPRESS=false ;;
    --verbose) VERBOSE=true ;;
    --help)
      echo "Usage: $0 [--full|--schema|--data] [--compress|--no-compress] [--verbose]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Backup filename
BASENAME="${PGDATABASE}_${BACKUP_TYPE}_${TIMESTAMP}"

echo "============================================"
echo "AcctFin ERP - PostgreSQL Backup"
echo "============================================"
echo "Database:   ${PGDATABASE}"
echo "Host:       ${PGHOST}:${PGPORT}"
echo "User:       ${PGUSER}"
echo "Type:       ${BACKUP_TYPE}"
echo "Timestamp:  ${TIMESTAMP}"
echo "============================================"

# Build pg_dump options
PGDUMP_OPTS="--host=${PGHOST} --port=${PGPORT} --username=${PGUSER}"

case ${BACKUP_TYPE} in
  full)
    PGDUMP_OPTS="${PGDUMP_OPTS} --format=custom"
    FILENAME="${BASENAME}.dump"
    ;;
  schema)
    PGDUMP_OPTS="${PGDUMP_OPTS} --schema-only --format=plain"
    FILENAME="${BASENAME}.sql"
    ;;
  data)
    PGDUMP_OPTS="${PGDUMP_OPTS} --data-only --format=plain"
    FILENAME="${BASENAME}.sql"
    ;;
esac

if [ "$VERBOSE" = true ]; then
  PGDUMP_OPTS="${PGDUMP_OPTS} --verbose"
fi

# Execute backup
echo "Starting backup..."
BACKUP_PATH="${BACKUP_DIR}/${FILENAME}"

PGPASSWORD="${PGPASSWORD:-AcctFin_Secure2025!}" pg_dump ${PGDUMP_OPTS} "${PGDATABASE}" > "${BACKUP_PATH}"

# Compress if requested and not already in custom format
if [ "$COMPRESS" = true ] && [ "${BACKUP_TYPE}" != "full" ]; then
  gzip "${BACKUP_PATH}"
  BACKUP_PATH="${BACKUP_PATH}.gz"
  echo "Compressed: ${BACKUP_PATH}"
fi

# Calculate file size
FILESIZE=$(du -h "${BACKUP_PATH}" | cut -f1)

echo "============================================"
echo "Backup completed successfully!"
echo "File: ${BACKUP_PATH}"
echo "Size: ${FILESIZE}"
echo "============================================"

# Cleanup old backups (keep last 30 days)
echo "Cleaning up backups older than 30 days..."
find "${BACKUP_DIR}" -name "${PGDATABASE}_*.dump*" -mtime +30 -delete 2>/dev/null || true
find "${BACKUP_DIR}" -name "${PGDATABASE}_*.sql*" -mtime +30 -delete 2>/dev/null || true
echo "Cleanup complete."
