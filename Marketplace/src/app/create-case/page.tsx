'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import UnifiedCaseModal from '@/components/UnifiedCaseModal'
import ChatWidget from '@/components/ChatWidget'
import { apiClient } from '@/lib/api'

export default function CreateCasePage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [caseModalOpen, setCaseModalOpen] = useState(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, router])

  // Open modal automatically when page loads
  useEffect(() => {
    if (isAuthenticated) {
      setCaseModalOpen(true)
    }
  }, [isAuthenticated])

  const handleCaseSubmit = async (formData: any) => {
    try {
      // Prepare case data for open case (no specific provider)
      const caseData = {
        ...formData,
        providerId: null, // No specific provider
        providerName: null,
        isOpenCase: true, // This is an open case for all providers
        customerId: user?.id, // Add customer ID
        category: formData.serviceType || 'general' // Map service type to category
      }

      console.log('Creating open case with data:', caseData)
      
      // Submit the case using the API client
      const response = await apiClient.createCase(caseData)
      
      if (response.data?.success) {
        // Close modal and show success message
        setCaseModalOpen(false)
        
        const caseId = response.data.data?.id || response.data.caseId
        const hasBudget = formData.budget && parseFloat(formData.budget) > 0
        
        if (hasBudget && caseId) {
          const successMessage = `✅ Заявката е създадена успешно!\n\n📋 Специалистите ще наддават за вашата заявка.\n\n🔗 Линк за преглед на оферти:\nhttps://maystorfix.com/dashboard/cases/${caseId}/bids\n\n💡 Запазете този линк за да видите офертите!`
          alert(successMessage)
          // Copy link to clipboard
          navigator.clipboard.writeText(`https://maystorfix.com/dashboard/cases/${caseId}/bids`)
        } else {
          alert('Заявката е създадена и е достъпна за всички специалисти! Ще получите потвърждение скоро.')
        }
        
        // Redirect to home
        router.push('/')
      } else {
        throw new Error(response.data?.message || 'Failed to create case')
      }
    } catch (error) {
      console.error('Error creating case:', error)
      alert('Възникна грешка при създаването на заявката. Моля, опитайте отново.')
    }
  }

  const handleModalClose = () => {
    setCaseModalOpen(false)
    // Redirect back to home when modal is closed
    router.push('/')
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 relative overflow-hidden">
      {/* Industrial background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 to-slate-500/10 rounded-lg blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-br from-purple-500/10 to-slate-500/10 rounded-lg blur-3xl"></div>
      </div>

      <Header />
      
      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Създай нова заявка
            </h1>
            <p className="text-xl text-slate-300 mb-8">
              Опишете услугата, която търсите и ние ще ви свържем с подходящи майстори
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl border border-white/20 p-6 mb-8">
            <h2 className="text-2xl font-semibold text-white mb-6">
              Как работи?
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-400/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📝</span>
                </div>
                <h3 className="font-semibold text-white mb-2">1. Опишете проблема</h3>
                <p className="text-slate-300 text-sm">
                  Разкажете какво точно ви трябва и кога
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔍</span>
                </div>
                <h3 className="font-semibold text-white mb-2">2. Получете оферти</h3>
                <p className="text-slate-300 text-sm">
                  Специалистите ще ви изпратят своите предложения
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">✅</span>
                </div>
                <h3 className="font-semibold text-white mb-2">3. Изберете най-добрия</h3>
                <p className="text-slate-300 text-sm">
                  Сравнете офертите и изберете подходящия майстор
                </p>
              </div>
            </div>
          </div>

          {/* Create Case Button */}
          <div className="text-center">
            <button
              onClick={() => setCaseModalOpen(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-8 rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300 text-lg font-medium"
            >
              📋 Създай заявка сега
            </button>
          </div>
        </div>
      </main>
      
      <Footer />

      {/* Case Creation Modal - Same as in search page */}
      <UnifiedCaseModal
        isOpen={caseModalOpen}
        onClose={handleModalClose}
        onSubmit={handleCaseSubmit}
        providerName="Всички специалисти" // For open cases
        providerId={undefined} // No specific provider
        providerCategory="general" // General category for open cases
        customerPhone={user?.phoneNumber || ''}
        mode="direct"
      />

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  )
}