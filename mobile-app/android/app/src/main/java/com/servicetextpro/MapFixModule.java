package com.servicetextpro;

import android.app.Activity;
import android.view.View;
import android.view.ViewGroup;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.uimanager.NativeViewHierarchyManager;
import com.facebook.react.uimanager.UIBlock;
import com.facebook.react.uimanager.UIManagerModule;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.MapView;
import com.google.android.gms.maps.MapsInitializer;
import com.google.android.gms.maps.OnMapsSdkInitializedCallback;
import com.google.android.gms.maps.MapsInitializer.Renderer;
import android.util.Log;

public class MapFixModule extends ReactContextBaseJavaModule implements OnMapsSdkInitializedCallback {
    private static final String TAG = "MapFixModule";
    private final ReactApplicationContext reactContext;
    private static boolean isInitialized = false;

    public MapFixModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "MapFixModule";
    }

    @ReactMethod
    public void initializeMapsRenderer(Promise promise) {
        try {
            if (isInitialized) {
                Log.d(TAG, "Maps SDK already initialized, skipping");
                promise.resolve("Maps renderer already initialized");
                return;
            }
            
            // Force LEGACY renderer - LATEST has marker visibility issues on some devices
            MapsInitializer.initialize(reactContext, Renderer.LEGACY, this);
            isInitialized = true;
            Log.d(TAG, "Maps SDK initialized with LATEST renderer");
            promise.resolve("Maps renderer initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize Maps SDK", e);
            promise.reject("INIT_ERROR", "Failed to initialize Maps renderer: " + e.getMessage());
        }
    }

    @ReactMethod
    public void forceMapRefresh(Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            if (activity != null) {
                activity.runOnUiThread(() -> {
                    try {
                        // Force a layout pass on all MapViews
                        View rootView = activity.getWindow().getDecorView().getRootView();
                        forceMapViewRefresh(rootView);
                        promise.resolve("Map views refreshed");
                    } catch (Exception e) {
                        Log.e(TAG, "Error refreshing map views", e);
                        promise.reject("REFRESH_ERROR", e.getMessage());
                    }
                });
            } else {
                promise.reject("NO_ACTIVITY", "No current activity available");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to force map refresh", e);
            promise.reject("REFRESH_ERROR", e.getMessage());
        }
    }

    private void forceMapViewRefresh(View view) {
        if (view instanceof MapView) {
            MapView mapView = (MapView) view;
            mapView.invalidate();
            mapView.requestLayout();
            
            // Force marker re-render by getting the map instance
            mapView.getMapAsync(googleMap -> {
                if (googleMap != null) {
                    // Toggle map type to force re-render
                    int currentType = googleMap.getMapType();
                    googleMap.setMapType(GoogleMap.MAP_TYPE_NONE);
                    googleMap.setMapType(currentType);
                    Log.d(TAG, "Forced map type toggle for marker refresh");
                }
            });
        }
        
        if (view instanceof ViewGroup) {
            ViewGroup viewGroup = (ViewGroup) view;
            for (int i = 0; i < viewGroup.getChildCount(); i++) {
                forceMapViewRefresh(viewGroup.getChildAt(i));
            }
        }
    }

    @Override
    public void onMapsSdkInitialized(Renderer renderer) {
        switch (renderer) {
            case LATEST:
                Log.d(TAG, "The latest Maps renderer is now being used.");
                break;
            case LEGACY:
                Log.d(TAG, "The legacy Maps renderer is now being used.");
                break;
        }
    }
}
