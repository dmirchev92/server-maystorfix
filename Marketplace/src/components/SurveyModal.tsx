'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'

interface SurveyModalProps {
  isOpen: boolean
  onClose: () => void
  caseId: string
  providerId: string
  providerName: string
  onSubmitSuccess?: () => void
}

interface SurveyData {
  rating: number
  comment: string
  communication?: number
  quality?: number
  timeliness?: number
  valueForMoney?: number
  wouldRecommend?: boolean
}

export default function SurveyModal({
  isOpen,
  onClose,
  caseId,
  providerId,
  providerName,
  onSubmitSuccess
}: SurveyModalProps) {
  const { user } = useAuth()
  const [surveyData, setSurveyData] = useState<SurveyData>({
    rating: 0,
    comment: '',
    communication: 0,
    quality: 0,
    timeliness: 0,
    valueForMoney: 0,
    wouldRecommend: undefined
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate overall rating based on individual ratings with half stars
  const calculateOverallRating = (communication: number, quality: number, timeliness: number, valueForMoney: number) => {
    const ratings = [communication, quality, timeliness, valueForMoney].filter(r => r > 0)
    if (ratings.length === 0) return 0
    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    // Round to nearest 0.5 (e.g., 3.2 -> 3.0, 3.3 -> 3.5, 3.7 -> 4.0)
    return Math.round(average * 2) / 2
  }

  // Reusable SVG Star component for consistent shapes
  const Star = ({
    variant,
    size = 24,
  }: { variant: 'full' | 'half' | 'empty'; size?: number }) => {
    // Unique id for gradient per star instance
    const id = Math.random().toString(36).slice(2)
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="inline-block align-middle"
      >
        {variant === 'half' && (
          <defs>
            <linearGradient id={`half-${id}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#64748b" />
            </linearGradient>
          </defs>
        )}
        <path
          d="M12 .587l3.668 7.429 8.2 1.192-5.934 5.786 1.402 8.173L12 18.896l-7.336 3.871 1.402-8.173L.132 9.208l8.2-1.192L12 .587z"
          fill={
            variant === 'full'
              ? '#fbbf24' // yellow-400
              : variant === 'half'
              ? `url(#half-${id})`
              : '#64748b' // slate-500
          }
        />
      </svg>
    )
  }

  const handleStarClick = (field: keyof SurveyData, value: number) => {
    setSurveyData(prev => {
      const newData = { ...prev, [field]: value }
      
      // If updating individual ratings, recalculate overall rating
      if (field !== 'rating') {
        const communication = field === 'communication' ? value : prev.communication || 0
        const quality = field === 'quality' ? value : prev.quality || 0
        const timeliness = field === 'timeliness' ? value : prev.timeliness || 0
        const valueForMoney = field === 'valueForMoney' ? value : prev.valueForMoney || 0
        
        const overallRating = calculateOverallRating(communication, quality, timeliness, valueForMoney)
        
        newData.rating = overallRating
      }
      
      return newData
    })
  }

  // Render stars for display (overall rating) with proper half support
  const renderStarsDisplay = (rating: number) => {
    const stars: JSX.Element[] = []
    const full = Math.floor(rating)
    const hasHalf = Math.abs(rating - full - 0.5) < 1e-9

    for (let i = 1; i <= 5; i++) {
      if (i <= full) {
        stars.push(<Star key={i} variant="full" />)
      } else if (i === full + 1 && hasHalf) {
        stars.push(<Star key={i} variant="half" />)
      } else {
        stars.push(<Star key={i} variant="empty" />)
      }
    }
    return stars
  }

  const renderStars = (field: keyof SurveyData, currentValue: number) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isSelected = star <= currentValue
          return (
            <button
              key={star}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                handleStarClick(field, star)
              }}
              className="transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50 rounded"
              title={`Оценка ${star} от 5`}
            >
              <Star variant={isSelected ? 'full' : 'empty'} />
            </button>
          )
        })}
        {currentValue > 0 && (
          <span className="ml-2 text-sm text-slate-400">
            {currentValue}/5
          </span>
        )}
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (surveyData.rating === 0) {
      setError('Моля поставете поне една оценка от категориите по-долу')
      return
    }

    // Prevent Service Providers from reviewing themselves
    if (user?.id === providerId) {
      setError('❌ Грешка: Не можете да оставите оценка за себе си като специалист.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const reviewPayload = {
        caseId,
        providerId,
        rating: surveyData.rating,
        comment: surveyData.comment,
        communication: surveyData.communication || undefined,
        serviceQuality: surveyData.quality || undefined,
        timeliness: surveyData.timeliness || undefined,
        valueForMoney: surveyData.valueForMoney || undefined,
        wouldRecommend: surveyData.wouldRecommend
      }
      
      await apiClient.createReview(reviewPayload)

      onSubmitSuccess?.()
      onClose()
    } catch (err: any) {
      console.error('Error submitting survey:', err)
      const errorMessage = err.response?.data?.error?.message || err.response?.data?.message || err.message
      
      if (err.response?.status === 409 || errorMessage?.includes('already exists')) {
        setError('Вие вече сте оценили тази услуга. Не можете да изпратите повторна оценка.')
      } else {
        setError(errorMessage || 'Възникна грешка при изпращането на оценката')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Оценете услугата</h2>
              <p className="text-slate-300 mt-1">Как оценявате работата на {providerName}?</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-2xl transition-colors"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-4 mb-6">
              <p className="text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Overall Rating - Auto-calculated */}
            <div>
              <label className="block text-lg font-semibold text-white mb-3">
                Обща оценка <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center space-x-2 mb-2">
                <div className="flex space-x-1">
                  {renderStarsDisplay(surveyData.rating)}
                </div>
                <span className="ml-2 text-lg font-medium text-slate-200">
                  {surveyData.rating > 0 ? `${surveyData.rating}/5` : 'Не е оценено'}
                </span>
              </div>
              <p className="text-sm text-indigo-400 mt-2">
                Общата оценка се изчислява автоматично като средна стойност (с половин звезди)
              </p>
            </div>

            {/* Detailed Ratings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Комуникация
                </label>
                {renderStars('communication', surveyData.communication || 0)}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Качество на работата
                </label>
                {renderStars('quality', surveyData.quality || 0)}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Спазване на срокове
                </label>
                {renderStars('timeliness', surveyData.timeliness || 0)}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Цена
                </label>
                {renderStars('valueForMoney', surveyData.valueForMoney || 0)}
              </div>
            </div>

            {/* Would Recommend */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-3">
                Бихте ли препоръчали този специалист?
              </label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setSurveyData(prev => ({ ...prev, wouldRecommend: true }))}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    surveyData.wouldRecommend === true
                      ? 'bg-green-500/20 border-green-400/50 text-green-300'
                      : 'border-white/20 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  👍 Да
                </button>
                <button
                  type="button"
                  onClick={() => setSurveyData(prev => ({ ...prev, wouldRecommend: false }))}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    surveyData.wouldRecommend === false
                      ? 'bg-red-500/20 border-red-400/50 text-red-300'
                      : 'border-white/20 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  👎 Не
                </button>
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Коментар (по желание)
              </label>
              <textarea
                value={surveyData.comment}
                onChange={(e) => setSurveyData(prev => ({ ...prev, comment: e.target.value }))}
                rows={4}
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="Споделете вашето мнение за услугата..."
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-6 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors"
              >
                Отказ
              </button>
              <button
                type="submit"
                disabled={isSubmitting || surveyData.rating === 0}
                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30"
              >
                {isSubmitting ? 'Изпращане...' : 'Изпрати оценка'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
