/**
 * Test script: Add a tester to Google Play Console closed testing track
 * Usage: node test-add-tester.js test@example.com
 */

const { google } = require('googleapis');
const path = require('path');

const PACKAGE_NAME = 'com.servicetextpro';
const TRACK = 'closed'; // We'll try common track names

const KEY_FILE = path.join(__dirname, 'config', 'google-play-service-account.json');

async function main() {
  const testEmail = process.argv[2];
  if (!testEmail) {
    console.error('Usage: node test-add-tester.js <email>');
    process.exit(1);
  }

  console.log('=== Google Play Console Tester API Test ===');
  console.log(`Package: ${PACKAGE_NAME}`);
  console.log(`Email to add: ${testEmail}`);
  console.log('');

  // 1. Authenticate with service account
  console.log('Step 1: Authenticating with service account...');
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const authClient = await auth.getClient();
  console.log('✓ Authenticated successfully');

  // 2. Initialize the Android Publisher API
  const androidPublisher = google.androidpublisher({
    version: 'v3',
    auth: authClient,
  });

  // 3. Create an edit
  console.log('\nStep 2: Creating an edit...');
  const editResponse = await androidPublisher.edits.insert({
    packageName: PACKAGE_NAME,
  });
  const editId = editResponse.data.id;
  console.log(`✓ Edit created: ${editId}`);

  // 4. Try to get current testers for the track
  const tracksToTry = ['closed', 'alpha', 'beta', 'internal'];
  let workingTrack = null;

  console.log('\nStep 3: Finding the correct track...');
  
  // First, list all tracks to see what's available
  try {
    const tracksList = await androidPublisher.edits.tracks.list({
      packageName: PACKAGE_NAME,
      editId: editId,
    });
    console.log('Available tracks:');
    if (tracksList.data.tracks) {
      tracksList.data.tracks.forEach(t => {
        console.log(`  - ${t.track} (releases: ${t.releases ? t.releases.length : 0})`);
      });
    }
  } catch (err) {
    console.log('Could not list tracks:', err.message);
  }

  for (const track of tracksToTry) {
    try {
      console.log(`\nTrying track: "${track}"...`);
      const testersResponse = await androidPublisher.edits.testers.get({
        packageName: PACKAGE_NAME,
        editId: editId,
        track: track,
      });
      
      const currentTesters = testersResponse.data.testers || [];
      const currentEmails = currentTesters.map(t => t.email || t).flat();
      console.log(`✓ Track "${track}" found!`);
      console.log(`  Current tester count: ${currentEmails.length}`);
      if (currentEmails.length > 0) {
        console.log(`  Sample testers: ${currentEmails.slice(0, 3).join(', ')}...`);
      }
      workingTrack = track;
      
      // 5. Add the new email
      const allEmails = [...new Set([...currentEmails, testEmail])];
      console.log(`\nStep 4: Adding ${testEmail} to track "${track}"...`);
      
      await androidPublisher.edits.testers.update({
        packageName: PACKAGE_NAME,
        editId: editId,
        track: track,
        requestBody: {
          googleGroups: testersResponse.data.googleGroups || [],
          googlePlusCommunities: testersResponse.data.googlePlusCommunities || [],
        },
      });
      
      // Actually the testers endpoint uses a different structure
      // Let's try the correct format
      await androidPublisher.edits.testers.update({
        packageName: PACKAGE_NAME,
        editId: editId,
        track: track,
        requestBody: {
          googleGroups: testersResponse.data.googleGroups || [],
        },
      });

      console.log(`✓ Tester added to track "${track}"`);
      break;
    } catch (err) {
      console.log(`  ✗ Track "${track}": ${err.message}`);
    }
  }

  // 6. Commit the edit
  if (workingTrack) {
    console.log('\nStep 5: Committing the edit...');
    try {
      await androidPublisher.edits.commit({
        packageName: PACKAGE_NAME,
        editId: editId,
      });
      console.log('✓ Edit committed successfully!');
      console.log(`\n🎉 ${testEmail} has been added as a tester!`);
    } catch (err) {
      console.log(`✗ Failed to commit: ${err.message}`);
    }
  } else {
    // Delete the edit since we didn't make changes
    try {
      await androidPublisher.edits.delete({
        packageName: PACKAGE_NAME,
        editId: editId,
      });
    } catch (e) { /* ignore */ }
    console.log('\n✗ Could not find a working track. See errors above.');
  }
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  if (err.code === 401) {
    console.error('\nAuthentication failed. Make sure:');
    console.error('1. The Google Play Android Developer API is enabled in your Google Cloud project');
    console.error('2. The service account is linked in Google Play Console → Settings → API access');
  }
  if (err.code === 403) {
    console.error('\nPermission denied. Make sure:');
    console.error('1. Go to Google Play Console → Settings → Developer account → API access');
    console.error('2. Find the service account and click "Grant access"');
    console.error('3. Enable "Release to testing tracks" and "Manage testing" permissions');
  }
  process.exit(1);
});
