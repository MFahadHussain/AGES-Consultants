#!/bin/bash

# ==============================================================================
# PostgreSQL Automated Daily Backup Script
# ==============================================================================

# Configuration
BACKUP_DIR="/Users/fahadbangash/Downloads/AGES SOFTWARE/Backup Latest/v11/db_backups"
DB_USER="acctfin_admin"
DB_NAME="acctfin_erp"
PG_DUMP_PATH="/Library/PostgreSQL/18/bin/pg_dump"

# Timestamp for the backup file
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_${TIMESTAMP}.dump"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Perform the dump
echo "[$(date)] Starting backup for database: $DB_NAME"
$PG_DUMP_PATH -h localhost -U "$DB_USER" -d "$DB_NAME" -F c -f "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "[$(date)] Backup completed successfully: $BACKUP_FILE"
    
    # Optional: Keep only the last 7 days of backups to save disk space
    find "$BACKUP_DIR" -type f -name "${DB_NAME}_backup_*.dump" -mtime +7 -exec rm {} \;
    echo "[$(date)] Old backups (older than 7 days) cleaned up."
else
    echo "[$(date)] Backup failed!" >&2
    exit 1
fi
