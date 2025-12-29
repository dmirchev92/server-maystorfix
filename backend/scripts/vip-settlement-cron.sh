#!/bin/bash
# VIP Settlement Cron Script
# Runs every Sunday at 22:00 (Europe/Sofia timezone) to process VIP auction winners
# Add to crontab: 0 22 * * 0 /var/www/servicetextpro/backend/scripts/vip-settlement-cron.sh

# Set timezone
export TZ="Europe/Sofia"

# Configuration
API_URL="http://localhost:3001/api/v1/vip/settle"
ADMIN_KEY="vip-settlement-scheduler-cf440709907e9a11a6039d7285db3f3f"
LOG_FILE="/var/www/servicetextpro/backend/logs/vip-settlement.log"

# Create logs directory if it doesn't exist
mkdir -p /var/www/servicetextpro/backend/logs

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting VIP settlement process..."

# Make the API call
RESPONSE=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "x-scheduler-key: $ADMIN_KEY" \
    --max-time 60)

# Check if curl succeeded
if [ $? -ne 0 ]; then
    log "ERROR: Failed to connect to API"
    exit 1
fi

# Log the response
log "API Response: $RESPONSE"

# Check if response contains success
if echo "$RESPONSE" | grep -q '"success":true'; then
    log "VIP settlement completed successfully"
    exit 0
else
    log "ERROR: VIP settlement failed"
    exit 1
fi
