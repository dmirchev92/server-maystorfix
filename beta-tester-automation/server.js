/**
 * Beta Tester Automation Server
 * 
 * Serves a landing page where users enter their email.
 * On submit, Playwright adds the email to Google Play Console tester list.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const { addTester } = require('./add-tester');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.BETA_PORT || 3099;

// Database connection
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'servicetext_pro',
  user: 'postgres',
  password: 'C58acfd5c!',
});

// Middleware
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter for registration endpoint (10 per IP per hour)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Твърде много опити за регистрация. Моля, опитайте отново след 1 час.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Queue for processing emails (one at a time to avoid browser conflicts)
let isProcessing = false;
const queue = [];

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  
  isProcessing = true;
  const { email, resolve } = queue.shift();
  
  try {
    console.log(`[Queue] Processing: ${email} (${queue.length} remaining)`);
    const result = await addTester(email);
    
    // Update database
    if (result.success) {
      await pool.query(
        `UPDATE beta_testers SET status = 'added', added_to_play_console = true, processed_at = NOW() WHERE email = $1`,
        [email]
      );
    } else {
      await pool.query(
        `UPDATE beta_testers SET status = 'failed', error_message = $2, processed_at = NOW() WHERE email = $1`,
        [email, result.message]
      );
    }
    
    resolve(result);
  } catch (error) {
    await pool.query(
      `UPDATE beta_testers SET status = 'failed', error_message = $2, processed_at = NOW() WHERE email = $1`,
      [email, error.message]
    );
    resolve({ success: false, message: error.message });
  } finally {
    isProcessing = false;
    // Process next in queue
    processQueue();
  }
}

// API: Submit email
app.post('/api/submit-email', async (req, res) => {
  const { email, name, referralCode } = req.body;
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Моля, въведете валиден имейл адрес.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Check if already exists
    const existing = await pool.query('SELECT * FROM beta_testers WHERE email = $1', [normalizedEmail]);
    
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.added_to_play_console) {
        return res.json({ 
          success: true, 
          message: 'Този имейл вече е добавен! Проверете пощата си за линк за изтегляне.',
          alreadyAdded: true 
        });
      }
      if (row.status === 'processing') {
        return res.json({ 
          success: true, 
          message: 'Имейлът ви се обработва в момента. Моля, изчакайте.',
          processing: true 
        });
      }
    }

    // Insert or update in database
    await pool.query(
      `INSERT INTO beta_testers (email, name, source, status, referral_code) 
       VALUES ($1, $2, 'landing_page', 'processing', $3) 
       ON CONFLICT (email) DO UPDATE SET status = 'processing', name = COALESCE($2, beta_testers.name), referral_code = COALESCE(beta_testers.referral_code, $3)`,
      [normalizedEmail, name || null, referralCode || null]
    );

    // Add to queue for Playwright processing
    const resultPromise = new Promise((resolve) => {
      queue.push({ email: normalizedEmail, resolve });
      processQueue();
    });

    // Wait for result (with timeout)
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ success: false, message: 'Обработката отнема повече от очакваното. Ще бъдете добавен скоро.' }), 120000);
    });

    const result = await Promise.race([resultPromise, timeoutPromise]);

    if (result.success) {
      // Note: referral points are only awarded via /api/submit-register (requires real user account)
      // The old email-only flow cannot create sp_referrals records needed for proper referral tracking
      res.json({ 
        success: true, 
        message: 'Успешно! Имейлът ви е добавен. Ще получите линк за изтегляне на приложението скоро.',
      });
    } else if (result.message && result.message.includes('SESSION_EXPIRED')) {
      res.status(503).json({ 
        success: false, 
        message: 'Системата за автоматично добавяне е временно недостъпна. Моля, опитайте по-късно.' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Възникна грешка при добавянето. Моля, опитайте отново по-късно.' 
      });
    }
  } catch (error) {
    console.error('Error processing email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Възникна грешка. Моля, опитайте отново.' 
    });
  }
});

// API: Get stats (admin)
app.get('/api/stats', async (req, res) => {
  try {
    const total = await pool.query('SELECT COUNT(*) as count FROM beta_testers');
    const added = await pool.query('SELECT COUNT(*) as count FROM beta_testers WHERE added_to_play_console = true');
    const pending = await pool.query('SELECT COUNT(*) as count FROM beta_testers WHERE status = $1', ['pending']);
    const failed = await pool.query('SELECT COUNT(*) as count FROM beta_testers WHERE status = $1', ['failed']);
    const recent = await pool.query('SELECT email, name, status, created_at FROM beta_testers ORDER BY created_at DESC LIMIT 20');
    
    res.json({
      total: parseInt(total.rows[0].count),
      added: parseInt(added.rows[0].count),
      pending: parseInt(pending.rows[0].count),
      failed: parseInt(failed.rows[0].count),
      recent: recent.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Retry failed emails
app.post('/api/retry-failed', async (req, res) => {
  try {
    const failed = await pool.query("SELECT email FROM beta_testers WHERE status = 'failed'");
    
    for (const row of failed.rows) {
      await pool.query("UPDATE beta_testers SET status = 'processing' WHERE email = $1", [row.email]);
      queue.push({ 
        email: row.email, 
        resolve: () => {} 
      });
    }
    
    processQueue();
    res.json({ success: true, message: `Retrying ${failed.rows.length} failed emails` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Validate referral code
app.get('/api/validate-referral/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await pool.query(
      `SELECT u.first_name, u.last_name, sp.business_name 
       FROM sp_referral_codes src 
       JOIN users u ON src.user_id = u.id 
       LEFT JOIN service_provider_profiles sp ON u.id = sp.user_id 
       WHERE src.referral_code = $1`,
      [code]
    );
    if (result.rows.length > 0) {
      const r = result.rows[0];
      res.json({ valid: true, referrerName: r.business_name || `${r.first_name} ${r.last_name}` });
    } else {
      res.json({ valid: false });
    }
  } catch (error) {
    res.json({ valid: false });
  }
});

// Award points for beta registration referral
// - Always awards 5 pts to the referrer (SP)
// - Awards 5 pts to the referred user ONLY if they are also an SP (tradesperson)
// - Creates proper sp_referrals record (required by referral_rewards.referral_id NOT NULL)
async function awardBetaReferralPoints(referralCode, referredUserId, referredEmail, referredRole) {
  // Find referrer user_id
  const referrer = await pool.query(
    'SELECT user_id FROM sp_referral_codes WHERE referral_code = $1',
    [referralCode]
  );
  if (referrer.rows.length === 0) {
    console.log(`[Referral] Code not found: ${referralCode}`);
    return;
  }

  const referrerUserId = referrer.rows[0].user_id;

  // Prevent self-referral
  if (referrerUserId === referredUserId) {
    console.log(`[Referral] Self-referral blocked: ${referrerUserId}`);
    return;
  }

  // Check if referral already exists
  const existingReferral = await pool.query(
    `SELECT id FROM sp_referrals WHERE referrer_user_id = $1 AND referred_user_id = $2`,
    [referrerUserId, referredUserId]
  );
  if (existingReferral.rows.length > 0) {
    console.log(`[Referral] Already exists for ${referredUserId}`);
    return;
  }

  // 1. Create sp_referrals record (required for referral_rewards FK)
  const referralId = `beta_ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await pool.query(
    `INSERT INTO sp_referrals (id, referrer_user_id, referred_user_id, referral_code, status, created_at, activated_at)
     VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())`,
    [referralId, referrerUserId, referredUserId, referralCode]
  );

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 6);

  // 2. Award 5 points to REFERRER (always)
  await pool.query(
    `UPDATE users SET points_balance = COALESCE(points_balance, 0) + 5, points_total_earned = COALESCE(points_total_earned, 0) + 5 WHERE id = $1`,
    [referrerUserId]
  );
  const referrerBal = await pool.query('SELECT points_balance FROM users WHERE id = $1', [referrerUserId]);
  const referrerBalance = referrerBal.rows[0]?.points_balance || 5;

  const referrerTxId = `beta_rtx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await pool.query(
    `INSERT INTO sp_points_transactions (id, user_id, transaction_type, points_amount, balance_after, reason, created_at)
     VALUES ($1, $2, 'earned', 5, $3, $4, NOW())`,
    [referrerTxId, referrerUserId, referrerBalance, `Beta referral bonus: ${referredEmail}`]
  );

  const referrerRewardId = `beta_rw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await pool.query(
    `INSERT INTO referral_rewards (id, referrer_user_id, referral_id, referred_user_id, reward_type, reward_value, clicks_required, clicks_achieved, earned_at, expires_at, status, is_aggregate, points_awarded)
     VALUES ($1, $2, $3, $4, 'beta_tester_bonus', 5, 0, 0, NOW(), $5, 'applied', false, 5)`,
    [referrerRewardId, referrerUserId, referralId, referredUserId, expiresAt.toISOString()]
  );

  console.log(`🎁 Awarded 5 points to referrer ${referrerUserId} for beta referral: ${referredEmail}`);

  // 3. Award 5 points to REFERRED user (only if SP/tradesperson)
  if (referredRole === 'tradesperson') {
    await pool.query(
      `UPDATE users SET points_balance = COALESCE(points_balance, 0) + 5, points_total_earned = COALESCE(points_total_earned, 0) + 5 WHERE id = $1`,
      [referredUserId]
    );
    const referredBal = await pool.query('SELECT points_balance FROM users WHERE id = $1', [referredUserId]);
    const referredBalance = referredBal.rows[0]?.points_balance || 5;

    const referredTxId = `beta_ntx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await pool.query(
      `INSERT INTO sp_points_transactions (id, user_id, transaction_type, points_amount, balance_after, reason, created_at)
       VALUES ($1, $2, 'earned', 5, $3, 'Beta registration bonus (referred)', NOW())`,
      [referredTxId, referredUserId, referredBalance]
    );

    const referredRewardId = `beta_nrw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await pool.query(
      `INSERT INTO referral_rewards (id, referrer_user_id, referral_id, referred_user_id, reward_type, reward_value, clicks_required, clicks_achieved, earned_at, expires_at, status, is_aggregate, points_awarded)
       VALUES ($1, $2, $3, $4, 'beta_tester_bonus', 5, 0, 0, NOW(), $5, 'applied', false, 5)`,
      [referredRewardId, referredUserId, referralId, referredUserId, expiresAt.toISOString()]
    );

    console.log(`🎁 Awarded 5 points to referred SP ${referredUserId}`);
  }
}

// Helper: detect Gmail address
function isGmailAddress(email) {
  const lower = email.toLowerCase();
  return lower.endsWith('@gmail.com') || lower.endsWith('@googlemail.com');
}

// Helper: run Playwright synchronously and wait for result
function runPlaywrightSync(email) {
  return new Promise((resolve) => {
    queue.push({ email, resolve });
    processQueue();
  });
}

// API: Full beta registration (creates real user account + adds to beta testers)
// Gmail flow: Playwright FIRST → if fails, don't register → if succeeds, register
// Non-Gmail flow: Register directly → show APK download
app.post('/api/submit-register', registerLimiter, async (req, res) => {
  const { email, password, firstName, lastName, phoneNumber, role, serviceCategory, companyName, city, referralCode } = req.body;

  // Basic validation
  if (!email || !password || !firstName || !lastName || !phoneNumber || !role) {
    return res.status(400).json({ success: false, message: 'Моля, попълнете всички задължителни полета.' });
  }

  if (!['tradesperson', 'customer'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Моля, изберете валидна роля.' });
  }

  if (role === 'tradesperson' && !serviceCategory) {
    return res.status(400).json({ success: false, message: 'Моля, изберете категория услуги.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const isGmail = isGmailAddress(normalizedEmail);

  try {
    // ─── GMAIL: Add to Google Play Console FIRST, before creating account ───
    if (isGmail) {
      console.log(`[Register] Gmail detected. Running Playwright first for: ${normalizedEmail}`);
      
      const playwrightResult = await Promise.race([
        runPlaywrightSync(normalizedEmail),
        new Promise((resolve) => setTimeout(() => resolve({ success: false, message: 'TIMEOUT: Playwright took too long' }), 120000))
      ]);

      if (!playwrightResult.success) {
        console.error(`[Register] Playwright failed for ${normalizedEmail}: ${playwrightResult.message}`);
        
        if (playwrightResult.message?.includes('SESSION_EXPIRED')) {
          return res.status(503).json({
            success: false,
            message: 'Системата за добавяне в Google Play е временно недостъпна. Моля, опитайте по-късно или използвайте имейл, който не е Gmail.'
          });
        }

        return res.status(500).json({
          success: false,
          message: 'Не успяхме да ви добавим в Google Play. Моля, опитайте по-късно или използвайте имейл, който не е Gmail.'
        });
      }

      console.log(`[Register] Playwright succeeded for ${normalizedEmail}. Proceeding with registration.`);
    }

    // ─── Register user in backend ───
    const registrationData = {
      email: normalizedEmail,
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber,
      role,
      gdprConsents: ['essential_service'],
    };

    if (role === 'tradesperson') {
      registrationData.serviceCategory = serviceCategory;
      registrationData.companyName = companyName || '';
      registrationData.subscription_tier_id = 'free';
      if (city) registrationData.city = city;
    }

    const backendResponse = await fetch('http://127.0.0.1:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData),
    });

    const backendData = await backendResponse.json();

    // Handle USER_ALREADY_EXISTS
    if (!backendResponse.ok && backendData?.error?.code === 'USER_ALREADY_EXISTS') {
      // For Gmail: Playwright already succeeded above, so they're in Google Play
      // For non-Gmail: just show APK download
      await pool.query(
        `INSERT INTO beta_testers (email, name, source, status, is_gmail)
         VALUES ($1, $2, 'beta_register', $3, $4)
         ON CONFLICT (email) DO UPDATE SET is_gmail = $4, status = $3`,
        [normalizedEmail, `${firstName} ${lastName}`, isGmail ? 'added' : 'apk_only', isGmail]
      );

      return res.json({
        success: true,
        alreadyRegistered: true,
        isGmail,
        message: 'Вече имате акаунт. ' + (isGmail
          ? 'Добавени сте към бета програмата в Google Play.'
          : 'Можете да изтеглите приложението директно.')
      });
    }

    // Handle other backend errors
    if (!backendResponse.ok) {
      const errorMsg = backendData?.error?.message || backendData?.errors?.[0]?.msg || 'Грешка при регистрация.';
      console.error('[Register] Backend error:', backendData);
      return res.status(backendResponse.status).json({ success: false, message: errorMsg });
    }

    // Registration successful — get userId
    const userId = backendData?.data?.user?.id;
    if (!userId) {
      console.error('[Register] No userId in response:', backendData);
      return res.status(500).json({ success: false, message: 'Регистрацията е успешна, но не можахме да получим потребителски ID.' });
    }

    console.log(`[Register] User created: ${userId} (${normalizedEmail}, ${role})`);

    // Award referral points if referral code provided
    if (referralCode) {
      try {
        await awardBetaReferralPoints(referralCode, userId, normalizedEmail, role);
      } catch (refErr) {
        console.error('[Referral] Error awarding points:', refErr);
      }
    }

    // Insert into beta_testers
    await pool.query(
      `INSERT INTO beta_testers (email, name, source, status, referral_code, user_id, is_gmail)
       VALUES ($1, $2, 'beta_register', $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET 
         status = $3, 
         name = COALESCE($2, beta_testers.name), 
         referral_code = COALESCE(beta_testers.referral_code, $4), 
         user_id = COALESCE($5, beta_testers.user_id), 
         is_gmail = $6`,
      [normalizedEmail, `${firstName} ${lastName}`, isGmail ? 'added' : 'apk_only', referralCode || null, userId, isGmail]
    );

    // Return success
    res.json({
      success: true,
      isGmail,
      message: isGmail
        ? 'Регистрацията е успешна! Добавени сте в Google Play. Проверете имейла си за верификация.'
        : 'Регистрацията е успешна! Можете да изтеглите приложението по-долу. Проверете имейла си за верификация.'
    });

  } catch (error) {
    console.error('[Register] Error:', error);
    if (error.cause?.code === 'ECONNREFUSED') {
      return res.status(503).json({ success: false, message: 'Сървърът е временно недостъпен. Моля, опитайте по-късно.' });
    }
    res.status(500).json({ success: false, message: 'Възникна грешка. Моля, опитайте отново.' });
  }
});

// API: Service categories (hardcoded, matches mobile app)
app.get('/api/service-categories', (req, res) => {
  res.json([
    { value: 'cat_electrician', label: 'Електротехник' },
    { value: 'cat_plumber', label: 'Водопроводчик' },
    { value: 'cat_hvac', label: 'Отопление и климатизация' },
    { value: 'cat_carpenter', label: 'Дърводелец' },
    { value: 'cat_painter', label: 'Бояджия' },
    { value: 'cat_locksmith', label: 'Ключар' },
    { value: 'cat_cleaner', label: 'Почистване' },
    { value: 'cat_gardener', label: 'Градинар' },
    { value: 'cat_handyman', label: 'Дребни ремонти' },
    { value: 'cat_renovation', label: 'Цялостни ремонти' },
    { value: 'cat_roofer', label: 'Ремонт на покриви' },
    { value: 'cat_mover', label: 'Хамалски услуги' },
    { value: 'cat_tiler', label: 'Майстор Фаянс' },
    { value: 'cat_welder', label: 'Заварчик' },
    { value: 'cat_appliance', label: 'Ремонт на уреди' },
    { value: 'cat_flooring', label: 'Подови настилки' },
    { value: 'cat_plasterer', label: 'Шпакловане' },
    { value: 'cat_glasswork', label: 'Стъкларски услуги' },
    { value: 'cat_design', label: 'Дизайн' },
  ]);
});

// API: Cities (proxy to main backend)
app.get('/api/cities', async (req, res) => {
  try {
    const response = await fetch('http://127.0.0.1:3000/api/v1/locations/cities');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    // Fallback: top Bulgarian cities
    res.json({
      success: true,
      data: {
        cities: [
          { value: 'София', label: 'София' },
          { value: 'Пловдив', label: 'Пловдив' },
          { value: 'Варна', label: 'Варна' },
          { value: 'Бургас', label: 'Бургас' },
          { value: 'Русе', label: 'Русе' },
          { value: 'Стара Загора', label: 'Стара Загора' },
          { value: 'Плевен', label: 'Плевен' },
          { value: 'Сливен', label: 'Сливен' },
          { value: 'Добрич', label: 'Добрич' },
          { value: 'Шумен', label: 'Шумен' },
        ]
      }
    });
  }
});

// API: Session status - check if Google Play Console session is alive
app.get('/api/session-status', async (req, res) => {
  const statusFile = path.join(__dirname, 'session-status.json');
  try {
    if (require('fs').existsSync(statusFile)) {
      const data = JSON.parse(require('fs').readFileSync(statusFile, 'utf8'));
      res.json(data);
    } else {
      res.json({ valid: null, reason: 'NO_CHECK_YET', checkedAt: null });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Upload new cookies (secured with a simple secret key)
const UPLOAD_SECRET = 'stp-cookie-upload-2026';

app.post('/api/upload-cookies', express.json({ limit: '5mb' }), (req, res) => {
  const { secret, cookies, origins } = req.body;

  if (secret !== UPLOAD_SECRET) {
    return res.status(403).json({ success: false, message: 'Invalid secret' });
  }

  if (!cookies || !Array.isArray(cookies)) {
    return res.status(400).json({ success: false, message: 'Missing cookies array' });
  }

  try {
    // Normalize cookies for Playwright compatibility
    // Cookie-Editor uses: name, value, domain, path, expirationDate, httpOnly, secure, sameSite, storeId
    // Playwright needs: name, value, domain, path, expires, httpOnly, secure, sameSite (Strict|Lax|None)
    const normalizedCookies = cookies.map(c => {
      let sameSite = (c.sameSite || 'lax').toString();
      if (sameSite.toLowerCase() === 'strict') sameSite = 'Strict';
      else if (sameSite.toLowerCase() === 'none' || sameSite.toLowerCase() === 'no_restriction') sameSite = 'None';
      else sameSite = 'Lax';

      // Cookie-Editor uses expirationDate (seconds), Playwright uses expires (seconds)
      let expires = -1;
      if (typeof c.expirationDate === 'number') expires = c.expirationDate;
      else if (typeof c.expires === 'number') expires = c.expires;

      return {
        name: c.name,
        value: c.value,
        domain: c.domain || '.google.com',
        path: c.path || '/',
        expires: expires,
        httpOnly: c.httpOnly === true,
        secure: c.secure !== false,
        sameSite: sameSite,
      };
    });

    const sessionDir = path.join(__dirname, 'google-session');
    const storagePath = path.join(sessionDir, 'storage-state.json');

    // Merge with existing cookies instead of replacing
    // This preserves critical cookies (SID, HSID) that the Chrome extension may not capture
    let existingCookies = [];
    if (require('fs').existsSync(storagePath)) {
      try {
        const existing = JSON.parse(require('fs').readFileSync(storagePath, 'utf8'));
        existingCookies = existing.cookies || [];
      } catch (e) { /* ignore parse errors */ }
    }

    // Build a map: key = name+domain, prefer new cookies over old
    const cookieMap = new Map();
    for (const c of existingCookies) {
      cookieMap.set(c.name + '||' + c.domain, c);
    }
    for (const c of normalizedCookies) {
      cookieMap.set(c.name + '||' + c.domain, c);
    }

    const storageState = {
      cookies: Array.from(cookieMap.values()),
      origins: origins || []
    };

    // Backup old file
    if (require('fs').existsSync(storagePath)) {
      const backup = path.join(sessionDir, `storage-state.backup-${Date.now()}.json`);
      require('fs').copyFileSync(storagePath, backup);
    }

    require('fs').writeFileSync(storagePath, JSON.stringify(storageState, null, 2));

    // Update status
    const statusFile = path.join(__dirname, 'session-status.json');
    require('fs').writeFileSync(statusFile, JSON.stringify({
      valid: true,
      reason: 'COOKIES_UPLOADED',
      checkedAt: new Date().toISOString(),
      cookieCount: cookies.length
    }, null, 2));

    console.log(`✅ New cookies uploaded: ${cookies.length} cookies`);
    res.json({ success: true, message: `Uploaded ${cookies.length} cookies`, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error uploading cookies:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Serve landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve cookie export helper page
app.get('/cookie-export', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cookie-export.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Beta Tester Automation Server running on port ${PORT}`);
  console.log(`   Landing page: http://localhost:${PORT}`);
  console.log(`   Admin panel:  http://localhost:${PORT}/admin`);
});
