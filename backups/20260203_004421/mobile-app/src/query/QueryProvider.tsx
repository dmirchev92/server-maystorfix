import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient, PersistedClient } from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create the Query Client with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed queries 3 times
      retry: 3,
      // Don't retry on 401/403 errors
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus (not applicable in mobile, but good for web)
      refetchOnWindowFocus: false,
      // Refetch when reconnecting
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});

// Optional: Setup persistence
// This will persist the cache to AsyncStorage
const persistOptions = {
  queryClient,
  persister: {
    persistClient: async (client: PersistedClient) => {
      await AsyncStorage.setItem('REACT_QUERY_OFFLINE_CACHE', JSON.stringify(client));
    },
    restoreClient: async () => {
      const cache = await AsyncStorage.getItem('REACT_QUERY_OFFLINE_CACHE');
      return cache ? JSON.parse(cache) : undefined;
    },
    removeClient: async () => {
      await AsyncStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
    },
  },
  maxAge: 1000 * 60 * 60 * 24, // 24 hours
};

// Initialize persistence
// persistQueryClient(persistOptions); // Uncomment when ready to enable persistence

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * QueryProvider - React Query Context Provider
 * Wraps the app with QueryClientProvider for global cache management
 */
export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* ReactQueryDevtools only works in web, not React Native */}
      {/* {__DEV__ && <ReactQueryDevtools initialIsOpen={false} />} */}
    </QueryClientProvider>
  );
};

// Export queryClient for direct access when needed
export { queryClient };

export default QueryProvider;
