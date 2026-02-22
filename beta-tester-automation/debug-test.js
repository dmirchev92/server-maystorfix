const { chromium } = require('playwright');
const path = require('path');
const STORAGE_STATE = path.join(__dirname, 'google-session', 'storage-state.json');
const TESTERS_URL = 'https://play.google.com/console/u/0/developers/7488780334730040495/app/4974916880619958219/tracks/4698605814004162380?tab=testers';

const EMAIL = process.argv[2] || 's.r.stavrev@gmail.com';

(async () => {
  const browser = await chromium.launch({ 
    headless: true, 
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ]
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1600 }, storageState: STORAGE_STATE });
  
  // Hide automation flags
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  const page = await context.newPage();

  // Track ALL POST requests (not analytics)
  page.on('response', res => {
    if (res.request().method() === 'POST' && !res.url().includes('analytics') && !res.url().includes('logging') && !res.url().includes('feedback') && !res.url().includes('featureEvents') && !res.url().includes('inbox') && !res.url().includes('leafblower')) {
      console.log('POST:', res.status(), res.url().substring(0, 120));
    }
  });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Adding email:', EMAIL);
  await page.goto(TESTERS_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Open modal via JS click
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      const aria = b.getAttribute('aria-label') || '';
      if (aria.includes('tester') && aria.includes('\u0438\u043c\u0435\u0439\u043b\u0438')) { b.click(); return; }
    }
  });
  await page.waitForSelector('input[aria-label="\u0414\u043e\u0431\u0430\u0432\u0435\u0442\u0435 \u0438\u043c\u0435\u0439\u043b \u0430\u0434\u0440\u0435\u0441\u0438"]', { timeout: 10000 });
  console.log('Modal opened');

  // Type and Enter
  const inp = await page.$('input[aria-label="\u0414\u043e\u0431\u0430\u0432\u0435\u0442\u0435 \u0438\u043c\u0435\u0439\u043b \u0430\u0434\u0440\u0435\u0441\u0438"]');
  await inp.click();
  await inp.type(EMAIL, { delay: 50 });
  await page.waitForTimeout(500);
  await inp.press('Enter');
  await page.waitForTimeout(3000);

  // Step 1: Click save button in modal
  console.log('\nClicking save button...');
  await page.locator('button:has-text("\u0417\u0430\u043f\u0430\u0437\u0432\u0430\u043d\u0435 \u043d\u0430 \u043f\u0440\u043e\u043c\u0435\u043d\u0438\u0442\u0435")').click({ timeout: 5000 });
  await page.waitForTimeout(3000);
  
  try { await page.screenshot({ path: '/tmp/debug-after-save-click.png', timeout: 3000 }); } catch(e) {}

  // Step 2: Analyze the confirmation dialog
  const dialogInfo = await page.evaluate(() => {
    const hasConfirmText = document.body.innerText.includes('\u041d\u0430\u0438\u0441\u0442\u0438\u043d\u0430 \u043b\u0438 \u0438\u0441\u043a\u0430\u0442\u0435');
    
    // Find ALL buttons with text containing "\u0417\u0430\u043f\u0430\u0437\u0432\u0430\u043d\u0435"
    const allBtns = Array.from(document.querySelectorAll('button'))
      .filter(b => b.textContent.includes('\u0417\u0430\u043f\u0430\u0437\u0432\u0430\u043d\u0435') && b.offsetParent)
      .map((b, i) => {
        const r = b.getBoundingClientRect();
        // Get parent info to distinguish dialog vs modal vs page
        let container = '';
        let el = b.parentElement;
        while (el && el !== document.body) {
          if (el.getAttribute('role') === 'dialog' || el.tagName === 'MAT-DIALOG-CONTAINER') {
            container = 'dialog';
            break;
          }
          if (el.classList.contains('cdk-overlay-pane')) {
            container = 'overlay';
            break;
          }
          el = el.parentElement;
        }
        return {
          index: i,
          text: b.textContent.trim(),
          disabled: b.disabled,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          classes: (b.className || '').substring(0, 80),
          container: container || 'page',
          ariaLabel: b.getAttribute('aria-label') || '',
        };
      });
    
    return { hasConfirmText, buttons: allBtns };
  });
  console.log('Confirmation dialog:', JSON.stringify(dialogInfo, null, 2));

  // Step 3: Click the confirmation "\u0417\u0430\u043f\u0430\u0437\u0432\u0430\u043d\u0435" button
  // It should be a filled/primary button in the confirmation overlay
  if (dialogInfo.hasConfirmText) {
    // Find the exact "\u0417\u0430\u043f\u0430\u0437\u0432\u0430\u043d\u0435" button (not "\u0417\u0430\u043f\u0430\u0437\u0432\u0430\u043d\u0435 \u043d\u0430 \u043f\u0440\u043e\u043c\u0435\u043d\u0438\u0442\u0435")
    // Try clicking with Playwright locator - the exact match
    console.log('\nTrying to click confirmation button...');
    
    // Method 1: JS click the button with mat-flat-button class (primary/filled style)
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      // Find button that says exactly "\u0417\u0430\u043f\u0430\u0437\u0432\u0430\u043d\u0435" (not "\u0417\u0430\u043f\u0430\u0437\u0432\u0430\u043d\u0435 \u043d\u0430 \u043f\u0440\u043e\u043c\u0435\u043d\u0438\u0442\u0435")
      // and is inside a dialog/overlay
      for (const b of btns) {
        if (b.textContent.trim() !== '\u0417\u0430\u043f\u0430\u0437\u0432\u0430\u043d\u0435') continue;
        if (!b.offsetParent) continue;
        // Check if it's in the confirmation dialog (small popup)
        let el = b.parentElement;
        let inDialog = false;
        while (el) {
          if (el.getAttribute('role') === 'dialog' || el.tagName === 'MAT-DIALOG-CONTAINER' || el.classList.contains('cdk-overlay-pane')) {
            inDialog = true;
            break;
          }
          el = el.parentElement;
        }
        if (inDialog) {
          b.click();
          return { clicked: true, text: b.textContent.trim(), method: 'dialog-button' };
        }
      }
      // Fallback: click any exact "\u0417\u0430\u043f\u0430\u0437\u0432\u0430\u043d\u0435" button
      const exactBtn = btns.find(b => b.textContent.trim() === '\u0417\u0430\u043f\u0430\u0437\u0432\u0430\u043d\u0435' && b.offsetParent);
      if (exactBtn) {
        exactBtn.click();
        return { clicked: true, text: exactBtn.textContent.trim(), method: 'exact-text-fallback' };
      }
      return { clicked: false };
    });
    console.log('Click result:', JSON.stringify(clicked));
    await page.waitForTimeout(8000);
    
    try { await page.screenshot({ path: '/tmp/debug-after-confirm.png', timeout: 3000 }); } catch(e) {}
    
    // Check final state
    const finalState = await page.evaluate(() => {
      const hasModal = !!Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent.trim() === '\u0417\u0430\u043f\u0430\u0437\u0432\u0430\u043d\u0435 \u043d\u0430 \u043f\u0440\u043e\u043c\u0435\u043d\u0438\u0442\u0435' && b.offsetParent);
      const hasConfirm = document.body.innerText.includes('\u041d\u0430\u0438\u0441\u0442\u0438\u043d\u0430 \u043b\u0438 \u0438\u0441\u043a\u0430\u0442\u0435');
      const hasError = document.body.innerText.includes('\u043d\u0435 \u0431\u044f\u0445\u0430 \u0437\u0430\u043f\u0430\u0437\u0435\u043d\u0438') || document.body.innerText.includes('\u043d\u0435 \u0441\u044a\u0449\u0435\u0441\u0442\u0432\u0443\u0432\u0430');
      return { hasModal, hasConfirm, hasError };
    });
    console.log('Final state:', JSON.stringify(finalState));
  }

  await browser.close();
  console.log('Done');
})();
