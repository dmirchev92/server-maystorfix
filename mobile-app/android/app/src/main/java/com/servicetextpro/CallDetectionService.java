package com.servicetextpro;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyManager;
import android.util.Log;
import androidx.annotation.Nullable;

public class CallDetectionService extends Service {
    private static final String TAG = "CallDetectionService";
    private TelephonyManager telephonyManager;
    private PhoneStateListener phoneStateListener;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "CallDetectionService created");
        
        telephonyManager = (TelephonyManager) getSystemService(TELEPHONY_SERVICE);
        
        phoneStateListener = new PhoneStateListener() {
            @Override
            public void onCallStateChanged(int state, String phoneNumber) {
                super.onCallStateChanged(state, phoneNumber);
                
                switch (state) {
                    case TelephonyManager.CALL_STATE_RINGING:
                        Log.d(TAG, "Incoming call from: " + phoneNumber);
                        break;
                    case TelephonyManager.CALL_STATE_OFFHOOK:
                        Log.d(TAG, "Call answered");
                        break;
                    case TelephonyManager.CALL_STATE_IDLE:
                        Log.d(TAG, "Call ended - checking for missed calls");
                        // Trigger React Native to check for missed calls
                        sendBroadcastToReactNative();
                        break;
                }
            }
        };
        
        telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE);
    }

    private void sendBroadcastToReactNative() {
        Intent intent = new Intent("com.servicetextpro.CALL_STATE_CHANGED");
        sendBroadcast(intent);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "CallDetectionService started");
        return START_STICKY; // Restart service if killed
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (telephonyManager != null && phoneStateListener != null) {
            telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_NONE);
        }
        Log.d(TAG, "CallDetectionService destroyed");
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
