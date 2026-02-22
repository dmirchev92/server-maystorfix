/**
 * Playwright automation: Add a tester email to Google Play Console closed testing track.
 * Uses saved cookies (from load-cookies.js).
 * 
 * Flow:
 * 1. Navigate to closed testing testers tab
 * 2. JS-click "Edit email list" button to open the modal
 * 3. Type email into the "Добавете имейл адреси" input
 * 4. Press Enter to add it to the list
 * 5. Click "Запазване на промените" in the modal
 * 6. Click outer "Запазване" on the main page
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SESSION_DIR = path.join(__dirname, 'google-session');
const STORAGE_STATE = path.join(SESSION_DIR, 'storage-state.json');

// Google Play Console URL for your closed testing testers tab
const TESTERS_URL = 'https://play.google.com/console/u/0/developers/7488780334730040495/app/4974916880619958219/tracks/4698605814004162380?tab=testers';

/**
 * Add a single email to the Google Play Console tester list
 * @param {string} email - Email address to add
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function addTester(email) {
  let browser = null;
  
  try {
    console.log(`[Playwright] Adding tester: ${email}`);
    
    // Check if storage state exists
    if (!fs.existsSync(STORAGE_STATE)) {
      throw new Error('SESSION_NOT_FOUND: No session found. Run load-cookies.js first and upload google-session folder.');
    }
    
    // Launch browser and load saved cookies/session
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

    // Hide automation flags
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const page = await context.newPage();

    // Intercept Google API requests and inject cookies + SAPISIDHASH auth
    // (Chromium doesn't send cookies to clients6.google.com cross-origin)
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

    // Step 1: Navigate to the testers tab
    console.log('[Playwright] Navigating to testers page...');
    await page.goto(TESTERS_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);
    
    // Check if session expired
    const currentUrl = page.url();
    console.log(`[Playwright] Current URL after navigation: ${currentUrl}`);
    if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
      await page.screenshot({ path: path.join(__dirname, 'debug-session-expired.png') }).catch(() => {});
      throw new Error('SESSION_EXPIRED: Google session has expired. Re-export cookies and upload.');
    }

    console.log('[Playwright] Page loaded. Opening email list editor...');

    // Step 2: JS-click the "Edit email list" button (hidden in nested scroll container)
    const clicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        const aria = btn.getAttribute('aria-label') || '';
        if (aria.includes('tester') && aria.includes('имейли')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (!clicked) {
      try { await page.screenshot({ path: path.join(__dirname, 'debug-no-edit-btn.png') }); } catch(e) {}
      throw new Error('Could not find the "Edit email list" button.');
    }

    console.log('[Playwright] Clicked edit button. Waiting for modal...');

    // Step 3: Wait for the email input to appear (modal open indicator)
    try {
      await page.waitForSelector('input[aria-label="Добавете имейл адреси"]', { timeout: 10000 });
    } catch(e) {
      await page.waitForTimeout(3000);
    }

    const emailInput = await page.$('input[aria-label="Добавете имейл адреси"]') || await page.$('input[type="email"]');
    if (!emailInput) {
      try { await page.screenshot({ path: path.join(__dirname, 'debug-no-email-input.png') }); } catch(e) {}
      throw new Error('Could not find the email input field in the modal.');
    }

    // Count emails before adding
    const countBefore = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).filter(b => 
        (b.getAttribute('aria-label') || '').includes('Премахване на имейл')).length;
    });
    console.log(`[Playwright] Emails before: ${countBefore}`);

    // Step 4: Type email character-by-character (required for Angular change detection)
    console.log(`[Playwright] Typing email: ${email}`);
    await emailInput.click();
    await emailInput.type(email, { delay: 30 });
    await page.waitForTimeout(500);
    
    // Press Enter to add email to the list
    console.log('[Playwright] Pressing Enter to add email...');
    await emailInput.press('Enter');
    await page.waitForTimeout(3000);

    // Verify the email was actually added (count increased)
    const countAfter = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).filter(b => 
        (b.getAttribute('aria-label') || '').includes('Премахване на имейл')).length;
    });
    console.log(`[Playwright] Emails after: ${countAfter} (${countBefore} -> ${countAfter})`);
    
    if (countAfter <= countBefore) {
      // Email might already be in the list - check if it exists
      const alreadyExists = await page.evaluate((em) => {
        return Array.from(document.querySelectorAll('button')).some(b => {
          const label = b.getAttribute('aria-label') || '';
          return label.includes('Премахване на имейл') && label.toLowerCase().includes(em.toLowerCase());
        });
      }, email);
      
      if (alreadyExists) {
        console.log('[Playwright] Email already in tester list, closing modal...');
        // Close the modal without saving (click Cancel/X or press Escape)
        await page.keyboard.press('Escape');
        await page.waitForTimeout(2000);
        await browser.close();
        return { success: true, message: `${email} is already in the tester list.` };
      }
      
      try { await page.screenshot({ path: path.join(__dirname, 'debug-email-not-added.png') }); } catch(e) {}
      throw new Error('Email was not added to the list. Count did not increase.');
    }

    // Step 5: Click "Запазване на промените" (Save changes) in the modal
    // The button should now be enabled since we added an email
    console.log('[Playwright] Clicking "Save changes" in modal...');
    
    // Scroll button into view and click via Playwright
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent.trim() === 'Запазване на промените' && b.offsetParent);
      if (btn) btn.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(500);
    
    try {
      await page.locator('button:has-text("Запазване на промените")').click({ timeout: 10000 });
      console.log('[Playwright] Modal save clicked via locator');
    } catch(e) {
      // Fallback: try mouse click at coordinates
      console.log('[Playwright] Locator click failed, trying mouse click...');
      const pos = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent.trim() === 'Запазване на промените' && b.offsetParent && !b.disabled);
        if (!btn) return null;
        btn.scrollIntoView({ block: 'center' });
        const r = btn.getBoundingClientRect();
        return { x: r.x + r.width/2, y: r.y + r.height/2 };
      });
      if (pos) {
        await page.waitForTimeout(300);
        await page.mouse.click(pos.x, pos.y);
        console.log(`[Playwright] Mouse clicked at ${pos.x}, ${pos.y}`);
      } else {
        throw new Error('Save button not found or disabled');
      }
    }

    await page.waitForTimeout(3000);

    // Step 6: Handle the confirmation dialog
    // After clicking save, a dialog appears: "Наистина ли искате да запазите промените в списъка с имейли?"
    // with buttons "Отказ" (Cancel) and "Запазване" (Save)
    console.log('[Playwright] Checking for confirmation dialog...');
    
    const hasConfirmDialog = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Наистина ли искате да запазите промените');
    });

    if (hasConfirmDialog) {
      console.log('[Playwright] Confirmation dialog found. Clicking "Запазване" (yes-button)...');
      
      // The confirmation dialog's Save button has debug-id="yes-button"
      try {
        await page.locator('[debug-id="yes-button"]').click({ timeout: 5000 });
        console.log('[Playwright] Confirmation yes-button clicked');
      } catch(e) {
        console.log('[Playwright] Locator click failed, trying JS click...');
        await page.evaluate(() => {
          const btn = document.querySelector('[debug-id="yes-button"]');
          if (btn) btn.click();
        });
        console.log('[Playwright] JS click on yes-button sent');
      }
      
      await page.waitForTimeout(8000);
      console.log('[Playwright] Confirmation dialog handled');
    } else {
      console.log('[Playwright] No confirmation dialog found');
    }

    // Check for errors: "Промените ви не бяха запазени" or "Този имейл адрес не съществува"
    const saveError = await page.evaluate(() => {
      const text = document.body.innerText;
      if (text.includes('Промените ви не бяха запазени') || text.includes('не съществува')) {
        return 'INVALID_EMAIL: Google says this email address does not exist.';
      }
      return null;
    });

    if (saveError) {
      console.log(`[Playwright] ❌ Save error: ${saveError}`);
      await browser.close();
      return { success: false, message: saveError };
    }

    // Check if modal closed (success)
    const modalClosed = await page.evaluate(() => {
      return !Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent.trim() === 'Запазване на промените' && b.offsetParent);
    });
    console.log(`[Playwright] Modal closed: ${modalClosed}`);

    if (!modalClosed) {
      const pageErrors = await page.evaluate(() => {
        const errorEls = document.querySelectorAll('[class*="error"], [class*="snackbar"]');
        return Array.from(errorEls).map(e => e.textContent.trim()).filter(t => t.length > 5 && t.length < 300);
      });
      console.log(`[Playwright] ❌ Modal still open. Errors: ${JSON.stringify(pageErrors)}`);
      await page.screenshot({ path: path.join(__dirname, 'debug-modal-still-open.png') }).catch(() => {});
      await browser.close();
      return { success: false, message: 'Save failed - modal did not close. Email may not exist or is invalid.' };
    }

    // Step 7: Click the outer "Запазване" button on the main page
    console.log('[Playwright] Modal closed. Clicking outer "Save" button...');
    await page.waitForTimeout(2000);
    
    const outerSaveClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent.trim() === 'Запазване' && b.offsetParent && !b.disabled);
      if (btn) { btn.click(); return true; }
      return false;
    });
    
    if (outerSaveClicked) {
      console.log('[Playwright] Outer save clicked');
      await page.waitForTimeout(5000);
    } else {
      console.log('[Playwright] Outer save not needed or disabled');
    }
    
    console.log(`[Playwright] ✅ Successfully added ${email}`);
    
    // Save refreshed cookies so next run doesn't expire
    try {
      await context.storageState({ path: STORAGE_STATE });
      console.log('[Playwright] Cookies refreshed and saved');
    } catch(e) { /* ignore */ }
    
    await browser.close();
    return { success: true, message: `Successfully added ${email} to tester list` };
    
  } catch (error) {
    console.error(`[Playwright] ❌ Error: ${error.message}`);
    if (browser) {
      // Try to save cookies even on error (session might still be valid)
      try {
        const contexts = browser.contexts();
        if (contexts.length > 0) {
          await contexts[0].storageState({ path: STORAGE_STATE });
        }
      } catch(e) { /* ignore */ }
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
    return { success: false, message: error.message };
  }
}

module.exports = { addTester };

// Allow running directly for testing
if (require.main === module) {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node add-tester.js <email>');
    process.exit(1);
  }
  addTester(email).then(result => {
    console.log('Result:', JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
