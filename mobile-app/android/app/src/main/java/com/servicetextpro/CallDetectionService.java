package com.servicetextpro;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.database.Cursor;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.CallLog;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.annotation.Nullable;

/**
 * Foreground Service for detecting missed calls even when phone is locked.
 * This service runs with a persistent notification to prevent Android from killing it.
 */
public class CallDetectionService extends Service {
    private static final String TAG = "CallDetectionService";
    private static final String CHANNEL_ID = "call_detection_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final long SMS_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown
    
    private TelephonyManager telephonyManager;
    private PhoneStateListener phoneStateListener;
    private PowerManager.WakeLock wakeLock;
    private long lastProcessedCallTime = 0;
    private static final String PREF_NAME = "call_detection_prefs";
    private static final String PREF_LAST_CALL_TIME = "last_call_time";
    private static final String PREF_SMS_COOLDOWNS = "sms_cooldowns"; // JSON map of phone -> timestamp

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "📱 CallDetectionService created (Foreground Service)");
        
        // CRITICAL: Must call startForeground() IMMEDIATELY to avoid ANR/crash
        // Create notification channel first (required for notification)
        createNotificationChannel();
        
        // Start as foreground service IMMEDIATELY - before any other operations
        startForegroundServiceImmediately();
        
        // Now do other initialization
        loadLastCallTime();
        
        // Acquire wake lock to keep CPU running
        acquireWakeLock();
        
        telephonyManager = (TelephonyManager) getSystemService(TELEPHONY_SERVICE);
        
        phoneStateListener = new PhoneStateListener() {
            @Override
            public void onCallStateChanged(int state, String phoneNumber) {
                super.onCallStateChanged(state, phoneNumber);
                
                Log.d(TAG, "📞 Phone state changed: " + state + " (phone: " + phoneNumber + ")");
                
                switch (state) {
                    case TelephonyManager.CALL_STATE_RINGING:
                        Log.d(TAG, "📞 Incoming call from: " + phoneNumber);
                        break;
                    case TelephonyManager.CALL_STATE_OFFHOOK:
                        Log.d(TAG, "✅ Call answered");
                        break;
                    case TelephonyManager.CALL_STATE_IDLE:
                        Log.d(TAG, "📱 Call ended - checking for missed calls");
                        // Check for missed calls with multiple delays
                        checkForMissedCallWithDelays();
                        break;
                }
            }
        };
        
        // Check if we have permission before listening
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.READ_PHONE_STATE) 
                == PackageManager.PERMISSION_GRANTED) {
            telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE);
            Log.d(TAG, "✅ Phone state listener registered");
        } else {
            Log.w(TAG, "⚠️ READ_PHONE_STATE permission not granted");
        }
    }
    
    private void loadLastCallTime() {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
            // Default to NOW if no preference exists - prevents processing old missed calls
            lastProcessedCallTime = prefs.getLong(PREF_LAST_CALL_TIME, System.currentTimeMillis());
            Log.d(TAG, "📱 Loaded lastProcessedCallTime: " + lastProcessedCallTime);
        } catch (Exception e) {
            Log.e(TAG, "❌ Error loading lastProcessedCallTime", e);
            // Default to NOW on error - prevents processing old missed calls
            lastProcessedCallTime = System.currentTimeMillis();
        }
    }
    
    private void saveLastCallTime() {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
            prefs.edit().putLong(PREF_LAST_CALL_TIME, lastProcessedCallTime).apply();
            Log.d(TAG, "💾 Saved lastProcessedCallTime: " + lastProcessedCallTime);
        } catch (Exception e) {
            Log.e(TAG, "❌ Error saving lastProcessedCallTime", e);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Откриване на обаждания",
                NotificationManager.IMPORTANCE_LOW // Low importance = no sound
            );
            channel.setDescription("Услугата работи във фонов режим за откриване на пропуснати обаждания");
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
                Log.d(TAG, "✅ Notification channel created");
            }
        }
    }

    private void startForegroundServiceImmediately() {
        // CRITICAL: This must complete within 5 seconds of startForegroundService() being called
        // Do NOT add any blocking operations here
        try {
            // Create intent to open app when notification is tapped
            Intent notificationIntent = new Intent(this, MainActivity.class);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("SMS Автоматичен отговор")
                .setContentText("Активно - следи за пропуснати обаждания")
                .setSmallIcon(android.R.drawable.ic_menu_call)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();

            // Start foreground with appropriate type for Android 14+
            // Using SPECIAL_USE instead of PHONE_CALL (which requires DIALER role)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            
            Log.d(TAG, "✅ Foreground service started with notification");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error starting foreground service", e);
            // Even on error, try to start with a basic notification to avoid crash
            try {
                Notification fallbackNotification = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setContentTitle("SMS Service")
                    .setContentText("Running")
                    .setSmallIcon(android.R.drawable.ic_menu_call)
                    .build();
                startForeground(NOTIFICATION_ID, fallbackNotification);
            } catch (Exception e2) {
                Log.e(TAG, "❌ Fallback foreground start also failed", e2);
            }
        }
    }
    
    private void acquireWakeLock() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "ServiceTextPro::CallDetectionWakeLock"
                );
                wakeLock.acquire(10 * 60 * 1000L); // 10 minutes max
                Log.d(TAG, "✅ Wake lock acquired");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error acquiring wake lock", e);
        }
    }
    
    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                Log.d(TAG, "✅ Wake lock released");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error releasing wake lock", e);
        }
    }
    
    private void checkForMissedCallWithDelays() {
        Handler handler = new Handler(Looper.getMainLooper());
        
        // Check multiple times with delays (call log may not be updated immediately)
        handler.postDelayed(() -> {
            Log.d(TAG, "🔍 First check (1s delay)");
            checkForMissedCall();
        }, 1000);
        
        handler.postDelayed(() -> {
            Log.d(TAG, "🔍 Second check (3s delay)");
            checkForMissedCall();
        }, 3000);
        
        handler.postDelayed(() -> {
            Log.d(TAG, "🔍 Final check (5s delay)");
            checkForMissedCall();
        }, 5000);
    }
    
    private void checkForMissedCall() {
        try {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.READ_CALL_LOG) 
                    != PackageManager.PERMISSION_GRANTED) {
                Log.e(TAG, "❌ READ_CALL_LOG permission not granted");
                return;
            }

            String[] projection = {
                CallLog.Calls.NUMBER,
                CallLog.Calls.DATE,
                CallLog.Calls.TYPE,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.DURATION
            };
            
            String sortOrder = CallLog.Calls.DATE + " DESC";
            
            Cursor cursor = getContentResolver().query(
                CallLog.Calls.CONTENT_URI,
                projection,
                null,
                null,
                sortOrder
            );

            if (cursor != null && cursor.moveToFirst()) {
                int checkedCalls = 0;
                int maxCallsToCheck = 10;
                
                do {
                    if (checkedCalls >= maxCallsToCheck) break;
                    
                    int typeIndex = cursor.getColumnIndex(CallLog.Calls.TYPE);
                    int dateIndex = cursor.getColumnIndex(CallLog.Calls.DATE);
                    int numberIndex = cursor.getColumnIndex(CallLog.Calls.NUMBER);

                    int callType = cursor.getInt(typeIndex);
                    long callDate = cursor.getLong(dateIndex);
                    String phoneNumber = cursor.getString(numberIndex);

                    // Check if this is a new missed call
                    if (callType == CallLog.Calls.MISSED_TYPE && callDate > lastProcessedCallTime) {
                        Log.d(TAG, "✅ Found NEW missed call: " + phoneNumber);
                        lastProcessedCallTime = callDate;
                        saveLastCallTime();
                        
                        // Send broadcast to React Native
                        sendBroadcastToReactNative(phoneNumber, callDate);
                        break;
                    }
                    
                    checkedCalls++;
                } while (cursor.moveToNext());
                
                cursor.close();
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error checking for missed call", e);
        }
    }

    private void sendBroadcastToReactNative(String phoneNumber, long timestamp) {
        // Send broadcast to React Native (if app is active)
        Intent intent = new Intent("com.servicetextpro.MISSED_CALL_DETECTED");
        intent.putExtra("phoneNumber", phoneNumber);
        intent.putExtra("timestamp", timestamp);
        sendBroadcast(intent);
        Log.d(TAG, "📤 Broadcast sent for missed call: " + phoneNumber);
        
        // Also send SMS directly via backend API (works even when app/JS is paused)
        sendSMSViaBackend(phoneNumber, timestamp);
    }
    
    /**
     * Send SMS via backend API directly from native code.
     * This works even when React Native JS thread is paused (phone locked).
     */
    private void sendSMSViaBackend(String phoneNumber, long timestamp) {
        // Run network call on background thread
        new Thread(() -> {
            try {
                // Get stored auth token and user ID
                android.content.SharedPreferences prefs = getSharedPreferences("auth_prefs", MODE_PRIVATE);
                String authToken = prefs.getString("auth_token", null);
                String userId = prefs.getString("user_id", null);
                
                // Also try to get from React Native AsyncStorage
                if (authToken == null || userId == null) {
                    android.content.SharedPreferences rnPrefs = getSharedPreferences("RN_ASYNC_STORAGE", MODE_PRIVATE);
                    if (authToken == null) {
                        authToken = rnPrefs.getString("auth_token", null);
                    }
                    if (userId == null) {
                        String userJson = rnPrefs.getString("user", null);
                        if (userJson != null) {
                            try {
                                org.json.JSONObject user = new org.json.JSONObject(userJson);
                                userId = user.optString("id", null);
                            } catch (Exception e) {
                                Log.e(TAG, "Error parsing user JSON", e);
                            }
                        }
                    }
                }
                
                if (authToken == null || userId == null) {
                    Log.e(TAG, "❌ Cannot send SMS: No auth token or user ID found");
                    return;
                }
                
                // Check if SMS is enabled
                android.content.SharedPreferences smsPrefs = getSharedPreferences("sms_settings", MODE_PRIVATE);
                boolean smsEnabled = smsPrefs.getBoolean("is_enabled", false);
                if (!smsEnabled) {
                    Log.d(TAG, "📱 SMS is disabled, skipping");
                    return;
                }
                
                // Check contact filter setting
                boolean filterKnownContacts = smsPrefs.getBoolean("filter_known_contacts", false);
                Log.d(TAG, "📱 Contact filter setting: " + filterKnownContacts);
                
                if (filterKnownContacts) {
                    // Check if this number is in contacts
                    if (isNumberInContacts(phoneNumber)) {
                        Log.d(TAG, "📱 Number " + phoneNumber + " is in contacts - SKIPPING SMS (filter enabled)");
                        return;
                    }
                    Log.d(TAG, "📱 Number " + phoneNumber + " is NOT in contacts - proceeding with SMS");
                }
                
                // Check spam prevention cooldown (30 minutes between SMS to same number)
                if (isNumberOnCooldown(phoneNumber)) {
                    return; // Already logged in the method
                }
                
                Log.d(TAG, "📤 Sending SMS via backend API for: " + phoneNumber);
                
                // Create API request
                java.net.URL url = new java.net.URL("https://snapfix.bg/api/v1/sms/send-missed-call");
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + authToken);
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                
                // Create JSON payload
                org.json.JSONObject payload = new org.json.JSONObject();
                payload.put("phoneNumber", phoneNumber);
                payload.put("userId", userId);
                payload.put("callId", "call_" + timestamp + "_" + phoneNumber.hashCode());
                payload.put("timestamp", timestamp);
                payload.put("source", "native_background");
                
                // Send request
                java.io.OutputStream os = conn.getOutputStream();
                os.write(payload.toString().getBytes("UTF-8"));
                os.close();
                
                int responseCode = conn.getResponseCode();
                if (responseCode == 200 || responseCode == 201) {
                    Log.d(TAG, "✅ SMS sent successfully via backend API");
                    // Record cooldown for this number
                    setNumberCooldown(phoneNumber);
                } else {
                    Log.e(TAG, "❌ Backend API returned error: " + responseCode);
                    // Read error response
                    java.io.InputStream errorStream = conn.getErrorStream();
                    if (errorStream != null) {
                        java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(errorStream));
                        StringBuilder response = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            response.append(line);
                        }
                        Log.e(TAG, "❌ Error response: " + response.toString());
                    }
                }
                
                conn.disconnect();
                
            } catch (Exception e) {
                Log.e(TAG, "❌ Error sending SMS via backend", e);
                e.printStackTrace();
            }
        }).start();
    }
    
    /**
     * Check if a phone number exists in the device's contacts.
     * Used for contact filtering - skip SMS to known contacts.
     */
    private boolean isNumberInContacts(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isEmpty()) {
            return false;
        }
        
        try {
            // Check READ_CONTACTS permission
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.READ_CONTACTS) 
                    != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "⚠️ READ_CONTACTS permission not granted, cannot check contacts");
                return false; // If we can't check, assume not in contacts (allow SMS)
            }
            
            // Normalize phone number - remove spaces, dashes, etc.
            String normalizedNumber = phoneNumber.replaceAll("[^0-9+]", "");
            
            // Try to find the contact using ContactsContract
            android.net.Uri uri = android.net.Uri.withAppendedPath(
                android.provider.ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                android.net.Uri.encode(normalizedNumber)
            );
            
            String[] projection = new String[] {
                android.provider.ContactsContract.PhoneLookup.DISPLAY_NAME,
                android.provider.ContactsContract.PhoneLookup.NUMBER
            };
            
            android.database.Cursor cursor = getContentResolver().query(uri, projection, null, null, null);
            
            if (cursor != null) {
                boolean found = cursor.getCount() > 0;
                if (found && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(android.provider.ContactsContract.PhoneLookup.DISPLAY_NAME);
                    String contactName = cursor.getString(nameIndex);
                    Log.d(TAG, "📱 Contact found: " + contactName + " for number: " + phoneNumber);
                }
                cursor.close();
                return found;
            }
            
            return false;
        } catch (Exception e) {
            Log.e(TAG, "❌ Error checking contacts for " + phoneNumber, e);
            return false; // On error, assume not in contacts (allow SMS)
        }
    }
    
    /**
     * Check if a phone number is on cooldown (SMS sent recently).
     * Prevents spam by blocking SMS to the same number within 30 minutes.
     */
    private boolean isNumberOnCooldown(String phoneNumber) {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
            String cooldownsJson = prefs.getString(PREF_SMS_COOLDOWNS, "{}");
            org.json.JSONObject cooldowns = new org.json.JSONObject(cooldownsJson);
            
            // Normalize phone number for consistent lookup
            String normalizedNumber = phoneNumber.replaceAll("[^0-9+]", "");
            
            if (cooldowns.has(normalizedNumber)) {
                long lastSentTime = cooldowns.getLong(normalizedNumber);
                long timeSinceSent = System.currentTimeMillis() - lastSentTime;
                
                if (timeSinceSent < SMS_COOLDOWN_MS) {
                    long minutesRemaining = (SMS_COOLDOWN_MS - timeSinceSent) / 60000;
                    Log.d(TAG, "🚫 SMS blocked for " + phoneNumber + " - cooldown active (" + minutesRemaining + " min remaining)");
                    return true;
                }
            }
            
            return false;
        } catch (Exception e) {
            Log.e(TAG, "❌ Error checking cooldown for " + phoneNumber, e);
            return false; // On error, allow SMS
        }
    }
    
    /**
     * Set cooldown for a phone number after SMS is sent.
     */
    private void setNumberCooldown(String phoneNumber) {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
            String cooldownsJson = prefs.getString(PREF_SMS_COOLDOWNS, "{}");
            org.json.JSONObject cooldowns = new org.json.JSONObject(cooldownsJson);
            
            // Normalize phone number
            String normalizedNumber = phoneNumber.replaceAll("[^0-9+]", "");
            
            // Set current time as last sent time
            cooldowns.put(normalizedNumber, System.currentTimeMillis());
            
            // Clean up old entries (older than 1 hour) to prevent unbounded growth
            cleanupOldCooldowns(cooldowns);
            
            // Save
            prefs.edit().putString(PREF_SMS_COOLDOWNS, cooldowns.toString()).apply();
            Log.d(TAG, "📝 Cooldown set for " + phoneNumber + " (30 min)");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error setting cooldown for " + phoneNumber, e);
        }
    }
    
    /**
     * Clean up cooldown entries older than 1 hour to prevent memory bloat.
     */
    private void cleanupOldCooldowns(org.json.JSONObject cooldowns) {
        try {
            long oneHourAgo = System.currentTimeMillis() - (60 * 60 * 1000);
            java.util.Iterator<String> keys = cooldowns.keys();
            java.util.List<String> keysToRemove = new java.util.ArrayList<>();
            
            while (keys.hasNext()) {
                String key = keys.next();
                long timestamp = cooldowns.optLong(key, 0);
                if (timestamp < oneHourAgo) {
                    keysToRemove.add(key);
                }
            }
            
            for (String key : keysToRemove) {
                cooldowns.remove(key);
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error cleaning up cooldowns", e);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "📱 CallDetectionService onStartCommand");
        // Ensure foreground is started (in case onCreate didn't complete)
        startForegroundServiceImmediately();
        // Reload lastProcessedCallTime in case it was reset by resetLastProcessedCallTime()
        // This is important when service is already running and we toggle SMS on/off
        loadLastCallTime();
        return START_STICKY; // Restart service if killed
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (telephonyManager != null && phoneStateListener != null) {
            telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_NONE);
        }
        releaseWakeLock();
        Log.d(TAG, "📱 CallDetectionService destroyed");
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
