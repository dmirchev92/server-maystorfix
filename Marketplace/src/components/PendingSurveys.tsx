'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import SurveyModal from './SurveyModal'
import { apiClient } from '@/lib/api'

interface PendingReview {
  id: string
  caseId: string
  providerId: string
  providerName: string
  serviceType: string
  completedAt: string
  canReview: boolean
}

export default function PendingSurveys() {
  const { user, isAuthenticated } = useAuth()
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null)
  const [showSurveyModal, setShowSurveyModal] = useState(false)

  useEffect(() => {
    if (isAuthenticated && user?.role === 'customer') {
      fetchPendingReviews()
    } else if (!isAuthenticated || user?.role !== 'customer') {
      // Clear pending reviews if not a customer
      setPendingReviews([])
      setLoading(false)
    }
  }, [isAuthenticated, user])

  const fetchPendingReviews = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getPendingReviews()
      
      console.log('📋 PendingSurveys - API Response:', response.data)
      
      if (response.data?.success) {
        const reviewsData = response.data.data || []
        console.log('📋 PendingSurveys - Reviews Data:', reviewsData, 'Is Array:', Array.isArray(reviewsData))
        // Ensure we always set an array
        setPendingReviews(Array.isArray(reviewsData) ? reviewsData : [])
      } else {
        console.log('📋 PendingSurveys - API not successful, setting empty array')
        setPendingReviews([])
      }
    } catch (err: any) {
      console.error('📋 PendingSurveys - Error fetching pending reviews:', err)
      setPendingReviews([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const handleStartSurvey = (review: PendingReview) => {
    setSelectedReview(review)
    setShowSurveyModal(true)
  }

  const handleSurveyComplete = () => {
    // Remove the completed review from the list
    if (selectedReview) {
      setPendingReviews(prev => prev.filter(r => r.id !== selectedReview.id))
    }
    setSelectedReview(null)
    setShowSurveyModal(false)
  }

  const handleCloseSurvey = () => {
    setSelectedReview(null)
    setShowSurveyModal(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('bg-BG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Don't show for non-customers or if not authenticated
  if (!isAuthenticated || user?.role !== 'customer') {
    return null
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Зареждане...</p>
        </div>
      </div>
    )
  }

  if (!Array.isArray(pendingReviews) || pendingReviews.length === 0) {
    return null
  }

  return (
    <>
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">⭐</span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Оценете завършените услуги
            </h3>
            <p className="text-blue-700 text-sm mb-4">
              Имате {Array.isArray(pendingReviews) ? pendingReviews.length : 0} завършени услуги, които чакат вашата оценка. 
              Вашето мнение помага на други клиенти да направят правилния избор.
            </p>
            
            <div className="space-y-3">
              {Array.isArray(pendingReviews) && pendingReviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white rounded-lg p-4 border border-blue-100 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {review.providerName}
                    </div>
                    <div className="text-sm text-gray-600">
                      {review.serviceType} • Завършено на {formatDate(review.completedAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartSurvey(review)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Оценете
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Survey Modal */}
      {selectedReview && (
        <SurveyModal
          isOpen={showSurveyModal}
          onClose={handleCloseSurvey}
          caseId={selectedReview.caseId}
          providerId={selectedReview.providerId}
          providerName={selectedReview.providerName}
          onSubmitSuccess={handleSurveyComplete}
        />
      )}
    </>
  )
}
