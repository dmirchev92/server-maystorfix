'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import SurveyModal from '@/components/SurveyModal'
import { apiClient } from '@/lib/api'
import { Header } from '@/components/Header'

interface CaseDetails {
  id: string
  description: string
  provider_name: string
  provider_id: string
  service_type: string
  completed_at: string
}

export default function SurveyPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const caseId = params.caseId as string

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/auth/login?redirect=/survey/${caseId}`)
      return
    }

    fetchCaseDetails()
  }, [isAuthenticated, caseId])

  const fetchCaseDetails = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getCase(caseId)
      
      if (response.data?.success) {
        const caseData = response.data.data
        
        // Verify this case belongs to the current user
        if (caseData.customer_id !== user?.id) {
          setError('Нямате достъп до тази заявка')
          return
        }

        // Check if case is completed
        if (caseData.status !== 'completed') {
          setError('Тази заявка все още не е завършена')
          return
        }

        setCaseDetails(caseData)
      } else {
        setError('Заявката не е намерена')
      }
    } catch (err) {
      console.error('Error fetching case details:', err)
      setError('Възникна грешка при зареждането на заявката')
    } finally {
      setLoading(false)
    }
  }

  const handleSurveySubmit = async () => {
    // Redirect to success page or back to dashboard
    router.push('/dashboard?survey=completed')
  }

  const handleClose = () => {
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-slate-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Зареждане...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Грешка</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Към таблото
          </button>
        </div>
      </div>
    )
  }

  if (!caseDetails) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              🌟 Оценете получената услуга
            </h1>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h2 className="font-semibold text-blue-900 mb-2">Детайли за заявката:</h2>
              <p className="text-blue-800"><strong>Услуга:</strong> {caseDetails.description}</p>
              <p className="text-blue-800"><strong>Изпълнител:</strong> {caseDetails.provider_name}</p>
              <p className="text-blue-800"><strong>Завършена на:</strong> {new Date(caseDetails.completed_at).toLocaleDateString('bg-BG')}</p>
            </div>
            <p className="text-gray-600 mb-4">
              Вашето мнение е важно за нас и помага на други клиенти да направят правилния избор.
              Моля отделете няколко минути да оцените получената услуга.
            </p>
          </div>

          <SurveyModal
            isOpen={true}
            onClose={handleClose}
            caseId={caseDetails.id}
            providerId={caseDetails.provider_id}
            providerName={caseDetails.provider_name}
            onSubmitSuccess={handleSurveySubmit}
          />
        </div>
      </div>
    </div>
  )
}
