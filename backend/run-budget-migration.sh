#!/bin/bash
# Run budget column migration
sudo -u postgres psql -d servicetext_pro -f migrations/028_change_budget_to_text.sql
echo "Migration completed!"
