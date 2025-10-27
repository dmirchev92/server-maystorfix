import { configureStore } from '@reduxjs/toolkit'
import authSlice from './slices/authSlice'
import searchSlice from './slices/searchSlice'
import messagingSlice from './slices/messagingSlice'

export const store = configureStore({
  reducer: {
    auth: authSlice,
    search: searchSlice,
    messaging: messagingSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

