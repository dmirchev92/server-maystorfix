'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Hero } from '@/components/Hero'
import { ServiceCategories } from '@/components/ServiceCategories'
import { VipProvidersSection } from '@/components/VipProvidersSection'
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
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-48 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute top-96 -left-48 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-48 -right-48 h-[520px] w-[520px] rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <Header />
      
      <main className="relative">
        <Hero />

        {/* VIP preview (above the fold) */}
        <section className="relative -mt-8 pb-8">
          <VipProvidersSection variant="preview" />
        </section>

        {/* Pending Surveys for authenticated customers */}
        {isAuthenticated && user?.role === 'customer' && (
          <section className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <PendingSurveys />
            </div>
          </section>
        )}
        
        <ServiceCategories />
      </main>
      
      <Footer />
    </div>
  )
}

