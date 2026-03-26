/**
 * Alternative session setup: Load cookies exported from your real Chrome browser.
 * 
 * Instructions:
 * 1. Install "Cookie-Editor" Chrome extension: https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm
 * 2. Go to https://play.google.com/console in your Chrome (make sure you're logged in)
 * 3. Click the Cookie-Editor extension icon
 * 4. Click "Export" (bottom of the popup) - this copies all cookies as JSON
 * 5. Paste the JSON into a file called "cookies.json" in this folder
 * 6. Run: node load-cookies.js
 * 7. Upload the google-session folder to the server
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, 'google-session');
const COOKIES_FILE = path.join(__dirname, 'cookies.json');

async function loadCookies() {
  console.log('=== Cookie Loader for Google Play Console ===\n');

  if (!fs.existsSync(COOKIES_FILE)) {
    console.error('❌ cookies.json not found!');
    console.error('');
    console.error('Follow these steps:');
    console.error('1. Install "Cookie-Editor" Chrome extension');
    console.error('   https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm');
    console.error('2. Go to https://play.google.com/console in Chrome (logged in)');
    console.error('3. Click Cookie-Editor icon → Export (copies JSON to clipboard)');
    console.error('4. Create cookies.json in this folder and paste the JSON');
    console.error('5. Run this script again');
    process.exit(1);
  }

  const rawCookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
  console.log(`Found ${rawCookies.length} cookies in cookies.json`);

  // Convert Cookie-Editor format to Playwright format
  const cookies = rawCookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    expires: c.expirationDate ? Math.floor(c.expirationDate) : -1,
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
    sameSite: c.sameSite === 'no_restriction' ? 'None' : 
              c.sameSite === 'lax' ? 'Lax' : 
              c.sameSite === 'strict' ? 'Strict' : 'Lax',
  }));

  // Create session directory
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  // Launch browser, add cookies, verify they work
  console.log('Launching browser to verify cookies...');
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  // Add cookies
  await context.addCookies(cookies);
  console.log(`✅ Added ${cookies.length} cookies to browser context`);

  // Verify by navigating to Play Console
  const page = await context.newPage();
  console.log('Verifying session by loading Play Console...');
  
  await page.goto('https://play.google.com/console', { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });

  await page.waitForTimeout(3000);
  const url = page.url();
  const title = await page.title();

  console.log(`Page URL: ${url}`);
  console.log(`Page title: ${title}`);

  if (url.includes('accounts.google.com') || url.includes('signin')) {
    console.error('');
    console.error('❌ Session verification FAILED - cookies may be expired or incomplete.');
    console.error('Make sure you export cookies while logged into Play Console.');
    await browser.close();
    process.exit(1);
  }

  // Save the storage state (cookies + localStorage)
  const storageStatePath = path.join(SESSION_DIR, 'storage-state.json');
  await context.storageState({ path: storageStatePath });
  
  console.log('');
  console.log('✅ Session verified and saved successfully!');
  console.log(`   Storage state: ${storageStatePath}`);
  console.log('');
  console.log('Next step: Upload to server:');
  console.log(`   scp -r google-session snapfix@91.98.138.38:/var/www/servicetextpro/beta-tester-automation/`);

  await browser.close();
}

loadCookies().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
