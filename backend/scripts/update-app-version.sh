#!/bin/bash
# Simple script to update app version in backend config
# Usage: ./update-app-version.sh 1.29.0

VERSION=$1
CONFIG_FILE="/var/www/servicetextpro/backend/config/app-version.json"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.29.0"
  exit 1
fi

# Update the version in the config file
sed -i "s/\"latestVersion\": \".*\"/\"latestVersion\": \"$VERSION\"/" "$CONFIG_FILE"

echo "✅ Updated app-version.json to version $VERSION"
echo "📱 Users will now see update notification for version $VERSION"
