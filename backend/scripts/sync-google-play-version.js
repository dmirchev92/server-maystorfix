/**
 * Sync Google Play Version to Backend Config
 * 
 * This script checks Google Play for the currently published version
 * and updates the backend config file automatically.
 * 
 * Run via cron every 30 minutes:
 * */30 * * * * cd /var/www/servicetextpro/backend && node scripts/sync-google-play-version.js
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../config/app-version.json');
const PACKAGE_NAME = 'com.servicetextpro';

// Google Play API credentials
// You need to set up a service account in Google Cloud Console
// and download the credentials JSON file
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY || 
  '/var/www/servicetextpro/backend/config/google-play-service-account.json';

async function getPublishedVersion() {
  try {
    // Authenticate with Google Play API
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_KEY,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const androidPublisher = google.androidpublisher({
      version: 'v3',
      auth: auth,
    });

    // Get the production track (where published versions are)
    const response = await androidPublisher.edits.tracks.get({
      packageName: PACKAGE_NAME,
      editId: 'production', // or use edits.insert() to create an edit first
      track: 'production',
    });

    // Get the latest release
    const releases = response.data.releases || [];
    const latestRelease = releases.find(r => r.status === 'completed');

    if (latestRelease && latestRelease.versionCodes) {
      // Get version name from the latest version code
      const versionCode = Math.max(...latestRelease.versionCodes);
      
      // You might need to maintain a mapping of versionCode to versionName
      // Or fetch it from the APK listing
      const apkResponse = await androidPublisher.edits.apks.list({
        packageName: PACKAGE_NAME,
        editId: 'production',
      });

      const apk = apkResponse.data.apks?.find(a => a.versionCode === versionCode);
      return apk?.versionName || null;
    }

    return null;
  } catch (error) {
    console.error('Error fetching Google Play version:', error.message);
    return null;
  }
}

async function updateBackendConfig(newVersion) {
  try {
    // Read current config
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

    // Check if version changed
    if (config.latestVersion === newVersion) {
      console.log(`✅ Version already up to date: ${newVersion}`);
      return false;
    }

    // Update version
    config.latestVersion = newVersion;

    // Update release notes based on version
    const releaseNotes = getReleaseNotes(newVersion);
    if (releaseNotes) {
      config.releaseNotes = releaseNotes;
    }

    // Write updated config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');

    console.log(`🎉 Updated backend config to version ${newVersion}`);
    return true;
  } catch (error) {
    console.error('Error updating backend config:', error.message);
    return false;
  }
}

function getReleaseNotes(version) {
  // You can maintain release notes here or in a separate file
  const notes = {
    '1.29.0': {
      bg: 'Версия 1.29.0 - Актуализирани цени и тестов период:\n• Актуализирани цени за Normal план (1,400 € годишно)\n• Безплатен тестов период - всички функции достъпни\n• Подобрена система за отстъпки\n• Оптимизации и подобрения',
      en: 'Version 1.29.0 - Updated Pricing & Testing Period:\n• Updated Normal plan pricing (1,400 € yearly)\n• Free testing period - all features available\n• Improved discount system\n• Optimizations and improvements'
    },
    // Add more versions as needed
  };

  return notes[version] || null;
}

async function main() {
  console.log('🔍 Checking Google Play for published version...');

  const publishedVersion = await getPublishedVersion();

  if (!publishedVersion) {
    console.log('⚠️  Could not fetch published version from Google Play');
    return;
  }

  console.log(`📱 Google Play published version: ${publishedVersion}`);

  const updated = await updateBackendConfig(publishedVersion);

  if (updated) {
    console.log('✅ Backend config synchronized with Google Play');
  }
}

main();
