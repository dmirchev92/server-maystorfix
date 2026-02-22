package com.servicetextpro

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  companion object {
    private const val TAG = "MainActivity"
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ServiceTextPro"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    // CRITICAL: Pass null to prevent React Native Screens fragment restore crash
    // See: https://github.com/software-mansion/react-native-screens/issues/17
    super.onCreate(null)
    
    // Only start service if SMS is enabled
    val smsPrefs = getSharedPreferences("sms_settings", Context.MODE_PRIVATE)
    val smsEnabled = smsPrefs.getBoolean("is_enabled", false)
    
    Log.d(TAG, "🚀 MainActivity.onCreate() - SMS enabled: $smsEnabled")
    
    if (smsEnabled) {
      startCallDetectionService()
    } else {
      Log.d(TAG, "📱 SMS is disabled, not starting CallDetectionService")
    }
  }
  
  private fun startCallDetectionService() {
    try {
      val serviceIntent = Intent(this, CallDetectionService::class.java)
      
      // CRITICAL: Use startForegroundService on Android 8+ to keep service alive in background
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Log.d(TAG, "🔔 Starting CallDetectionService as FOREGROUND service (Android 8+)")
        startForegroundService(serviceIntent)
      } else {
        Log.d(TAG, "🔔 Starting CallDetectionService as regular service (Android < 8)")
        startService(serviceIntent)
      }
      
      Log.d(TAG, "✅ CallDetectionService start requested")
    } catch (e: Exception) {
      Log.e(TAG, "❌ Error starting CallDetectionService", e)
    }
  }
}
