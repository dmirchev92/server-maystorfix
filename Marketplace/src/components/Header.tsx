'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Navigation } from '@/components/ui/Navigation'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'

export function Header() {
  const { user, isAuthenticated, logout } = useAuth()
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch unread notifications count
  useEffect(() => {
    if (!isAuthenticated || !user) return

    const fetchUnreadCount = async () => {
      try {
        console.log('🔔 Fetching unread notification count for user:', user?.id)
        const response = await apiClient.getUnreadNotificationCount()
        console.log('🔔 Unread count response:', response.data)
        if (response.data?.success) {
          const count = response.data.data?.count || 0
          console.log('🔔 Setting unread count to:', count)
          setUnreadCount(count)
        } else {
          console.warn('🔔 Unread count response not successful:', response.data)
        }
      } catch (error) {
        console.error('❌ Error fetching unread count:', error)
      }
    }

    fetchUnreadCount()

    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated, user])

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <Navigation 
      user={user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: (user as any).profileImageUrl || undefined,
        subscription_tier_id: (user as any).subscription_tier_id
      } : undefined}
      unreadCount={unreadCount}
      onLogout={handleLogout}
    />
  )
}
