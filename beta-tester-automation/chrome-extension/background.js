/**
 * SnapFix Cookie Sync - Background Service Worker
 * 
 * Automatically exports Google cookies (including httpOnly) and uploads
 * them to the SnapFix server every 4 hours.
 */

const UPLOAD_URL = 'https://snapfix.bg/beta/api/upload-cookies';
const UPLOAD_SECRET = 'stp-cookie-upload-2026';
const SYNC_INTERVAL_MINUTES = 240; // 4 hours
const ALARM_NAME = 'snapfix-cookie-sync';

// Domains to collect cookies from
const COOKIE_DOMAINS = ['.google.com', 'play.google.com', 'accounts.google.com'];

/**
 * Collect all Google cookies (including httpOnly)
 */
async function collectCookies() {
  const allCookies = [];
  const seen = new Set();

  for (const domain of COOKIE_DOMAINS) {
    const cookies = await chrome.cookies.getAll({ domain });
    for (const c of cookies) {
      const key = `${c.domain}|${c.name}|${c.path}`;
      if (!seen.has(key)) {
        seen.add(key);
        allCookies.push({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          expires: c.expirationDate || -1,
          httpOnly: c.httpOnly,
          secure: c.secure,
          sameSite: normalizeSameSite(c.sameSite),
        });
      }
    }
  }

  return allCookies;
}

function normalizeSameSite(sameSite) {
  if (!sameSite) return 'Lax';
  switch (sameSite.toLowerCase()) {
    case 'strict': return 'Strict';
    case 'none': case 'no_restriction': return 'None';
    default: return 'Lax';
  }
}

/**
 * Upload cookies to the server
 */
async function uploadCookies(cookies) {
  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: UPLOAD_SECRET,
      cookies: cookies,
    }),
  });

  return await response.json();
}

/**
 * Main sync function
 */
async function syncCookies() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting cookie sync...`);

  try {
    const cookies = await collectCookies();
    console.log(`[${timestamp}] Collected ${cookies.length} cookies`);

    // Check for critical session cookies
    const critical = ['SID', 'SSID', 'HSID', '__Secure-1PSID', '__Secure-3PSID'];
    const found = critical.filter(name => cookies.some(c => c.name === name));
    const missing = critical.filter(name => !cookies.some(c => c.name === name));

    if (missing.length > 0) {
      console.warn(`[${timestamp}] Missing critical cookies: ${missing.join(', ')}`);
    }
    console.log(`[${timestamp}] Found critical cookies: ${found.join(', ')}`);

    if (cookies.length < 5) {
      const result = { success: false, message: 'Too few cookies. Is Chrome logged into Google?' };
      await saveStatus(result, cookies.length, timestamp);
      return result;
    }

    const result = await uploadCookies(cookies);
    console.log(`[${timestamp}] Upload result:`, result);

    await saveStatus(result, cookies.length, timestamp);
    return result;

  } catch (error) {
    console.error(`[${timestamp}] Sync error:`, error.message);
    const result = { success: false, message: error.message };
    await saveStatus(result, 0, timestamp);
    return result;
  }
}

/**
 * Save sync status for popup display
 */
async function saveStatus(result, cookieCount, timestamp) {
  await chrome.storage.local.set({
    lastSync: {
      timestamp,
      success: result.success || false,
      message: result.message || '',
      cookieCount,
    }
  });
}

// Set up periodic alarm
chrome.alarms.create(ALARM_NAME, {
  delayInMinutes: 1,        // First sync 1 minute after install
  periodInMinutes: SYNC_INTERVAL_MINUTES,
});

// Handle alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    syncCookies();
  }
});

// Run on extension install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('SnapFix Cookie Sync installed. Running first sync...');
  syncCookies();
});

// Listen for manual sync trigger from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'syncNow') {
    syncCookies().then(sendResponse);
    return true; // async response
  }
  if (message.action === 'getStatus') {
    chrome.storage.local.get('lastSync', (data) => {
      sendResponse(data.lastSync || null);
    });
    return true;
  }
});
