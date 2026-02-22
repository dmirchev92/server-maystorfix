/**
 * Session Health Check
 * 
 * Checks if the Google Play Console session is still valid.
 * Designed to run via cron every 6 hours.
 * 
 * Usage: node session-check.js
 * 
 * Exit codes:
 *   0 = session valid
 *   1 = session expired
 *   2 = error (couldn't check)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

const SESSION_DIR = path.join(__dirname, 'google-session');
const STORAGE_STATE = path.join(SESSION_DIR, 'storage-state.json');
const STATUS_FILE = path.join(__dirname, 'session-status.json');

const TESTERS_URL = 'https://play.google.com/console/u/0/developers/7488780334730040495/app/4974916880619958219/tracks/4698605814004162380?tab=testers';

// Database connection for logging
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'servicetext_pro',
  user: 'postgres',
  password: 'C58acfd5c!',
});

async function checkSession() {
  let browser = null;
  const timestamp = new Date().toISOString();

  try {
    // Check if storage state exists
    if (!fs.existsSync(STORAGE_STATE)) {
      const status = { valid: false, reason: 'NO_STORAGE_STATE', checkedAt: timestamp };
      fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
      console.log(`❌ [${timestamp}] No storage-state.json found`);
      process.exit(1);
    }

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process,SameSiteByDefaultCookies,ThirdPartyCookieDeprecation',
        '--disable-site-isolation-trials',
      ],
    });

    const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      storageState: STORAGE_STATE,
      userAgent: CHROME_USER_AGENT,
      extraHTTPHeaders: {
        'Google-Accounts-Check-OAuth-Login': 'true',
      },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const page = await context.newPage();

    // Intercept Google API requests and inject cookies + SAPISIDHASH auth
    const state = JSON.parse(fs.readFileSync(STORAGE_STATE, 'utf8'));
    const googleCookies = state.cookies.filter(c => c.domain.includes('google.com'));
    const cookieHeader = googleCookies.map(c => c.name + '=' + c.value).join('; ');
    const sapisid = googleCookies.find(c => c.name === 'SAPISID');
    
    await page.route('**clients6.google.com/**', async (route, request) => {
      const headers = { ...request.headers() };
      headers['cookie'] = cookieHeader;
      if (sapisid) {
        const now = Math.floor(Date.now() / 1000);
        const hash = crypto.createHash('sha1').update(now + ' ' + sapisid.value + ' https://play.google.com').digest('hex');
        headers['authorization'] = 'SAPISIDHASH ' + now + '_' + hash;
      }
      headers['x-goog-authuser'] = '0';
      headers['origin'] = 'https://play.google.com';
      await route.continue({ headers });
    });

    // Navigate to Play Console
    console.log(`[${timestamp}] Checking Google Play Console session...`);
    await page.goto(TESTERS_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    const currentUrl = page.url();

    if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
      // Session expired
      const status = {
        valid: false,
        reason: 'SESSION_EXPIRED',
        redirectedTo: currentUrl,
        checkedAt: timestamp,
      };
      fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));

      // Log to database
      await pool.query(
        `INSERT INTO beta_session_checks (checked_at, is_valid, reason) VALUES (NOW(), false, 'SESSION_EXPIRED')
         ON CONFLICT DO NOTHING`
      ).catch(() => {});

      console.log(`❌ [${timestamp}] SESSION EXPIRED - redirected to Google sign-in`);
      console.log(`   Re-export cookies from Chrome and upload via: https://snapfix.bg/beta/api/upload-cookies`);

      await browser.close();
      await pool.end();
      process.exit(1);

    } else {
      // Session valid - save updated cookies back
      const updatedState = await context.storageState();
      fs.writeFileSync(STORAGE_STATE, JSON.stringify(updatedState, null, 2));

      const status = {
        valid: true,
        reason: 'OK',
        checkedAt: timestamp,
        cookiesUpdated: true,
      };
      fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));

      // Log to database
      await pool.query(
        `INSERT INTO beta_session_checks (checked_at, is_valid, reason) VALUES (NOW(), true, 'OK')
         ON CONFLICT DO NOTHING`
      ).catch(() => {});

      console.log(`✅ [${timestamp}] Session is VALID - cookies refreshed and saved back`);

      await browser.close();
      await pool.end();
      process.exit(0);
    }

  } catch (error) {
    const status = {
      valid: false,
      reason: 'CHECK_ERROR',
      error: error.message,
      checkedAt: timestamp,
    };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));

    console.error(`⚠️ [${timestamp}] Error checking session:`, error.message);

    if (browser) await browser.close().catch(() => {});
    await pool.end().catch(() => {});
    process.exit(2);
  }
}

checkSession();
