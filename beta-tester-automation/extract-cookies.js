/**
 * Extract ALL cookies (including httpOnly) from a running Chrome instance.
 * 
 * Instructions:
 * 1. CLOSE all Chrome windows completely
 * 2. Open PowerShell and run:
 *    & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
 * 3. In the Chrome window that opens, go to https://play.google.com/console and make sure you're logged in
 * 4. Then in ANOTHER PowerShell window, run:
 *    cd D:\newtry1\ServiceTextPro_FRESH\beta-tester-automation
 *    node extract-cookies.js
 * 5. Upload the google-session folder to the server:
 *    scp -r google-session snapfix@46.224.11.139:/var/www/servicetextpro/beta-tester-automation/
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, 'google-session');

(async () => {
  console.log('=== Chrome Cookie Extractor ===\n');
  console.log('Connecting to Chrome on port 9222...');
  
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
  } catch (e) {
    console.error('❌ Could not connect to Chrome!');
    console.error('');
    console.error('Make sure you:');
    console.error('1. CLOSED all Chrome windows');
    console.error('2. Opened Chrome with: & "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222');
    console.error('3. Navigated to https://play.google.com/console and logged in');
    console.error('');
    console.error('Error:', e.message);
    process.exit(1);
  }

  console.log('✅ Connected to Chrome');
  
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.error('❌ No browser contexts found');
    process.exit(1);
  }

  const context = contexts[0];
  const cookies = await context.cookies();
  
  console.log(`Found ${cookies.length} total cookies`);
  
  // Check for critical cookies
  const criticalNames = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', 'OSID'];
  const found = criticalNames.filter(name => cookies.some(c => c.name === name));
  const missing = criticalNames.filter(name => !cookies.some(c => c.name === name));
  
  console.log(`Critical cookies found: ${found.join(', ')}`);
  if (missing.length > 0) {
    console.log(`⚠️  Missing: ${missing.join(', ')} (may still work with __Secure- variants)`);
  }

  // Filter to Google-related cookies only
  const googleCookies = cookies.filter(c => 
    c.domain.includes('google.com') || c.domain.includes('googleapis.com')
  );
  console.log(`Google cookies: ${googleCookies.length}`);

  // Save as storage state
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  const storageState = {
    cookies: googleCookies,
    origins: []
  };

  const storageStatePath = path.join(SESSION_DIR, 'storage-state.json');
  fs.writeFileSync(storageStatePath, JSON.stringify(storageState, null, 2));
  
  console.log('');
  console.log(`✅ Saved ${googleCookies.length} cookies to ${storageStatePath}`);
  console.log('');
  console.log('Now upload to the server:');
  console.log('  scp google-session/storage-state.json snapfix@46.224.11.139:/var/www/servicetextpro/beta-tester-automation/google-session/');
  
  // Don't close the browser - it's the user's Chrome!
  browser.disconnect();
  console.log('\nDone! Chrome is still running.');
})();
