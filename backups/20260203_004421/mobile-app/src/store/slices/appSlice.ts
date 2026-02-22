import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppState, AppMode, BusinessHours } from '../../utils/types';

interface ConsentDetail {
  consentType: string;
  status: 'granted' | 'withdrawn';
  legalBasis: string;
  description: string;
  timestamp: string;
}

interface AppSliceState extends AppState {
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  hasGDPRConsent: boolean;
  consentTimestamp: string | null;
  consentDetails: ConsentDetail[];
}

const initialState: AppSliceState = {
  isEnabled: false,
  currentMode: 'normal',
  businessHours: {
    enabled: true,
    isActive: true,
    schedule: {
      monday: { start: '08:00', end: '18:00' },
      tuesday: { start: '08:00', end: '18:00' },
      wednesday: { start: '08:00', end: '18:00' },
      thursday: { start: '08:00', end: '18:00' },
      friday: { start: '08:00', end: '18:00' },
      saturday: { start: '09:00', end: '15:00' },
      // Sunday is undefined - no work on Sundays
    },
    timezone: 'Europe/Sofia',
  },
  emergencyMode: false,
  isLoading: false,
  error: null,
  lastUpdate: Date.now(),
  hasGDPRConsent: false,
  consentTimestamp: null,
  consentDetails: [],
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setEnabled: (state, action: PayloadAction<boolean>) => {
      state.isEnabled = action.payload;
      state.lastUpdate = Date.now();
    },
    
    setCurrentMode: (state, action: PayloadAction<AppMode>) => {
      state.currentMode = action.payload;
      state.lastUpdate = Date.now();
    },
    
    setBusinessHours: (state, action: PayloadAction<BusinessHours>) => {
      state.businessHours = action.payload;
      state.lastUpdate = Date.now();
    },
    
    setEmergencyMode: (state, action: PayloadAction<boolean>) => {
      state.emergencyMode = action.payload;
      state.lastUpdate = Date.now();
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    updateConsent: (state, action: PayloadAction<{
      hasGDPRConsent: boolean;
      consentTimestamp: string;
      consentDetails: ConsentDetail[];
    }>) => {
      state.hasGDPRConsent = action.payload.hasGDPRConsent;
      state.consentTimestamp = action.payload.consentTimestamp;
      state.consentDetails = action.payload.consentDetails;
      state.lastUpdate = Date.now();
    },
    
    updateBusinessHoursActive: (state, action: PayloadAction<boolean>) => {
      state.businessHours.isActive = action.payload;
      state.lastUpdate = Date.now();
    },
    
    resetApp: (state) => {
      return {
        ...initialState,
        lastUpdate: Date.now(),
      };
    },
  },
});

export const {
  setEnabled,
  setCurrentMode,
  setBusinessHours,
  setEmergencyMode,
  setLoading,
  setError,
  clearError,
  updateConsent,
  updateBusinessHoursActive,
  resetApp,
} = appSlice.actions;

export default appSlice.reducer;
