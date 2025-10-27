'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'customer' | 'tradesperson' | 'service_provider' | 'admin'
  phoneNumber?: string
  companyName?: string
  serviceCategory?: string
  profileImageUrl?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; debugInfo?: any }>
  logout: () => void
  register: (userData: any) => Promise<boolean>
  refreshToken: () => Promise<boolean>
  updateUser: (updatedUser: User) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing auth token on app load
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const userData = localStorage.getItem('user_data')
      
      console.log('🔍 AuthContext - Checking auth status:', { 
        hasToken: !!token, 
        hasUserData: !!userData,
        tokenPreview: token ? token.substring(0, 20) + '...' : null
      })
      
      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData)
          
          // Fetch profile image if user is a service provider
          if (parsedUser.role === 'tradesperson' || parsedUser.role === 'service_provider') {
            try {
              console.log('🖼️ AuthContext - Fetching profile image for user:', parsedUser.id)
              const profileResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/marketplace/providers/${parsedUser.id}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              })
              const profileData = await profileResponse.json()
              console.log('🖼️ AuthContext - Profile data response:', profileData)
              console.log('🖼️ AuthContext - Profile image URL from API:', profileData.data?.profileImageUrl)
              
              if (profileData.success && profileData.data?.profileImageUrl) {
                parsedUser.profileImageUrl = profileData.data.profileImageUrl
                console.log('✅ AuthContext - Set profile image URL:', parsedUser.profileImageUrl)
                // Update localStorage with profile image
                localStorage.setItem('user_data', JSON.stringify(parsedUser))
              } else {
                console.log('⚠️ AuthContext - No profile image URL in response')
              }
            } catch (profileError) {
              console.log('❌ AuthContext - Could not fetch profile image:', profileError)
            }
          }
          
          setUser(parsedUser)
          console.log('✅ AuthContext - Loaded user from localStorage:', parsedUser)
        } catch (parseError) {
          console.error('❌ AuthContext - Error parsing user data:', parseError)
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user_data')
        }
      } else {
        console.log('⚠️ AuthContext - No token or user data found')
      }
    } catch (error) {
      console.error('❌ AuthContext - Auth check error:', error)
      // Clear potentially corrupted data
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_data')
    } finally {
      setIsLoading(false)
      console.log('✅ AuthContext - Auth check complete, isLoading set to false')
    }
  }

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; debugInfo?: any }> => {
    try {
      console.log('🔐 AuthContext - Starting login process...')
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      })

      const result = await response.json()
      console.log('🔐 AuthContext - Login response:', result)

      if (result.success && result.data?.tokens?.accessToken) {
        console.log('✅ AuthContext - Login successful, updating state...')
        
        // Store tokens and user data
        localStorage.setItem('auth_token', result.data.tokens.accessToken)
        if (result.data.tokens.refreshToken) {
          localStorage.setItem('refresh_token', result.data.tokens.refreshToken)
        }
        
        const loggedInUser = result.data.user
        
        // Fetch profile image immediately after login for service providers
        if (loggedInUser.role === 'tradesperson' || loggedInUser.role === 'service_provider') {
          try {
            console.log('🖼️ AuthContext - Fetching profile image after login for user:', loggedInUser.id)
            const profileResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/marketplace/providers/${loggedInUser.id}`, {
              headers: {
                'Authorization': `Bearer ${result.data.tokens.accessToken}`
              }
            })
            const profileData = await profileResponse.json()
            console.log('🖼️ AuthContext - Profile data after login:', profileData)
            console.log('🖼️ AuthContext - Profile image URL:', profileData.data?.profileImageUrl)
            
            if (profileData.success && profileData.data?.profileImageUrl) {
              loggedInUser.profileImageUrl = profileData.data.profileImageUrl
              console.log('✅ AuthContext - Set profile image URL after login:', loggedInUser.profileImageUrl)
            } else {
              console.log('⚠️ AuthContext - No profile image URL in response after login')
            }
          } catch (profileError) {
            console.log('❌ AuthContext - Could not fetch profile image after login:', profileError)
          }
        }
        
        // Store updated user data with profile image
        localStorage.setItem('user_data', JSON.stringify(loggedInUser))
        
        // Update state immediately
        setUser(loggedInUser)
        setIsLoading(false)
        
        console.log('✅ AuthContext - User state updated:', loggedInUser)
        
        // Dispatch custom event for any components listening
        window.dispatchEvent(new CustomEvent('auth-state-changed', { 
          detail: { user: loggedInUser, isAuthenticated: true }
        }))
        
        return { success: true }
      } else {
        console.error('❌ AuthContext - Login failed:', result)
        
        // Extract detailed error message and debug info
        const errorMessage = result.error?.message || 'Login failed. Please check your credentials.';
        const debugInfo = result.error?.details || null;
        
        console.log('🔍 AuthContext - Error details:', {
          message: errorMessage,
          debugInfo: debugInfo
        });
        
        return { 
          success: false, 
          error: errorMessage,
          debugInfo: debugInfo
        }
      }
    } catch (error) {
      console.error('❌ AuthContext - Login error:', error)
      return { 
        success: false, 
        error: 'Network error. Please check your connection and try again.'
      }
    }
  }

  const register = async (userData: any): Promise<boolean> => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      })

      const result = await response.json()

      if (result.success && result.data?.tokens?.accessToken) {
        localStorage.setItem('auth_token', result.data.tokens.accessToken)
        if (result.data.tokens.refreshToken) {
          localStorage.setItem('refresh_token', result.data.tokens.refreshToken)
        }
        localStorage.setItem('user_data', JSON.stringify(result.data.user))
        setUser(result.data.user)
        return true
      }
      return false
    } catch (error) {
      console.error('Registration error:', error)
      return false
    }
  }

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const refreshTokenValue = localStorage.getItem('refresh_token')
      if (!refreshTokenValue) {
        return false
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: refreshTokenValue })
      })

      const result = await response.json()

      if (result.success && result.data?.accessToken) {
        localStorage.setItem('auth_token', result.data.accessToken)
        if (result.data.refreshToken) {
          localStorage.setItem('refresh_token', result.data.refreshToken)
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Token refresh error:', error)
      return false
    }
  }, [])

  const logout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_data')
    setUser(null)
  }

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser)
    localStorage.setItem('user_data', JSON.stringify(updatedUser))
    console.log('✅ AuthContext - User updated:', updatedUser)
  }

  // Auto-refresh token every 90 minutes (before 2h expiration)
  useEffect(() => {
    if (!user) return

    const interval = setInterval(async () => {
      const success = await refreshToken()
      if (!success) {
        console.log('Token refresh failed, logging out user')
        logout()
      }
    }, 90 * 60 * 1000) // 90 minutes

    return () => clearInterval(interval)
  }, [user, refreshToken])

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    register,
    refreshToken,
    updateUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
