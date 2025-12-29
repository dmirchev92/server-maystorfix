'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from '@/components/Header'
import apiClient from '@/lib/api'
import { sofiaNeighborhoods } from '@/components/NeighborhoodSelect'
import ServiceCategoryManager from '@/components/ServiceCategoryManager'

interface ProfileData {
  firstName: string
  lastName: string
  phoneNumber: string
  email: string
  businessName?: string
  serviceCategory?: string
  description?: string
  experienceYears?: number
  hourlyRate?: number
  city?: string
  neighborhood?: string
  address?: string
  profileImageUrl?: string
}

export default function SettingsPage() {
  const { user, isAuthenticated, updateUser } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeSection, setActiveSection] = useState<'menu' | 'profile' | 'password' | 'delete'>('menu')
  const [deletePassword, setDeletePassword] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Profile form state
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    businessName: '',
    serviceCategory: '',
    description: '',
    experienceYears: 0,
    hourlyRate: 0,
    city: '',
    neighborhood: '',
    address: '',
    profileImageUrl: ''
  })

  // Gallery state
  const [galleryImages, setGalleryImages] = useState<string[]>([])

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Cities data (same as case filters and search)
  const cities = ['София', 'Пловдив', 'Варна', 'Бургас']

  // Get neighborhoods based on selected city
  const getNeighborhoods = () => {
    if (profileData.city === 'София') {
      return sofiaNeighborhoods
    }
    return [] // Only Sofia has neighborhoods for now
  }

  useEffect(() => {
    // Redirect if not authenticated
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    // Load current profile data
    if (user) {
      loadProfileData()
    }
  }, [isAuthenticated, router, user])

  // Check for URL parameter to auto-open section
  useEffect(() => {
    const section = searchParams.get('section')
    if (section === 'profile') {
      setActiveSection('profile')
    } else if (section === 'password') {
      setActiveSection('password')
    }
  }, [searchParams])

  const loadProfileData = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getProvider(user!.id)
      const providerData = response.data.data
      
      console.log('📥 Loaded provider data:', providerData)
      
      setProfileData({
        firstName: providerData.firstName || '',
        lastName: providerData.lastName || '',
        phoneNumber: providerData.phoneNumber || providerData.profilePhone || '',
        email: providerData.email || providerData.profileEmail || '',
        businessName: providerData.businessName || '',
        serviceCategory: providerData.serviceCategory || '',
        description: providerData.description || '',
        experienceYears: providerData.experienceYears || 0,
        hourlyRate: providerData.hourlyRate || 0,
        city: providerData.city || '',
        neighborhood: providerData.neighborhood || '',
        address: providerData.address || '',
        profileImageUrl: providerData.profileImageUrl || ''
      })
      
      // Load gallery images
      if (providerData.gallery && Array.isArray(providerData.gallery)) {
        setGalleryImages(providerData.gallery)
      }
    } catch (err: any) {
      console.error('❌ Error loading profile:', err)
      setError('Грешка при зареждане на профила')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      // Use the same endpoint as mobile app: POST /marketplace/providers/profile
      const payload = {
        userId: user!.id,
        profile: {
          // Personal info (updates users table)
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          phoneNumber: profileData.phoneNumber,
          // Business info (updates service_provider_profiles table)
          businessName: profileData.businessName,
          serviceCategory: profileData.serviceCategory,
          description: profileData.description,
          experienceYears: profileData.experienceYears,
          hourlyRate: profileData.hourlyRate,
          city: profileData.city,
          neighborhood: profileData.neighborhood,
          address: profileData.address,
          email: profileData.email,
          profileImageUrl: profileData.profileImageUrl
        },
        gallery: galleryImages
      }

      console.log('📤 Updating profile with payload:', payload)
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1'}/marketplace/providers/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Неуспешно актуализиране на профила')
      }

      console.log('✅ Profile updated successfully:', result)

      // Update AuthContext with new profile data including image
      const updatedUserData = {
        ...user!,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phoneNumber: profileData.phoneNumber,
        profileImageUrl: profileData.profileImageUrl
      }
      
      console.log('💾 Updating user data with profile image:', updatedUserData)
      
      if (updateUser) {
        updateUser(updatedUserData as any)
      }
      
      // Also update localStorage directly to ensure it persists
      localStorage.setItem('user_data', JSON.stringify(updatedUserData))

      setSuccess('✅ Профилът е актуализиран успешно! Промените са видими навсякъде в системата (включително мобилното приложение).')
      
      // Reload profile data to show updated values
      await loadProfileData()
      
      setTimeout(() => {
        setActiveSection('menu')
        setSuccess('')
      }, 3000)
    } catch (err: any) {
      console.error('❌ Error updating profile:', err)
      setError(err.message || 'Грешка при актуализация на профила')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validate passwords
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Новите пароли не съвпадат')
      return
    }

    if (passwordData.newPassword.length < 8) {
      setError('Новата парола трябва да е поне 8 символа')
      return
    }

    setLoading(true)

    try {
      await apiClient.updateProfile({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })

      setSuccess('✅ Паролата е променена успешно!')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setTimeout(() => {
        setActiveSection('menu')
        setSuccess('')
      }, 2000)
    } catch (err: any) {
      console.error('Error changing password:', err)
      setError(err.response?.data?.error?.message || 'Грешка при смяна на паролата')
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated || (user?.role !== 'tradesperson' && user?.role !== 'service_provider')) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">⚙️ Настройки</h1>
              <p className="text-slate-300">Управлявайте вашия профил и настройки</p>
            </div>
            {activeSection !== 'menu' && (
              <button
                onClick={() => {
                  setActiveSection('menu')
                  setError('')
                  setSuccess('')
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                ← Назад
              </button>
            )}
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-500/20 border border-green-500/50 text-green-100 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-100 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Main Menu */}
        {activeSection === 'menu' && (
          <>
            {/* Profile Section */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">👤 Профил</h2>
              <div className="space-y-3">
                <button
                  onClick={() => setActiveSection('profile')}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-white/10 rounded-lg border-b border-white/20 transition-colors"
                >
                  <span className="text-slate-200">Редактирай профил</span>
                  <span className="text-slate-400 text-xl">›</span>
                </button>
                <button
                  onClick={() => setActiveSection('password')}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-white/10 rounded-lg border-b border-white/20 transition-colors"
                >
                  <span className="text-slate-200">Смени парола</span>
                  <span className="text-slate-400 text-xl">›</span>
                </button>
              </div>
            </div>

            {/* Service Categories Section */}
            <div className="mb-6">
              <ServiceCategoryManager onUpdate={loadProfileData} />
            </div>

            {/* Information Section */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">ℹ️ Информация</h2>
              <div className="space-y-3">
                <div className="p-3 text-slate-300 text-sm bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="font-semibold mb-2">💡 Важно за консистентността на данните:</p>
                  <p className="mb-2">Когато промените вашето име, бизнес име, снимка или локация, промените автоматично се отразяват навсякъде в системата:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Всички ваши отзиви ще показват новото име</li>
                    <li>Препоръките ви ще използват актуалната информация</li>
                    <li>Кликовете по препоръки ще продължат да се броят правилно</li>
                    <li>Профилът ви ще изглежда еднакво за всички клиенти</li>
                    <li>Синхронизация с мобилното приложение</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Edit Profile Form */}
        {activeSection === 'profile' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">✏️ Редактирай профил</h2>
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              {/* Profile Picture */}
              <div className="space-y-4 pb-6 border-b border-white/20">
                <h3 className="text-lg font-medium text-white">Профилна снимка</h3>
                <div className="flex items-center gap-6">
                  {/* Avatar Preview */}
                  <div className="relative">
                    {profileData.profileImageUrl ? (
                      <img
                        src={profileData.profileImageUrl}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover border-4 border-white/20"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border-4 border-white/20">
                        <span className="text-white text-3xl font-bold">
                          {profileData.firstName?.charAt(0)}{profileData.lastName?.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Upload Button */}
                  <div className="flex-1">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return

                          // Check file size (max 5MB)
                          if (file.size > 5 * 1024 * 1024) {
                            setError('Файлът е твърде голям. Максимален размер: 5MB')
                            return
                          }

                          try {
                            setLoading(true)
                            setError('')

                            // Convert to base64
                            const reader = new FileReader()
                            reader.onloadend = async () => {
                              const base64 = reader.result as string
                              const base64Data = base64.split(',')[1] // Remove data:image/...;base64, prefix

                              try {
                                // Upload image
                                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1'}/uploads/image`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                                  },
                                  body: JSON.stringify({
                                    userId: user!.id,
                                    filename: `avatar-${Date.now()}.jpg`,
                                    data: base64Data
                                  })
                                })

                                const result = await response.json()

                                if (result.success) {
                                  // result.data.url is like "/uploads/userId/filename.jpg"
                                  // We need to use the base URL without /api/v1
                                  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1').replace('/api/v1', '')
                                  const imageUrl = `${baseUrl}${result.data.url}`
                                  console.log('Image URL:', imageUrl)
                                  setProfileData({ ...profileData, profileImageUrl: imageUrl })
                                  setSuccess('✅ Снимката е качена успешно!')
                                  setTimeout(() => setSuccess(''), 3000)
                                } else {
                                  throw new Error(result.error?.message || 'Неуспешно качване на снимката')
                                }
                              } catch (err: any) {
                                console.error('Error uploading image:', err)
                                setError('Грешка при качване на снимката')
                              } finally {
                                setLoading(false)
                              }
                            }
                            reader.readAsDataURL(file)
                          } catch (err) {
                            console.error('Error reading file:', err)
                            setError('Грешка при четене на файла')
                            setLoading(false)
                          }
                        }}
                      />
                      <div className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition-all cursor-pointer text-center font-medium">
                        📷 Качи нова снимка
                      </div>
                    </label>
                    <p className="text-xs text-slate-400 mt-2">
                      Препоръчителен размер: 400x400px. Максимум 5MB.
                    </p>
                    {profileData.profileImageUrl && (
                      <button
                        type="button"
                        onClick={() => setProfileData({ ...profileData, profileImageUrl: '' })}
                        className="mt-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                      >
                        🗑️ Премахни снимката
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Gallery Images */}
              <div className="space-y-4 pb-6 border-b border-white/20">
                <h3 className="text-lg font-medium text-white">Галерия с работи ({galleryImages.length}/3)</h3>
                <p className="text-sm text-slate-400">Качете до 3 снимки на вашите завършени проекти</p>
                
                {/* Gallery Grid */}
                <div className="grid grid-cols-3 gap-4">
                  {galleryImages.map((imageUrl, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={imageUrl}
                        alt={`Gallery ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border-2 border-white/20"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newGallery = galleryImages.filter((_, i) => i !== index)
                          setGalleryImages(newGallery)
                        }}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  
                  {/* Upload Button */}
                  {galleryImages.length < 3 && (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return

                          // Check file size (max 5MB)
                          if (file.size > 5 * 1024 * 1024) {
                            setError('Файлът е твърде голям. Максимален размер: 5MB')
                            return
                          }

                          try {
                            setLoading(true)
                            setError('')

                            // Convert to base64
                            const reader = new FileReader()
                            reader.onloadend = async () => {
                              const base64 = reader.result as string
                              const base64Data = base64.split(',')[1]

                              try {
                                // Upload image
                                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1'}/uploads/image`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                                  },
                                  body: JSON.stringify({
                                    userId: user!.id,
                                    filename: `gallery-${Date.now()}.jpg`,
                                    data: base64Data
                                  })
                                })

                                const result = await response.json()

                                if (result.success) {
                                  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1').replace('/api/v1', '')
                                  const imageUrl = `${baseUrl}${result.data.url}`
                                  setGalleryImages([...galleryImages, imageUrl])
                                  setSuccess('✅ Снимката е качена успешно!')
                                  setTimeout(() => setSuccess(''), 3000)
                                } else {
                                  throw new Error(result.error?.message || 'Неуспешно качване на снимката')
                                }
                              } catch (err: any) {
                                console.error('Error uploading gallery image:', err)
                                setError('Грешка при качване на снимката')
                              } finally {
                                setLoading(false)
                              }
                            }
                            reader.readAsDataURL(file)
                          } catch (err) {
                            console.error('Error reading file:', err)
                            setError('Грешка при четене на файла')
                            setLoading(false)
                          }
                        }}
                      />
                      <div className="w-full h-32 border-2 border-dashed border-white/30 rounded-lg flex flex-col items-center justify-center hover:border-indigo-400 hover:bg-white/5 transition-all cursor-pointer">
                        <span className="text-3xl mb-2">📸</span>
                        <span className="text-xs text-slate-300">Качи снимка</span>
                      </div>
                    </label>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Максимум 5MB на снимка. Препоръчителен размер: 800x600px.
                </p>
              </div>

              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white">Лична информация</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Име *
                    </label>
                    <input
                      type="text"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Фамилия *
                    </label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Телефон *
                  </label>
                  <input
                    type="tel"
                    value={profileData.phoneNumber}
                    onChange={(e) => setProfileData({ ...profileData, phoneNumber: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email (не може да се променя)
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Business Information */}
              <div className="space-y-4 pt-6 border-t border-white/20">
                <h3 className="text-lg font-medium text-white">Бизнес информация</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Име на бизнеса
                  </label>
                  <input
                    type="text"
                    value={profileData.businessName}
                    onChange={(e) => setProfileData({ ...profileData, businessName: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Напр. Електро Експерт ЕООД"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Описание
                  </label>
                  <textarea
                    value={profileData.description}
                    onChange={(e) => setProfileData({ ...profileData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Опишете вашите услуги и опит..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Години опит
                    </label>
                    <input
                      type="number"
                      value={profileData.experienceYears}
                      onChange={(e) => setProfileData({ ...profileData, experienceYears: parseInt(e.target.value) || 0 })}
                      min="0"
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Цена на час (лв)
                    </label>
                    <input
                      type="number"
                      value={profileData.hourlyRate}
                      onChange={(e) => setProfileData({ ...profileData, hourlyRate: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4 pt-6 border-t border-white/20">
                <h3 className="text-lg font-medium text-white">Локация</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Град
                    </label>
                    <select
                      value={profileData.city}
                      onChange={(e) => setProfileData({ ...profileData, city: e.target.value, neighborhood: '' })}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" className="bg-slate-800">Изберете град</option>
                      {cities.map((city) => (
                        <option key={city} value={city} className="bg-slate-800">
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Квартал
                    </label>
                    <select
                      value={profileData.neighborhood}
                      onChange={(e) => setProfileData({ ...profileData, neighborhood: e.target.value })}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!profileData.city || getNeighborhoods().length === 0}
                    >
                      <option value="" className="bg-slate-800">
                        {!profileData.city ? 'Първо изберете град' : 'Изберете квартал'}
                      </option>
                      {getNeighborhoods().map((neighborhood) => (
                        <option key={neighborhood} value={neighborhood} className="bg-slate-800">
                          {neighborhood}
                        </option>
                      ))}
                    </select>
                    {profileData.city && getNeighborhoods().length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        Кварталите за {profileData.city} скоро ще бъдат добавени
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Адрес
                  </label>
                  <input
                    type="text"
                    value={profileData.address}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ул. Примерна 123"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6 border-t border-white/20">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Запазване...' : '💾 Запази промените'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Change Password Form */}
        {activeSection === 'password' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">🔒 Смени парола</h2>
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Текуща парола *
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Нова парола *
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={8}
                />
                <p className="text-xs text-slate-400 mt-1">Минимум 8 символа</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Потвърди нова парола *
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="pt-6 border-t border-white/20">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Запазване...' : '🔑 Смени паролата'}
                </button>
              </div>
            </form>

            {/* Delete Account Section */}
            <div className="mt-8 pt-6 border-t border-red-500/30">
              <h3 className="text-lg font-semibold text-red-400 mb-4">⚠️ Опасна зона</h3>
              <p className="text-sm text-slate-400 mb-4">
                Изтриването на акаунта е необратимо. Всички ваши данни, заявки, чатове и история ще бъдат загубени завинаги.
              </p>
              
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                >
                  🗑️ Изтрий акаунта ми
                </button>
              ) : (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-4">
                  <p className="text-red-400 font-medium">
                    Сигурни ли сте? Това действие не може да бъде отменено!
                  </p>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">
                      Въведете паролата си за потвърждение:
                    </label>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-red-500/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Вашата парола"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
                    >
                      Отказ
                    </button>
                    <button
                      type="button"
                      disabled={!deletePassword || loading}
                      onClick={async () => {
                        if (!deletePassword) return;
                        setLoading(true);
                        try {
                          const response = await apiClient.deleteAccount(deletePassword);
                          if (response.data.success) {
                            alert('Акаунтът ви беше изтрит успешно.');
                            localStorage.removeItem('auth_token');
                            localStorage.removeItem('user_data');
                            router.push('/auth/login');
                          } else {
                            setError(response.data.error?.message || 'Грешка при изтриване на акаунта');
                          }
                        } catch (err: any) {
                          setError(err.response?.data?.error?.message || 'Грешка при изтриване на акаунта');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Изтриване...' : 'Да, изтрий акаунта ми'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
