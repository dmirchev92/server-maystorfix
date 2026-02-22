'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'

interface Review {
  id: string
  rating: number
  comment: string
  communication?: number
  quality?: number
  timeliness?: number
  valueForMoney?: number
  wouldRecommend?: boolean
  customerName: string
  createdAt: string
  caseId: string
}

interface ReviewStats {
  averageRating: number
  totalReviews: number
  ratingDistribution: {
    1: number
    2: number
    3: number
    4: number
    5: number
  }
  averageCommunication?: number
  averageQuality?: number
  averageTimeliness?: number
  averageValueForMoney?: number
  recommendationRate?: number
}

interface ReviewsSectionProps {
  providerId: string
}

export default function ReviewsSection({ providerId }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    fetchReviews()
    fetchStats()
  }, [providerId, currentPage])

  const fetchReviews = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getProviderReviews(providerId, currentPage, 5)
      
      if (response.data?.success) {
        const reviewsData = response.data.data.reviews || []
        setReviews(currentPage === 1 ? reviewsData : [...reviews, ...reviewsData])
        setHasMore(response.data.data.hasMore || false)
      }
    } catch (err: any) {
      console.error('Error fetching reviews:', err)
      setError('Грешка при зареждането на отзивите')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await apiClient.getProviderReviewStats(providerId)
      
      if (response.data?.success) {
        setStats(response.data.data)
      }
    } catch (err: any) {
      console.error('Error fetching review stats:', err)
    }
  }

  const renderStars = (rating: number) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < fullStars; i++) {
      stars.push('⭐')
    }
    if (hasHalfStar) {
      stars.push('⭐')
    }
    while (stars.length < 5) {
      stars.push('☆')
    }
    return stars.join('')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('bg-BG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const loadMoreReviews = () => {
    setCurrentPage(prev => prev + 1)
  }

  if (loading && currentPage === 1) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Зареждане на отзиви...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-6">Отзиви от клиенти</h2>

      {/* Stats Overview */}
      {stats && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Number(stats.averageRating || 0).toFixed(1)}
              </div>
              <div className="text-lg">{renderStars(stats.averageRating)}</div>
              <div className="text-sm text-gray-600">
                {stats.totalReviews} отзива
              </div>
            </div>

            {stats.averageCommunication && (
              <div className="text-center">
                <div className="text-lg font-semibold">Комуникация</div>
                <div className="text-sm">{renderStars(stats.averageCommunication)}</div>
                <div className="text-xs text-gray-600">
                  {stats.averageCommunication.toFixed(1)}/5
                </div>
              </div>
            )}

            {stats.averageQuality && (
              <div className="text-center">
                <div className="text-lg font-semibold">Качество</div>
                <div className="text-sm">{renderStars(stats.averageQuality)}</div>
                <div className="text-xs text-gray-600">
                  {stats.averageQuality.toFixed(1)}/5
                </div>
              </div>
            )}

            {stats.recommendationRate !== undefined && (
              <div className="text-center">
                <div className="text-lg font-semibold">Препоръчват</div>
                <div className="text-xl font-bold text-green-600">
                  {Math.round(stats.recommendationRate * 100)}%
                </div>
                <div className="text-xs text-gray-600">от клиентите</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">💬</div>
          <p className="text-gray-600">Все още няма отзиви за този специалист</p>
          <p className="text-sm text-gray-500 mt-2">
            Бъдете първият, който ще остави отзив след завършена услуга
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-semibold text-gray-900">
                      {review.customerName}
                    </span>
                    <span className="text-lg">{renderStars(review.rating)}</span>
                    <span className="text-sm text-gray-600">
                      ({review.rating}/5)
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(review.createdAt)}
                  </div>
                </div>

                {review.wouldRecommend !== undefined && (
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    review.wouldRecommend
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {review.wouldRecommend ? '👍 Препоръчва' : '👎 Не препоръчва'}
                  </div>
                )}
              </div>

              {/* Detailed Ratings */}
              {(review.communication || review.quality || review.timeliness || review.valueForMoney) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                  {review.communication && (
                    <div>
                      <span className="text-gray-600">Комуникация:</span>
                      <div>{renderStars(review.communication)}</div>
                    </div>
                  )}
                  {review.quality && (
                    <div>
                      <span className="text-gray-600">Качество:</span>
                      <div>{renderStars(review.quality)}</div>
                    </div>
                  )}
                  {review.timeliness && (
                    <div>
                      <span className="text-gray-600">Срокове:</span>
                      <div>{renderStars(review.timeliness)}</div>
                    </div>
                  )}
                  {review.valueForMoney && (
                    <div>
                      <span className="text-gray-600">Цена:</span>
                      <div>{renderStars(review.valueForMoney)}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Comment */}
              {review.comment && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 italic">"{review.comment}"</p>
                </div>
              )}
            </div>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={loadMoreReviews}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Зареждане...' : 'Покажи още отзиви'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
