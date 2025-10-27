package com.servicetextpro;

import android.Manifest;
import android.content.pm.PackageManager;
import android.telephony.SmsManager;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

public class SMSModule extends ReactContextBaseJavaModule {
    private static final String TAG = "SMSModule";
    private static final int SMS_PERMISSION_REQUEST_CODE = 1001;

    public SMSModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "SMSModule";
    }

    @ReactMethod
    public void sendSMS(String phoneNumber, String message, Promise promise) {
        try {
            Log.d(TAG, "Attempting to send SMS to: " + phoneNumber);
            Log.d(TAG, "Message: " + message);

            // Check SMS permission
            if (ActivityCompat.checkSelfPermission(getReactApplicationContext(), 
                    Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
                Log.e(TAG, "SMS permission not granted");
                promise.reject("PERMISSION_DENIED", "SMS permission not granted");
                return;
            }

            // Get SMS manager
            SmsManager smsManager = SmsManager.getDefault();
            
            // Send SMS
            smsManager.sendTextMessage(phoneNumber, null, message, null, null);
            
            Log.d(TAG, "SMS sent successfully to: " + phoneNumber);
            
            // Return success
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", true);
            result.putString("phoneNumber", phoneNumber);
            result.putString("message", message);
            promise.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Error sending SMS: " + e.getMessage());
            promise.reject("SMS_ERROR", "Failed to send SMS: " + e.getMessage());
        }
    }

    @ReactMethod
    public void checkSMSPermission(Promise promise) {
        try {
            boolean hasPermission = ActivityCompat.checkSelfPermission(getReactApplicationContext(), 
                    Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED;
            
            WritableMap result = Arguments.createMap();
            result.putBoolean("hasPermission", hasPermission);
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error checking SMS permission: " + e.getMessage());
            promise.reject("PERMISSION_CHECK_ERROR", "Failed to check SMS permission: " + e.getMessage());
        }
    }
}



