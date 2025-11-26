#!/bin/bash
# Database Backup Script for ServiceText Pro

# Create backups directory if it doesn't exist
mkdir -p backend/backups

# Generate filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backend/backups/servicetext_pro_db_${TIMESTAMP}.sql"

echo "Starting backup to ${BACKUP_FILE}..."

# Attempt backup using the credentials provided
# You can edit this password if it is incorrect
export PGPASSWORD='C58acfd5c!'

# Try with 'postgres' user first (as requested)
if pg_dump -h localhost -U postgres -d servicetext_pro -F c -f "${BACKUP_FILE}"; then
    echo "✅ Backup successful (User: postgres)!"
else
    echo "⚠️ Failed with user 'postgres'. Trying 'servicetextpro'..."
    # Try with 'servicetextpro' user
    if pg_dump -h localhost -U servicetextpro -d servicetext_pro -F c -f "${BACKUP_FILE}"; then
        echo "✅ Backup successful (User: servicetextpro)!"
    else
        echo "❌ Backup failed. Please verify your password in this script."
        exit 1
    fi
fi

echo "Backup saved to: ${BACKUP_FILE}"
