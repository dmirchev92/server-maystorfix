declare module 'react-native' {
  interface NativeModulesStatic {
    MapFixModule: {
      /**
       * Initialize the Google Maps renderer with the latest rendering pipeline
       * @returns Promise that resolves when initialization is complete
       */
      initializeMapsRenderer(): Promise<string>;
      
      /**
       * Force refresh all MapView instances to ensure markers are rendered
       * @returns Promise that resolves when refresh is complete
       */
      forceMapRefresh(): Promise<string>;
    };
  }
}

export {};
