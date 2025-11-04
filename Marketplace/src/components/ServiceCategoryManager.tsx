'use client'

import { useState, useEffect } from 'react'
import { SERVICE_CATEGORIES } from '@/constants/serviceCategories'
import { useAuth } from '@/contexts/AuthContext'

interface ServiceCategoryManagerProps {
  onUpdate?: () => void
}

export default function ServiceCategoryManager({ onUpdate }: ServiceCategoryManagerProps) {
  const { user } = useAuth()
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [maxCategories, setMaxCategories] = useState(2)

  useEffect(() => {
    loadCategories()
    loadTierLimits()
  }, [])

  const loadCategories = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/provider/categories`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSelectedCategories(data.categories || [])
      }
    } catch (err) {
      console.error('Error loading categories:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadTierLimits = () => {
    // Get limits based on subscription tier
    const tier = (user as any)?.subscription_tier_id || 'free'
    const limits: Record<string, number> = {
      'free': 2,
      'normal': 5,
      'pro': 999
    }
    setMaxCategories(limits[tier] || 2)
  }

  const toggleCategory = async (categoryId: string) => {
    const isSelected = selectedCategories.includes(categoryId)
    
    if (isSelected) {
      // Remove category
      const newCategories = selectedCategories.filter(c => c !== categoryId)
      await saveCategories(newCategories)
    } else {
      // Check limit
      if (selectedCategories.length >= maxCategories) {
        setError(`Вашият план позволява максимум ${maxCategories} специализации. Надстройте плана си за повече.`)
        setTimeout(() => setError(''), 5000)
        return
      }
      
      // Add category
      const newCategories = [...selectedCategories, categoryId]
      await saveCategories(newCategories)
    }
  }

  const saveCategories = async (categories: string[]) => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'}/provider/categories`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ categoryIds: categories })
        }
      )

      const data = await response.json()

      if (response.ok && data.success) {
        setSelectedCategories(categories)
        setSuccess('✅ Специализациите са обновени успешно!\n\nПромените са синхронизирани с мобилното приложение.')
        setTimeout(() => setSuccess(''), 5000)
        if (onUpdate) onUpdate()
      } else {
        setError(data.message || 'Грешка при обновяване на специализациите')
      }
    } catch (err) {
      console.error('Error saving categories:', err)
      setError('Грешка при обновяване на специализациите')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-white/20 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-white/20 rounded"></div>
            <div className="h-3 bg-white/20 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    )
  }

  const tierName = (user as any)?.subscription_tier_id === 'pro' ? 'PRO' : (user as any)?.subscription_tier_id === 'normal' ? 'NORMAL' : 'FREE'

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">🔧 Специализации</h2>
        <p className="text-sm text-slate-300">
          Изберете услугите, които предлагате ({selectedCategories.length}/{maxCategories === 999 ? '∞' : maxCategories})
        </p>
        {(user as any)?.subscription_tier_id === 'free' && (
          <div className="mt-2 p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-lg">
            <p className="text-xs text-yellow-300">
              💡 Надстройте до NORMAL (5 специализации) или PRO (неограничено) за повече възможности
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-400/30 rounded-lg">
          <p className="text-sm text-green-300">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {SERVICE_CATEGORIES.map((category) => {
          const isSelected = selectedCategories.includes(category.value)
          const isDisabled = !isSelected && selectedCategories.length >= maxCategories

          return (
            <button
              key={category.value}
              onClick={() => !isDisabled && toggleCategory(category.value)}
              disabled={saving || isDisabled}
              className={`
                p-4 rounded-lg border-2 transition-all text-left
                ${isSelected 
                  ? 'border-indigo-500 bg-indigo-500/20 text-white' 
                  : isDisabled
                    ? 'border-white/10 bg-white/5 text-slate-500 cursor-not-allowed'
                    : 'border-white/20 bg-white/5 text-white hover:border-white/40 hover:bg-white/10'
                }
                ${saving ? 'opacity-50 cursor-wait' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{category.label}</span>
                {isSelected && (
                  <span className="text-indigo-400">✓</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-400/30 rounded-lg">
        <p className="text-sm text-blue-300">
          <strong>Важно:</strong> Избраните специализации ще се показват на вашия профил и ще помогнат на клиентите да ви намерят по-лесно.
        </p>
      </div>
    </div>
  )
}
