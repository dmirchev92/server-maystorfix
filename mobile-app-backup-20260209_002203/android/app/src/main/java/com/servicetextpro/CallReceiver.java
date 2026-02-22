package com.servicetextpro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.CallLog;
import android.telephony.TelephonyManager;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * BroadcastReceiver that detects incoming calls even when the app is not running.
 * Android will wake this receiver when PHONE_STATE changes.
 * This works even when the phone is locked.
 */
public class CallReceiver extends BroadcastReceiver {
    private static final String TAG = "CallReceiver";
    
    private static String lastState = TelephonyManager.EXTRA_STATE_IDLE;
    private static String lastIncomingNumber = null;
    private static long callStartTime = 0;
    
    @Override
    public void onReceive(Context context, Intent intent) {
        // 🔍 DEBUG: Log that receiver was triggered
        Log.d(TAG, "🔔🔔🔔 CallReceiver.onReceive() TRIGGERED! Action: " + intent.getAction());
        
        if (!TelephonyManager.ACTION_PHONE_STATE_CHANGED.equals(intent.getAction())) {
            Log.d(TAG, "❌ Ignoring non-phone-state action: " + intent.getAction());
            return;
        }
        
        String state = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
        String phoneNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);
        
        Log.d(TAG, "📞📞📞 Phone state changed: " + state + ", number: " + phoneNumber);
        Log.d(TAG, "📱 Device locked: " + isDeviceLocked(context));
        
        if (state == null) return;
        
        // Acquire wake lock to ensure we can complete our work
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "ServiceTextPro:CallReceiverWakeLock"
        );
        wakeLock.acquire(60000); // 60 seconds max
        
        try {
            if (state.equals(TelephonyManager.EXTRA_STATE_RINGING)) {
                // Incoming call started
                lastState = state;
                if (phoneNumber != null) {
                    lastIncomingNumber = phoneNumber;
                }
                callStartTime = System.currentTimeMillis();
                Log.d(TAG, "📞 Incoming call from: " + lastIncomingNumber);
                
            } else if (state.equals(TelephonyManager.EXTRA_STATE_IDLE)) {
                // Call ended - check if it was a missed call
                if (lastState.equals(TelephonyManager.EXTRA_STATE_RINGING)) {
                    // Was ringing, now idle = missed call (not answered)
                    Log.d(TAG, "📞 Call ended without answer - checking for missed call");
                    
                    // Use handler to delay check (call log takes time to update)
                    final String numberToCheck = lastIncomingNumber;
                    final Context appContext = context.getApplicationContext();
                    
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        checkAndSendSMS(appContext, numberToCheck, wakeLock);
                    }, 3000); // 3 second delay
                    
                } else {
                    wakeLock.release();
                }
                
                lastState = state;
                lastIncomingNumber = null;
                
            } else if (state.equals(TelephonyManager.EXTRA_STATE_OFFHOOK)) {
                // Call was answered
                lastState = state;
                Log.d(TAG, "📞 Call answered");
                wakeLock.release();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in onReceive", e);
            if (wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }
    
    private boolean isDeviceLocked(Context context) {
        try {
            android.app.KeyguardManager keyguardManager = (android.app.KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE);
            return keyguardManager != null && keyguardManager.isKeyguardLocked();
        } catch (Exception e) {
            return false;
        }
    }
    
    private void checkAndSendSMS(Context context, String phoneNumber, PowerManager.WakeLock wakeLock) {
        new Thread(() -> {
            try {
                Log.d(TAG, "🔍🔍🔍 checkAndSendSMS() STARTED for: " + phoneNumber);
                Log.d(TAG, "📱 Device locked at SMS check: " + isDeviceLocked(context));
                
                // Check if SMS is enabled
                SharedPreferences smsPrefs = context.getSharedPreferences("sms_settings", Context.MODE_PRIVATE);
                boolean smsEnabled = smsPrefs.getBoolean("is_enabled", false);
                
                // 🔍 DEBUG: Log all SMS prefs
                Log.d(TAG, "📋 SMS Settings SharedPrefs:");
                Log.d(TAG, "   - is_enabled: " + smsEnabled);
                Log.d(TAG, "   - All keys: " + smsPrefs.getAll().toString());
                
                if (!smsEnabled) {
                    Log.d(TAG, "❌❌❌ SMS is DISABLED in settings, skipping!");
                    return;
                }
                
                Log.d(TAG, "✅ SMS is ENABLED, continuing...");
                
                // Get auth credentials
                SharedPreferences authPrefs = context.getSharedPreferences("auth_prefs", Context.MODE_PRIVATE);
                String authToken = authPrefs.getString("auth_token", null);
                String userId = authPrefs.getString("user_id", null);
                
                // 🔍 DEBUG: Log auth prefs
                Log.d(TAG, "🔐 Auth SharedPrefs:");
                Log.d(TAG, "   - auth_token: " + (authToken != null ? authToken.substring(0, Math.min(20, authToken.length())) + "..." : "NULL"));
                Log.d(TAG, "   - user_id: " + userId);
                
                if (authToken == null || userId == null) {
                    Log.e(TAG, "❌❌❌ No auth credentials found! Cannot send SMS.");
                    Log.e(TAG, "   This usually means syncNativeSettings() was never called.");
                    return;
                }
                
                Log.d(TAG, "✅ Auth credentials found, continuing...");
                
                // Query call log for recent missed calls
                long checkTime = System.currentTimeMillis() - 30000; // Last 30 seconds
                
                String[] projection = {
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE
                };
                
                String selection = CallLog.Calls.TYPE + " = ? AND " + CallLog.Calls.DATE + " > ?";
                String[] selectionArgs = {
                    String.valueOf(CallLog.Calls.MISSED_TYPE),
                    String.valueOf(checkTime)
                };
                
                Cursor cursor = context.getContentResolver().query(
                    CallLog.Calls.CONTENT_URI,
                    projection,
                    selection,
                    selectionArgs,
                    CallLog.Calls.DATE + " DESC"
                );
                
                Log.d(TAG, "🔍 Querying call log for missed calls in last 30 seconds...");
                
                if (cursor != null && cursor.moveToFirst()) {
                    String missedNumber = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER));
                    long timestamp = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DATE));
                    cursor.close();
                    
                    Log.d(TAG, "📞✅ FOUND missed call from: " + missedNumber + " at " + timestamp);
                    
                    // Check if we already processed this call
                    SharedPreferences processedPrefs = context.getSharedPreferences("processed_calls", Context.MODE_PRIVATE);
                    String callKey = "call_" + timestamp + "_" + missedNumber;
                    
                    if (processedPrefs.getBoolean(callKey, false)) {
                        Log.d(TAG, "📱 Already processed this call, skipping");
                        return;
                    }
                    
                    // 🚫 SPAM PREVENTION: Check if SMS was recently sent to this number
                    String normalizedNumber = missedNumber.replaceAll("[\\s\\-\\(\\)]", "");
                    long lastSentTime = processedPrefs.getLong("sms_sent_" + normalizedNumber, 0);
                    long cooldownMs = 30 * 60 * 1000; // 30 minutes
                    
                    if (System.currentTimeMillis() - lastSentTime < cooldownMs) {
                        long remainingMinutes = (cooldownMs - (System.currentTimeMillis() - lastSentTime)) / 60000;
                        Log.d(TAG, "🚫 SMS blocked for " + normalizedNumber + " - cooldown active (" + remainingMinutes + " min remaining)");
                        return;
                    }
                    
                    // Mark as processed
                    processedPrefs.edit().putBoolean(callKey, true).apply();
                    
                    // Send SMS via backend
                    sendSMSViaBackend(context, authToken, userId, missedNumber, timestamp);
                    
                } else {
                    Log.d(TAG, "📞❌ NO missed call found in call log for last 30 seconds");
                    Log.d(TAG, "   This might mean the call was answered or call log not updated yet");
                    if (cursor != null) cursor.close();
                }
                
            } catch (Exception e) {
                Log.e(TAG, "Error checking for missed call", e);
            } finally {
                if (wakeLock.isHeld()) {
                    wakeLock.release();
                }
            }
        }).start();
    }
    
    private void sendSMSViaBackend(Context context, String authToken, String userId, String phoneNumber, long timestamp) {
        try {
            Log.d(TAG, "📤📤📤 sendSMSViaBackend() STARTED");
            Log.d(TAG, "   - phoneNumber: " + phoneNumber);
            Log.d(TAG, "   - userId: " + userId);
            Log.d(TAG, "   - timestamp: " + timestamp);
            Log.d(TAG, "   - Device locked: " + isDeviceLocked(context));
            
            URL url = new URL("https://snapfix.bg/api/v1/sms/send-missed-call");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + authToken);
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            
            JSONObject payload = new JSONObject();
            payload.put("phoneNumber", phoneNumber);
            payload.put("userId", userId);
            payload.put("callId", "call_" + timestamp + "_" + phoneNumber.hashCode());
            payload.put("timestamp", timestamp);
            payload.put("source", "broadcast_receiver");
            
            OutputStream os = conn.getOutputStream();
            os.write(payload.toString().getBytes("UTF-8"));
            os.close();
            
            int responseCode = conn.getResponseCode();
            Log.d(TAG, "📡 Backend API response code: " + responseCode);
            
            if (responseCode == 200 || responseCode == 201) {
                Log.d(TAG, "✅✅✅ SMS SENT SUCCESSFULLY via backend API!");
                
                // 📝 Record SMS sent time for spam prevention
                String normalizedNumber = phoneNumber.replaceAll("[\\s\\-\\(\\)]", "");
                SharedPreferences processedPrefs = context.getSharedPreferences("processed_calls", Context.MODE_PRIVATE);
                processedPrefs.edit().putLong("sms_sent_" + normalizedNumber, System.currentTimeMillis()).apply();
                Log.d(TAG, "📝 Recorded SMS sent to " + normalizedNumber);
                
            } else {
                Log.e(TAG, "❌ Backend API returned error: " + responseCode);
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                Log.e(TAG, "❌ Error response: " + response.toString());
            }
            
            conn.disconnect();
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error sending SMS via backend", e);
        }
    }
}
