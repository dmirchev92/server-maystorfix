'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Hero } from '@/components/Hero'
import { ServiceCategories } from '@/components/ServiceCategories'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import PendingSurveys from '@/components/PendingSurveys'

export default function HomePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  
  // Redirect Service Providers to their dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role === 'service_provider') {
      router.replace('/provider/dashboard')
    }
  }, [isAuthenticated, user, router])
  
  useEffect(() => {
    // Check if we should auto-open chat from SMS link
    const openChat = searchParams.get('openChat')
    const providerId = searchParams.get('providerId')
    
    if (openChat === 'true' && providerId) {
      console.log('🔗 Auto-opening chat for provider:', providerId)
      
      // Wait a bit for auth context and chat widget to be ready
      const timer = setTimeout(() => {
        console.log('🔗 Dispatching openChatWidget event...')
        // Trigger chat widget to open with this provider
        const event = new CustomEvent('openChatWidget', {
          detail: { providerId }
        })
        window.dispatchEvent(event)
        
        // Clean up URL params
        const url = new URL(window.location.href)
        url.searchParams.delete('openChat')
        url.searchParams.delete('providerId')
        window.history.replaceState({}, '', url.toString())
      }, 1000) // Wait 1 second for everything to load
      
      return () => clearTimeout(timer)
    }
  }, [searchParams])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      
      <main>
        <Hero />
        
        {/* Pending Surveys for authenticated customers */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PendingSurveys />
        </div>
        
        <ServiceCategories />
      </main>
      
      <Footer />
    </div>
  )
}

