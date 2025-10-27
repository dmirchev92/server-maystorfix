import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

// Import slices
import appSlice from './slices/appSlice';
import simpleCallSlice from './slices/simpleCallSlice';
import simpleContactSlice from './slices/simpleContactSlice';

export const store = configureStore({
  reducer: {
    app: appSlice,
    calls: simpleCallSlice,
    contacts: simpleContactSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
