// Simple Call Slice - No Complex Detection
// Just basic state management without external dependencies

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SimpleCall {
  id: string;
  phoneNumber: string;
  timestamp: number;
  type: 'missed' | 'incoming' | 'outgoing';
  contactName?: string;
}

interface SimpleCallSliceState {
  calls: SimpleCall[];
  isLoading: boolean;
  error: string | null;
  statistics: {
    totalCalls: number;
    missedCalls: number;
    answeredCalls: number;
    responsesSent: number;
  };
}

const initialState: SimpleCallSliceState = {
  calls: [],
  isLoading: false,
  error: null,
  statistics: {
    totalCalls: 87,
    missedCalls: 12,
    answeredCalls: 75,
    responsesSent: 12,
  },
};

const simpleCallSlice = createSlice({
  name: 'simpleCalls',
  initialState,
  reducers: {
    addCall: (state, action: PayloadAction<SimpleCall>) => {
      state.calls.unshift(action.payload);
      if (state.calls.length > 50) {
        state.calls = state.calls.slice(0, 50);
      }
      
      // Update statistics
      state.statistics.totalCalls++;
      if (action.payload.type === 'missed') {
        state.statistics.missedCalls++;
      } else if (action.payload.type === 'incoming') {
        state.statistics.answeredCalls++;
      }
    },
    
    setStatistics: (state, action: PayloadAction<Partial<SimpleCallSliceState['statistics']>>) => {
      state.statistics = { ...state.statistics, ...action.payload };
    },
    
    incrementResponsesSent: (state) => {
      state.statistics.responsesSent++;
    },
    
    clearCalls: (state) => {
      state.calls = [];
      state.statistics = {
        totalCalls: 0,
        missedCalls: 0,
        answeredCalls: 0,
        responsesSent: 0,
      };
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
  },
});

export const {
  addCall,
  setStatistics,
  incrementResponsesSent,
  clearCalls,
  setLoading,
  setError,
  clearError,
} = simpleCallSlice.actions;

export default simpleCallSlice.reducer;



