'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Header } from '@/components/Header'
import SMSLimitWidget from '@/components/SMSLimitWidget'

interface SMSConfig {
  isEnabled: boolean
  message: string
  sentCount: number
  lastSentTime?: number
  filterKnownContacts: boolean
  processedCalls: number
  userChatLinks?: {
    [userId: string]: {
      link: string
      token: string
      expiresAt: number
    }
  }
}

interface SMSStats {
  todayCount: number
  thisHourCount: number
  totalCount: number
}

export default function SMSSettingsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<SMSConfig>({
    isEnabled: false,
    message: 'Зает съм, ще върна обаждане след няколко минути.\n\nЗапочнете чат тук:\n[chat_link]\n\n',
    sentCount: 0,
    filterKnownContacts: true,
    processedCalls: 0
  })
  const [messageText, setMessageText] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [stats, setStats] = useState<SMSStats>({ todayCount: 0, thisHourCount: 0, totalCount: 0 })

  // Update preview when message text changes
  useEffect(() => {
    if (messageText && config.userChatLinks && user?.id) {
      const userLink = config.userChatLinks[user.id]
      if (userLink && userLink.link) {
        const preview = messageText.replace('[chat_link]', userLink.link)
        setPreviewText(preview)
      } else {
        setPreviewText(messageText)
      }
    } else {
      setPreviewText(messageText)
    }
  }, [messageText, config.userChatLinks, user?.id])

  useEffect(() => {
    // Don't redirect while auth is still loading
    if (authLoading) {
      return
    }

    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    if (user?.role !== 'tradesperson' && user?.role !== 'service_provider') {
      router.push('/')
      return
    }

    loadSMSConfig()
  }, [isAuthenticated, authLoading, user, router])

  const loadSMSConfig = async () => {
    try {
      setLoading(true)
      
      // Load SMS configuration from backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/sms/config`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        console.log('🔍 SMS Config loaded:', result)
        console.log('🔍 User ID:', user?.id)
        console.log('🔍 Config userChatLinks:', result.data?.config?.userChatLinks)
        
        if (result.success) {
          setConfig(result.data.config)
          setMessageText(result.data.config.message)
          
          // Replace [chat_link] with actual link for preview (same logic as mobile app)
          let preview = result.data.config.message
          console.log('🔍 Original message:', preview)
          
          if (result.data.config.userChatLinks && user?.id) {
            console.log('🔍 Looking for user chat link...')
            const userLink = result.data.config.userChatLinks[user.id]
            console.log('🔍 User link object:', userLink)
            
            if (userLink && userLink.link) {
              preview = preview.replace('[chat_link]', userLink.link)
              console.log('✅ Replaced [chat_link] with actual link:', userLink.link)
              console.log('✅ Preview text:', preview)
            } else {
              console.log('⚠️ No chat link found for user:', user.id)
              console.log('⚠️ Available user IDs:', Object.keys(result.data.config.userChatLinks))
            }
          } else {
            console.log('⚠️ No userChatLinks in config or no user ID')
          }
          
          setPreviewText(preview)
          setStats(result.data.stats || { todayCount: 0, thisHourCount: 0, totalCount: 0 })
        }
      } else {
        console.warn('Failed to load SMS config, using defaults')
      }
    } catch (error) {
      console.error('Error loading SMS config:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateSMSConfig = async (updates: Partial<SMSConfig>) => {
    try {
      setSaving(true)
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/sms/config`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setConfig(prev => ({ ...prev, ...updates }))
          alert('SMS настройките са запазени успешно!')
        } else {
          alert('Грешка при запазване на настройките')
        }
      } else {
        alert('Грешка при запазване на настройките')
      }
    } catch (error) {
      console.error('Error updating SMS config:', error)
      alert('Грешка при запазване на настройките')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSMS = async () => {
    await updateSMSConfig({ isEnabled: !config.isEnabled })
  }

  const handleUpdateMessage = async () => {
    if (!messageText.trim()) {
      alert('Съобщението не може да бъде празно')
      return
    }
    await updateSMSConfig({ message: messageText.trim() })
  }

  const handleToggleContactFilter = async () => {
    await updateSMSConfig({ filterKnownContacts: !config.filterKnownContacts })
  }

  const handleGenerateNewLink = async () => {
    try {
      setSaving(true)
      
      const authToken = localStorage.getItem('auth_token')
      console.log('🔗 Generating new chat link for user:', user?.id)
      console.log('🔗 Auth token available:', !!authToken)
      console.log('🔗 User object:', user)
      
      if (!authToken) {
        alert('Не сте влезли в системата. Моля влезте отново.')
        return
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'
      const fullUrl = `${apiUrl}/chat/tokens/regenerate`
      console.log('🔗 Making request to:', fullUrl)
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('🔗 Token generation response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('🔗 Token generation result:', result)
        
        if (result.success) {
          const chatUrl = result.data?.chatUrl
          console.log('🔗 Generated chat URL:', chatUrl)
          
          alert(`Нова чат връзка е генерирана успешно!\n\nВръзка: ${chatUrl || 'Проверете конзолата за детайли'}\n\nТокен: ${result.data?.token?.substring(0, 4)}****`)
          
          // Update the preview with the new link
          if (chatUrl) {
            const newPreview = messageText.replace('[chat_link]', chatUrl)
            setPreviewText(newPreview)
          }
          
          loadSMSConfig() // Refresh to show new link
        } else {
          console.error('🔗 Token generation failed:', result)
          alert('Грешка при генериране на нова връзка: ' + (result.error?.message || 'Неизвестна грешка'))
        }
      } else {
        const errorText = await response.text()
        console.error('🔗 Token generation failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        })
        alert(`Грешка при генериране на нова връзка: ${response.status} ${response.statusText}\n\nДетайли: ${errorText}`)
      }
    } catch (error: any) {
      console.error('🔗 Error generating new link:', error)
      alert('Грешка при генериране на нова връзка: ' + (error?.message || 'Неизвестна грешка'))
    } finally {
      setSaving(false)
    }
  }

  const handleClearHistory = async () => {
    if (!confirm('Сигурни ли сте, че искате да изчистите историята на SMS? Само НОВИ пропуснати обаждания ще получават SMS след това.')) {
      return
    }

    try {
      setSaving(true)
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/sms/history/clear`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        alert('Историята на SMS е изчистена успешно!')
        loadSMSConfig() // Refresh stats
      } else {
        alert('Грешка при изчистване на историята')
      }
    } catch (error) {
      console.error('Error clearing SMS history:', error)
      alert('Грешка при изчистване на историята')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Зареждане на SMS настройки...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">SMS Настройки</h1>
          <p className="mt-2 text-slate-300">
            Управлявайте автоматичните SMS съобщения за пропуснати обаждания
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Automation Settings (Merged Status & Filter) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span className="text-2xl mr-2">⚙️</span>
                  Настройки за Автоматизация
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Auto SMS Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white">Автоматични SMS</h3>
                    <p className="text-slate-300">
                      {config.isEnabled ? 'Включени - SMS ще се изпращат при пропуснати обаждания' : 'Изключени - няма да се изпращат SMS'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleSMS}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      config.isEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="h-px bg-white/10" />

                {/* Contact Filter Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white">Филтриране на контакти</h3>
                    <p className="text-slate-300">
                      {config.filterKnownContacts ? 'Включено - SMS ще се изпращат само на непознати номера' : 'Изключено - SMS ще се изпращат на всички номера'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleContactFilter}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      config.filterKnownContacts ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.filterKnownContacts ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* SMS Template */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span className="text-2xl mr-2">✏️</span>
                  SMS Шаблон
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Съобщение за SMS
                  </label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-slate-400"
                    rows={4}
                    placeholder="Зает съм, ще върна обаждане след няколко минути.\n\nЗапочнете чат тук:\n[chat_link]\n\n"
                  />
                  <p className="mt-1 text-sm text-slate-400">
                    💡 Използвайте [chat_link] където искате да се появи автоматично обновяващата се чат връзка
                  </p>
                </div>

                {/* SMS Preview */}
                <div className="bg-indigo-500/10 border-l-4 border-indigo-400/50 p-4 rounded backdrop-blur-sm">
                  <h4 className="text-sm font-medium text-indigo-300 mb-2">📱 Преглед на SMS:</h4>
                  <p className="text-sm text-indigo-200 whitespace-pre-wrap">
                    {previewText || 'Зареждане на преглед...'}
                  </p>
                  <p className="text-xs text-indigo-300 mt-2 italic">
                    Това е съобщението, което клиентите ще получат
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleUpdateMessage}
                    disabled={saving}
                    className="flex-1 bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30 rounded-md px-4 py-2 font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Запазване...' : 'Обнови Шаблон'}
                  </button>
                  <button
                    onClick={handleGenerateNewLink}
                    disabled={saving}
                    className="bg-green-500/20 backdrop-blur-sm border border-green-400/30 text-green-300 hover:bg-green-500/30 rounded-md px-4 py-2 font-medium transition-colors disabled:opacity-50"
                  >
                    🔄 Нова Връзка
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* SMS Limit Widget */}
            <SMSLimitWidget compact={false} showPurchaseButton={true} />
          </div>
        </div>
      </div>
    </div>
  )
}
