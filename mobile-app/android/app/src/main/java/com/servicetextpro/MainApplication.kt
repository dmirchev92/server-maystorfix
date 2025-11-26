package com.servicetextpro

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.google.android.gms.maps.MapsInitializer
import com.google.android.gms.maps.MapsInitializer.Renderer

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
                add(ModernCallDetectionPackage())
                add(SMSPackage())
                add(MapFixPackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    // CRITICAL: Initialize Maps renderer BEFORE React Native loads
    // This prevents MapView from initializing with null renderer
    try {
      // Using LEGACY renderer - LATEST has known marker visibility issues on some Android devices
      MapsInitializer.initialize(this, Renderer.LEGACY) { renderer ->
        when (renderer) {
          Renderer.LATEST -> android.util.Log.d("MainApplication", "✅ Maps initialized with LATEST renderer")
          Renderer.LEGACY -> android.util.Log.d("MainApplication", "✅ Maps initialized with LEGACY renderer (better marker support)")
        }
      }
    } catch (e: Exception) {
      android.util.Log.e("MainApplication", "❌ Failed to initialize Maps", e)
    }
    loadReactNative(this)
  }
}
