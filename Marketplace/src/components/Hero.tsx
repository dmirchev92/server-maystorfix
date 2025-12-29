'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'

export function Hero() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  return (
    <section className="relative overflow-hidden">
      {/* Professional Industrial Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950">
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.08]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '56px 56px'
        }}></div>
        
        {/* Industrial Elements */}
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl"></div>
        <div className="absolute top-40 -left-40 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl"></div>
        <div className="absolute -bottom-56 -right-56 h-[520px] w-[520px] rounded-full bg-orange-500/10 blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 sm:pt-20 sm:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-12">
            <div className="mx-auto max-w-4xl text-center">
              {/* Main Heading */}
              <div className="mb-8">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight">
                  Намерете най-добрите
                  <span className="block bg-gradient-to-r from-orange-400 via-yellow-300 to-cyan-300 bg-clip-text text-transparent">
                    майстори в България
                  </span>
                </h1>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-stretch sm:items-center justify-center">
                <Button
                  variant="construction"
                  size="xl"
                  onClick={() => router.push(isAuthenticated ? '/search' : '/auth/login')}
                  leftIcon={<span>🔍</span>}
                  className="shadow-2xl"
                >
                  Търсете майстор
                </Button>
                <Button
                  variant="outline"
                  size="xl"
                  onClick={() => router.push('/register')}
                  leftIcon={<span>🛠️</span>}
                  className="border-2 border-white/60 text-white hover:bg-white hover:text-slate-900 shadow-2xl"
                >
                  Станете майстор
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 opacity-90">
                <div className="flex items-center gap-2 text-white/70">
                  <span className="text-green-400">✓</span>
                  <span className="text-sm font-medium">24/7 Поддръжка</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

