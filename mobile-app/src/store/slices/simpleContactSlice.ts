// Simple Contact Slice - No External Dependencies
// Basic contact management without complex services

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SimpleContact {
  id: string;
  name: string;
  phoneNumber: string;
  category: 'customer' | 'prospect' | 'emergency' | 'personal';
  priority: 'low' | 'medium' | 'high';
}

interface SimpleContactSliceState {
  contacts: SimpleContact[];
  selectedContact: SimpleContact | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  filteredContacts: SimpleContact[];
}

const initialState: SimpleContactSliceState = {
  contacts: [],
  selectedContact: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  filteredContacts: [],
};

const simpleContactSlice = createSlice({
  name: 'simpleContacts',
  initialState,
  reducers: {
    setSelectedContact: (state, action: PayloadAction<SimpleContact | null>) => {
      state.selectedContact = action.payload;
    },
    
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      
      // Simple search filtering
      if (action.payload.trim()) {
        state.filteredContacts = state.contacts.filter(contact =>
          contact.name.toLowerCase().includes(action.payload.toLowerCase()) ||
          contact.phoneNumber.includes(action.payload)
        );
      } else {
        state.filteredContacts = [];
      }
    },
    
    clearSearch: (state) => {
      state.searchQuery = '';
      state.filteredContacts = [];
    },
    
    addContact: (state, action: PayloadAction<SimpleContact>) => {
      state.contacts.push(action.payload);
    },
    
    updateContact: (state, action: PayloadAction<SimpleContact>) => {
      const index = state.contacts.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.contacts[index] = action.payload;
      }
    },
    
    removeContact: (state, action: PayloadAction<string>) => {
      state.contacts = state.contacts.filter(c => c.id !== action.payload);
      state.filteredContacts = state.filteredContacts.filter(c => c.id !== action.payload);
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
    
    resetContacts: (state) => {
      state.contacts = [];
      state.selectedContact = null;
      state.searchQuery = '';
      state.filteredContacts = [];
    },
  },
});

export const {
  setSelectedContact,
  setSearchQuery,
  clearSearch,
  addContact,
  updateContact,
  removeContact,
  setLoading,
  setError,
  clearError,
  resetContacts,
} = simpleContactSlice.actions;

export default simpleContactSlice.reducer;



