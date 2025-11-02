'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { Header } from '@/components/Header'
import Link from 'next/link'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data?: any
  read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    fetchNotifications()
  }, [isAuthenticated, isLoading])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      console.log('🔔 Fetching notifications for user:', user?.id)
      
      const response = await apiClient.getUserNotifications()
      console.log('🔔 Notifications API response:', response)
      
      if (response.data?.success) {
        // Backend returns { data: { notifications: [...], pagination: {...} } }
        const notificationsData = response.data.data?.notifications || []
        console.log('🔔 Notifications data:', notificationsData)
        
        // Sort by created_at DESC to ensure newest first (safety measure)
        const sortedNotifications = [...notificationsData].sort((a, b) => {
          const dateA = new Date(a.created_at).getTime()
          const dateB = new Date(b.created_at).getTime()
          return dateB - dateA // DESC order (newest first)
        })
        
        console.log('🔔 Sorted notifications (newest first):', sortedNotifications.map(n => ({
          id: n.id.substring(0, 8),
          created_at: n.created_at,
          title: n.title
        })))
        
        setNotifications(sortedNotifications)
      } else {
        console.error('🔔 API returned unsuccessful response:', response.data)
        setError('Грешка при зареждането на известията')
      }
    } catch (err: any) {
      console.error('🔔 Error fetching notifications:', err)
      console.error('🔔 Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      })
      
      // Check if it's an authentication error
      if (err.response?.status === 401 || err.response?.status === 403) {
        console.log('🔔 Authentication error detected, but not redirecting to avoid loop')
        setError('Сесията ви е изтекла. Моля влезте отново в профила си.')
      } else if (err.response?.status === 404) {
        console.log('🔔 Notifications endpoint not found, showing empty state')
        setNotifications([]) // Show empty state instead of error
      } else {
        setError(`Възникна грешка при зареждането на известията: ${err.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await apiClient.markNotificationAsRead(notificationId)
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true }
            : notification
        )
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsAsRead()
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      )
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    console.log('🔔 Notification clicked:', notification.type, notification)
    
    // Mark as read if not already read
    if (!notification.read) {
      await markAsRead(notification.id)
    }

    // Handle different notification types
    if (notification.type === 'trial_expired' || notification.type === 'trial_expiring_soon' || notification.type === 'subscription_upgrade_required') {
      // Navigate to upgrade page
      console.log('🚀 Navigating to upgrade page...')
      router.push('/upgrade-required')
    } else if (notification.type === 'case_completed' && notification.data?.action === 'review_service') {
      const caseId = notification.data?.caseId
      if (caseId) {
        router.push(`/survey/${caseId}`)
      }
    } else if (notification.type === 'case_assigned') {
      // Navigate to dashboard cases page - case will be in "Моите заявки"
      const caseId = notification.data?.caseId
      if (caseId) {
        console.log('🔔 Navigating to case:', caseId)
        router.push('/dashboard/cases')
      } else {
        router.push('/dashboard/cases')
      }
    } else if (notification.type === 'case_accepted') {
      // Navigate to dashboard or case details
      router.push('/dashboard')
    } else if (notification.type === 'new_case_available') {
      // Navigate to available cases
      router.push('/dashboard?view=available')
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'trial_expired':
        return '🔒'
      case 'trial_expiring_soon':
        return '⚠️'
      case 'subscription_upgrade_required':
        return '💳'
      case 'case_completed':
        return '🌟'
      case 'case_assigned':
        return '📬'
      case 'case_accepted':
        return '✅'
      case 'case_declined':
        return '❌'
      case 'new_case_available':
        return '📋'
      case 'review_request':
      default:
        return '📢'
    }
  }

  const getNotificationGradient = (type: string) => {
    switch (type) {
      case 'trial_expired':
        return 'from-red-500/10 to-orange-500/10 border-red-400/30'
      case 'trial_expiring_soon':
        return 'from-yellow-500/10 to-amber-500/10 border-yellow-400/30'
      case 'subscription_upgrade_required':
        return 'from-purple-500/10 to-pink-500/10 border-purple-400/30'
      case 'case_completed':
        return 'from-yellow-500/10 to-orange-500/10 border-yellow-400/30'
      case 'case_assigned':
        return 'from-indigo-500/10 to-purple-500/10 border-indigo-400/30'
      case 'case_accepted':
        return 'from-green-500/10 to-emerald-500/10 border-green-400/30'
      case 'case_declined':
        return 'from-red-500/10 to-pink-500/10 border-red-400/30'
      case 'new_case_available':
        return 'from-blue-500/10 to-indigo-500/10 border-blue-400/30'
      case 'review_request':
        return 'from-purple-500/10 to-violet-500/10 border-purple-400/30'
      default:
        return 'from-slate-500/10 to-gray-500/10 border-slate-400/30'
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateString)
        return 'Невалидна дата'
      }
      
      // Always show date and time in Bulgaria timezone (GMT+3)
      const isToday = date.toDateString() === now.toDateString()
      const isThisYear = date.getFullYear() === now.getFullYear()
      
      if (isToday) {
        // Today: show only time in Bulgaria timezone
        return date.toLocaleTimeString('bg-BG', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Sofia'
        })
      } else {
        // Other days: show date and time in Bulgaria timezone
        return date.toLocaleString('bg-BG', {
          day: 'numeric',
          month: 'short',
          year: isThisYear ? undefined : 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Sofia'
        })
      }
    } catch (error) {
      console.error('Error formatting date:', error, dateString)
      return 'Невалидна дата'
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white/30 mx-auto"></div>
          <p className="mt-4 text-slate-300">Зареждане на известията...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-2">Грешка</h1>
          <p className="text-slate-300 mb-4">{error}</p>
          <button
            onClick={() => fetchNotifications()}
            className="bg-indigo-600/80 text-white px-6 py-2 rounded-lg hover:bg-indigo-600 transition-colors"
          >
            Опитай отново
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />

      {/* Test button to verify React is working */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <button 
          onClick={() => {
            console.log('✅ TEST BUTTON CLICKED - React is working!')
            alert('React is working!')
          }}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          TEST: Click me to verify React works
        </button>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-white">Известия</h1>
            </div>
            {notifications.some(n => !n.read) && (
              <button
                onClick={markAllAsRead}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
              >
                Маркирай всички като прочетени
              </button>
            )}
          </div>
        </div>
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-xl font-semibold text-white mb-2">Няма известия</h2>
            <p className="text-slate-300">Когато получите известия, те ще се появят тук.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => {
                  console.log('🔔 Card clicked!')
                  handleNotificationClick(notification)
                }}
                style={{ position: 'relative', zIndex: 1, pointerEvents: 'auto', cursor: 'pointer' }}
                className={`
                  bg-gradient-to-r ${getNotificationGradient(notification.type)} 
                  backdrop-blur-md border rounded-lg p-4 cursor-pointer transition-all duration-200 
                  hover:shadow-xl hover:scale-[1.01]
                  ${!notification.read ? 'ring-2 ring-indigo-400/50' : ''}
                `}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-white/20 border border-white/30 rounded-full flex items-center justify-center shadow-sm">
                      <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {notification.title}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-slate-300">
                          {formatDate(notification.created_at)}
                        </span>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                        )}
                      </div>
                    </div>
                    <p className="text-slate-200 mt-1">
                      {notification.message}
                    </p>
                    {notification.type === 'case_completed' && (
                      <div className="mt-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-400/30">
                          <span className="mr-1">⭐</span>
                          Натиснете за оценка
                        </span>
                      </div>
                    )}
                    {(notification.type === 'trial_expired' || notification.type === 'trial_expiring_soon' || notification.type === 'subscription_upgrade_required') && (
                      <div className="mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            console.log('🚀 Upgrade button clicked')
                            router.push('/upgrade-required')
                          }}
                          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500 transition-colors shadow-lg hover:shadow-xl"
                        >
                          <span className="mr-2">🚀</span>
                          Надстрой сега
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
