package com.servicetextpro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * BroadcastReceiver that starts the CallDetectionService when the device boots.
 * This ensures the SMS auto-reply feature works even after device restart.
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            
            Log.d(TAG, "📱 Device boot completed");
            
            // Check if SMS is enabled before starting service
            android.content.SharedPreferences smsPrefs = context.getSharedPreferences("sms_settings", Context.MODE_PRIVATE);
            boolean smsEnabled = smsPrefs.getBoolean("is_enabled", false);
            
            Log.d(TAG, "📋 SMS enabled: " + smsEnabled);
            
            if (!smsEnabled) {
                Log.d(TAG, "📱 SMS is disabled, not starting CallDetectionService after boot");
                return;
            }
            
            try {
                Intent serviceIntent = new Intent(context, CallDetectionService.class);
                
                // For Android 8.0+ (API 26+), must use startForegroundService
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Log.d(TAG, "🔔 Starting CallDetectionService as FOREGROUND service");
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
                
                Log.d(TAG, "✅ CallDetectionService started after boot");
            } catch (Exception e) {
                Log.e(TAG, "❌ Failed to start CallDetectionService after boot", e);
            }
        }
    }
}
