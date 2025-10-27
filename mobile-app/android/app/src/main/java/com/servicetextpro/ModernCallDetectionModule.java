package com.servicetextpro;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.ContentObserver;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.CallLog;
import android.telephony.TelephonyCallback;
import android.telephony.TelephonyManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.core.app.ActivityCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.Executor;

public class ModernCallDetectionModule extends ReactContextBaseJavaModule {
    private static final String TAG = "ModernCallDetection";
    private static final String MODULE_NAME = "ModernCallDetectionModule";
    
    private ReactApplicationContext reactContext;
    private TelephonyManager telephonyManager;
    private CallStateCallback callStateCallback;
    private CallLogObserver callLogObserver;
    private boolean isListening = false;
    private long lastCallTime = 0;
    private static final String PREF_LAST_CALL_TIME = "last_call_time";
    private static final String PREF_NAME = "call_detection_prefs";
    
    public ModernCallDetectionModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.telephonyManager = (TelephonyManager) reactContext.getSystemService(Context.TELEPHONY_SERVICE);
        
        // Restore last call time from preferences
        loadLastCallTime();
    }
    
    private void loadLastCallTime() {
        try {
            android.content.SharedPreferences prefs = reactContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            lastCallTime = prefs.getLong(PREF_LAST_CALL_TIME, System.currentTimeMillis() - (24 * 60 * 60 * 1000)); // Default to 24 hours ago
            Log.d(TAG, "📱 Loaded lastCallTime: " + lastCallTime + " (" + new Date(lastCallTime) + ")");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error loading lastCallTime", e);
            lastCallTime = System.currentTimeMillis() - (24 * 60 * 60 * 1000); // Default to 24 hours ago
        }
    }
    
    private void saveLastCallTime() {
        try {
            android.content.SharedPreferences prefs = reactContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            prefs.edit().putLong(PREF_LAST_CALL_TIME, lastCallTime).apply();
            Log.d(TAG, "💾 Saved lastCallTime: " + lastCallTime + " (" + new Date(lastCallTime) + ")");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error saving lastCallTime", e);
        }
    }

    @Override
    @NonNull
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void hasPermissions(Promise promise) {
        try {
            boolean hasPhoneState = ActivityCompat.checkSelfPermission(reactContext, 
                Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
            boolean hasCallLog = ActivityCompat.checkSelfPermission(reactContext, 
                Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED;
            
            WritableMap result = Arguments.createMap();
            result.putBoolean("READ_PHONE_STATE", hasPhoneState);
            result.putBoolean("READ_CALL_LOG", hasCallLog);
            result.putBoolean("hasAllPermissions", hasPhoneState && hasCallLog);
            result.putString("androidVersion", String.valueOf(Build.VERSION.SDK_INT));
            
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error checking permissions", e);
            promise.reject("PERMISSION_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void startCallDetection(Promise promise) {
        try {
            if (isListening) {
                promise.resolve("Already listening");
                return;
            }

            // Check permissions
            if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.READ_PHONE_STATE) 
                != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_ERROR", "READ_PHONE_STATE permission not granted");
                return;
            }

            if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.READ_CALL_LOG) 
                != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_ERROR", "READ_CALL_LOG permission not granted");
                return;
            }

            // Use TelephonyCallback for Android 12+ (API 31+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                startModernCallDetection();
            } else {
                // Fallback for older versions
                startLegacyCallDetection();
            }

            // Also monitor call log changes
            startCallLogMonitoring();

            isListening = true;
            Log.d(TAG, "Call detection started successfully");
            promise.resolve("Call detection started");

        } catch (Exception e) {
            Log.e(TAG, "Error starting call detection", e);
            promise.reject("START_ERROR", e.getMessage());
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.S)
    private void startModernCallDetection() {
        callStateCallback = new CallStateCallback();
        Executor executor = reactContext.getMainExecutor();
        
        if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.READ_PHONE_STATE) 
            == PackageManager.PERMISSION_GRANTED) {
            telephonyManager.registerTelephonyCallback(executor, callStateCallback);
            Log.d(TAG, "TelephonyCallback registered for Android 12+");
        }
    }

    @SuppressWarnings("deprecation")
    private void startLegacyCallDetection() {
        // For older Android versions, we'll rely mainly on call log monitoring
        Log.d(TAG, "Using legacy call detection (call log monitoring only)");
    }

    private void startCallLogMonitoring() {
        callLogObserver = new CallLogObserver(new Handler(Looper.getMainLooper()));
        reactContext.getContentResolver().registerContentObserver(
            CallLog.Calls.CONTENT_URI, true, callLogObserver);
        Log.d(TAG, "Call log observer registered");
    }

    @ReactMethod
    public void stopCallDetection(Promise promise) {
        try {
            if (!isListening) {
                promise.resolve("Not listening");
                return;
            }

            // Unregister TelephonyCallback
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && callStateCallback != null) {
                telephonyManager.unregisterTelephonyCallback(callStateCallback);
                callStateCallback = null;
            }

            // Unregister call log observer
            if (callLogObserver != null) {
                reactContext.getContentResolver().unregisterContentObserver(callLogObserver);
                callLogObserver = null;
            }

            isListening = false;
            Log.d(TAG, "Call detection stopped");
            promise.resolve("Call detection stopped");

        } catch (Exception e) {
            Log.e(TAG, "Error stopping call detection", e);
            promise.reject("STOP_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getRecentMissedCalls(Promise promise) {
        try {
            if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.READ_CALL_LOG) 
                != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_ERROR", "READ_CALL_LOG permission not granted");
                return;
            }

            WritableMap result = Arguments.createMap();
            
            // Query for recent missed calls (last 24 hours)
            long yesterday = System.currentTimeMillis() - (24 * 60 * 60 * 1000);
            
            String[] projection = {
                CallLog.Calls.NUMBER,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.TYPE,
                CallLog.Calls.CACHED_NAME
            };
            
            String selection = CallLog.Calls.TYPE + " = ? AND " + CallLog.Calls.DATE + " > ?";
            String[] selectionArgs = {
                String.valueOf(CallLog.Calls.MISSED_TYPE),
                String.valueOf(yesterday)
            };
            
            String sortOrder = CallLog.Calls.DATE + " DESC LIMIT 10";
            
            Cursor cursor = reactContext.getContentResolver().query(
                CallLog.Calls.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                sortOrder
            );

            int count = 0;
            if (cursor != null) {
                count = cursor.getCount();
                cursor.close();
            }

            result.putInt("missedCallsCount", count);
            result.putString("status", "success");
            result.putLong("queryTime", System.currentTimeMillis());
            
            promise.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Error getting recent missed calls", e);
            promise.reject("QUERY_ERROR", e.getMessage());
        }
    }

    // TelephonyCallback for Android 12+ (API 31+)
    @RequiresApi(api = Build.VERSION_CODES.S)
    private class CallStateCallback extends TelephonyCallback implements TelephonyCallback.CallStateListener {
        @Override
        public void onCallStateChanged(int state) {
            Log.d(TAG, "🔔 Call state changed: " + state + " (" + getCallStateString(state) + ")");
            
            switch (state) {
                case TelephonyManager.CALL_STATE_IDLE:
                    Log.d(TAG, "📱 Call ended - checking for missed call");
                    // Multiple checks with different delays for Android 15
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        Log.d(TAG, "🔍 First check (1s delay)");
                        checkForMissedCall();
                    }, 1000);
                    
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        Log.d(TAG, "🔍 Second check (3s delay)");
                        checkForMissedCall();
                    }, 3000);
                    
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        Log.d(TAG, "🔍 Final check (5s delay)");
                        checkForMissedCall();
                    }, 5000);
                    break;
                case TelephonyManager.CALL_STATE_RINGING:
                    Log.d(TAG, "📞 Phone is ringing - incoming call");
                    break;
                case TelephonyManager.CALL_STATE_OFFHOOK:
                    Log.d(TAG, "✅ Call answered or outgoing call");
                    break;
            }
        }
        
        private String getCallStateString(int state) {
            switch (state) {
                case TelephonyManager.CALL_STATE_IDLE: return "IDLE";
                case TelephonyManager.CALL_STATE_RINGING: return "RINGING";
                case TelephonyManager.CALL_STATE_OFFHOOK: return "OFFHOOK";
                default: return "UNKNOWN";
            }
        }
    }

    // Call Log Observer to detect changes
    private class CallLogObserver extends ContentObserver {
        public CallLogObserver(Handler handler) {
            super(handler);
        }

        @Override
        public void onChange(boolean selfChange, Uri uri) {
            super.onChange(selfChange, uri);
            Log.d(TAG, "Call log changed, checking for missed calls");
            
            // Delay slightly to ensure call log is updated
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                checkForMissedCall();
            }, 1000);
        }
    }

    private void checkForMissedCall() {
        try {
            Log.d(TAG, "🔍 Checking for missed call...");
            
            if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.READ_CALL_LOG) 
                != PackageManager.PERMISSION_GRANTED) {
                Log.e(TAG, "❌ READ_CALL_LOG permission not granted");
                return;
            }

            // Use the same logic as getAllCallLogs - this approach works!
            String[] projection = {
                CallLog.Calls.NUMBER,
                CallLog.Calls.DATE,
                CallLog.Calls.TYPE,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.DURATION
            };
            
            String sortOrder = CallLog.Calls.DATE + " DESC";
            
            Cursor cursor = reactContext.getContentResolver().query(
                CallLog.Calls.CONTENT_URI,
                projection,
                null,
                null,
                sortOrder
            );

            if (cursor != null && cursor.moveToFirst()) {
                Log.d(TAG, "📞 Found call log entries, checking for new missed calls...");
                
                int checkedCalls = 0;
                int maxCallsToCheck = 10; // Only check the 10 most recent calls
                
                do {
                    if (checkedCalls >= maxCallsToCheck) {
                        break; // Don't check too many old calls
                    }
                    
                    int typeIndex = cursor.getColumnIndex(CallLog.Calls.TYPE);
                    int dateIndex = cursor.getColumnIndex(CallLog.Calls.DATE);
                    int numberIndex = cursor.getColumnIndex(CallLog.Calls.NUMBER);
                    int nameIndex = cursor.getColumnIndex(CallLog.Calls.CACHED_NAME);
                    int durationIndex = cursor.getColumnIndex(CallLog.Calls.DURATION);

                    int callType = cursor.getInt(typeIndex);
                    long callDate = cursor.getLong(dateIndex);
                    String phoneNumber = cursor.getString(numberIndex);
                    String contactName = cursor.getString(nameIndex);
                    long duration = cursor.getLong(durationIndex);

                    Log.d(TAG, "📋 Call: " + phoneNumber + ", Type: " + callType + ", Date: " + callDate + ", Duration: " + duration + ", LastCallTime: " + lastCallTime);

                    // Check if this is a new missed call
                    if (callType == CallLog.Calls.MISSED_TYPE && callDate > lastCallTime) {
                        Log.d(TAG, "✅ Found NEW missed call: " + phoneNumber + " at " + new Date(callDate));
                        lastCallTime = callDate;
                        saveLastCallTime(); // Persist the new timestamp
                        
                        // Send event to React Native
                        sendMissedCallEvent(phoneNumber, contactName, callDate);
                        break; // Only process the most recent missed call
                    } else if (callType == CallLog.Calls.MISSED_TYPE) {
                        Log.d(TAG, "⏰ Old missed call: " + phoneNumber + " (already processed)");
                    } else {
                        Log.d(TAG, "📞 Non-missed call: " + phoneNumber + " (type: " + callType + ")");
                    }
                    
                    checkedCalls++;
                } while (cursor.moveToNext());
                
                cursor.close();
                Log.d(TAG, "✅ Checked " + checkedCalls + " recent calls for missed calls");
            } else {
                Log.d(TAG, "❌ No calls found in call log");
            }

        } catch (Exception e) {
            Log.e(TAG, "❌ Error checking for missed call", e);
            e.printStackTrace();
        }
    }

    private void sendMissedCallEvent(String phoneNumber, String contactName, long timestamp) {
        try {
            WritableMap eventData = Arguments.createMap();
            eventData.putString("phoneNumber", phoneNumber != null ? phoneNumber : "Unknown");
            eventData.putString("contactName", contactName != null ? contactName : "");
            eventData.putDouble("timestamp", timestamp);
            eventData.putString("formattedTime", formatTimestamp(timestamp));
            eventData.putString("source", "native_detection");
            eventData.putString("type", "missed_call");

            Log.d(TAG, "Sending missed call event: " + phoneNumber);
            
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("MissedCallDetected", eventData);

        } catch (Exception e) {
            Log.e(TAG, "Error sending missed call event", e);
        }
    }

    private String formatTimestamp(long timestamp) {
        SimpleDateFormat sdf = new SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault());
        return sdf.format(new Date(timestamp));
    }

    @ReactMethod
    public void testMissedCall(Promise promise) {
        try {
            // Send a test missed call event
            sendMissedCallEvent("+359888123456", "Test Contact", System.currentTimeMillis());
            promise.resolve("Test missed call event sent");
        } catch (Exception e) {
            promise.reject("TEST_ERROR", e.getMessage());
        }
    }
    
    @ReactMethod
    public void forceCheckMissedCalls(Promise promise) {
        try {
            Log.d(TAG, "🔍 Manual missed call check triggered from React Native");
            checkForMissedCall();
            promise.resolve("Manual check completed");
        } catch (Exception e) {
            Log.e(TAG, "Error in manual check", e);
            promise.reject("CHECK_ERROR", e.getMessage());
        }
    }
    
    @ReactMethod
    public void debugCallLog(Promise promise) {
        try {
            Log.d(TAG, "🔍 DEBUG: Analyzing call log...");
            
            if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.READ_CALL_LOG) 
                != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_ERROR", "READ_CALL_LOG permission not granted");
                return;
            }

            String[] projection = {
                CallLog.Calls.NUMBER,
                CallLog.Calls.DATE,
                CallLog.Calls.TYPE,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.DURATION
            };
            
            String sortOrder = CallLog.Calls.DATE + " DESC LIMIT 10";
            
            Cursor cursor = reactContext.getContentResolver().query(
                CallLog.Calls.CONTENT_URI,
                projection,
                null,
                null,
                sortOrder
            );

            WritableMap result = Arguments.createMap();
            result.putLong("lastCallTime", lastCallTime);
            result.putLong("currentTime", System.currentTimeMillis());
            
            if (cursor != null && cursor.moveToFirst()) {
                result.putInt("totalCalls", cursor.getCount());
                
                StringBuilder callsInfo = new StringBuilder();
                int missedCount = 0;
                
                do {
                    int typeIndex = cursor.getColumnIndex(CallLog.Calls.TYPE);
                    int dateIndex = cursor.getColumnIndex(CallLog.Calls.DATE);
                    int numberIndex = cursor.getColumnIndex(CallLog.Calls.NUMBER);
                    int durationIndex = cursor.getColumnIndex(CallLog.Calls.DURATION);

                    int callType = cursor.getInt(typeIndex);
                    long callDate = cursor.getLong(dateIndex);
                    String phoneNumber = cursor.getString(numberIndex);
                    long duration = cursor.getLong(durationIndex);
                    
                    String typeStr = (callType == CallLog.Calls.MISSED_TYPE) ? "MISSED" : 
                                   (callType == CallLog.Calls.INCOMING_TYPE) ? "INCOMING" : 
                                   (callType == CallLog.Calls.OUTGOING_TYPE) ? "OUTGOING" : "UNKNOWN";
                    
                    if (callType == CallLog.Calls.MISSED_TYPE) {
                        missedCount++;
                    }
                    
                    String callInfo = String.format("%s: %s (%s) - %s, Duration: %ds, New: %s\n", 
                        typeStr, phoneNumber, new Date(callDate).toString(), 
                        formatTimestamp(callDate), duration, (callDate > lastCallTime));
                    
                    callsInfo.append(callInfo);
                    Log.d(TAG, "📋 " + callInfo.trim());
                    
                } while (cursor.moveToNext());
                
                result.putString("callsInfo", callsInfo.toString());
                result.putInt("missedCallsFound", missedCount);
                cursor.close();
            } else {
                result.putInt("totalCalls", 0);
                result.putString("callsInfo", "No calls found");
            }
            
            Log.d(TAG, "✅ DEBUG: Call log analysis complete");
            promise.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "❌ DEBUG: Error analyzing call log", e);
            promise.reject("DEBUG_ERROR", e.getMessage());
        }
    }
}
