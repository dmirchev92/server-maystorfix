/**
 * One-time script: Manually log into Google Play Console and save the session.
 * Run this ONCE on a machine with a display (or via VNC/X11 forwarding).
 * 
 * Usage: node save-session.js
 * 
 * This will open a browser window where you log into your Google account.
 * Once logged in and you see the Play Console, close the browser.
 * The session cookies will be saved to ./google-session/
 */

const { chromium } = require('playwright');
const path = require('path');

const SESSION_DIR = path.join(__dirname, 'google-session');
const PLAY_CONSOLE_URL = 'https://play.google.com/console';

async function saveSession() {
  console.log('=== Google Play Console Session Saver ===');
  console.log('');
  console.log('A browser window will open.');
  console.log('1. Log into your Google account');
  console.log('2. Make sure you can see the Play Console dashboard');
  console.log('3. Then close the browser window');
  console.log('');
  console.log(`Session will be saved to: ${SESSION_DIR}`);
  console.log('');

  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    channel: 'chrome',  // Use your real Chrome browser, NOT Playwright's Chromium
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = context.pages()[0] || await context.newPage();
  
  await page.goto(PLAY_CONSOLE_URL);
  
  console.log('Browser opened. Please log in...');
  console.log('(Close the browser window when done)');

  // Wait for the browser to be closed by the user
  await new Promise((resolve) => {
    context.on('close', resolve);
  });

  console.log('');
  console.log('✅ Session saved successfully!');
  console.log(`   Location: ${SESSION_DIR}`);
  console.log('');
  console.log('You can now run the automation server.');
}

saveSession().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
