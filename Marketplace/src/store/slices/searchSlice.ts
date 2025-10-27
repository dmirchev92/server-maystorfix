import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { apiClient } from '@/lib/api'

interface ServiceProvider {
  id: string
  firstName: string
  lastName: string
  businessName: string
  serviceTypes: string[]
  rating: number
  totalReviews: number
  responseTime: number
  hourlyRate: number
  currency: string
  profilePhoto?: string
  isVerified: boolean
  serviceAreas: string[]
}

interface SearchFilters {
  serviceType: string
  city: string
  neighborhood?: string
  minRating?: number
  maxPrice?: number
  availability?: string
}

interface SearchState {
  providers: ServiceProvider[]
  filters: SearchFilters
  isLoading: boolean
  error: string | null
  totalResults: number
  currentPage: number
}

const initialState: SearchState = {
  providers: [],
  filters: {
    serviceType: '',
    city: '',
    neighborhood: '',
    minRating: 0,
    maxPrice: undefined,
    availability: 'any'
  },
  isLoading: false,
  error: null,
  totalResults: 0,
  currentPage: 1,
}

// Async thunks
export const searchProviders = createAsyncThunk(
  'search/providers',
  async (filters: SearchFilters) => {
    const response = await apiClient.searchProviders(filters)
    return response.data
  }
)

export const getProviderDetails = createAsyncThunk(
  'search/providerDetails',
  async (id: string) => {
    const response = await apiClient.getProvider(id)
    return response.data
  }
)

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<SearchFilters>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    clearFilters: (state) => {
      state.filters = initialState.filters
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchProviders.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(searchProviders.fulfilled, (state, action) => {
        state.isLoading = false
        state.providers = action.payload.providers
        state.totalResults = action.payload.totalResults
        state.error = null
      })
      .addCase(searchProviders.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Search failed'
      })
  },
})

export const { setFilters, clearFilters, setPage, clearError } = searchSlice.actions
export default searchSlice.reducer

