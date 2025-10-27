'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

export function Hero() {
  const router = useRouter()

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Professional Industrial Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-blue-900 to-slate-900">
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>
        
        {/* Industrial Elements */}
        <div className="absolute top-20 left-20 w-32 h-32 bg-orange-500/10 rounded-lg blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-32 w-24 h-24 bg-blue-400/20 rounded-lg blur-lg animate-pulse delay-1000"></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-slate-400/10 rounded-lg blur-2xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          {/* Main Heading */}
          <div className="mb-8">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-white leading-tight">
              Намерете най-добрите
              <span className="block bg-gradient-to-r from-orange-400 to-blue-400 bg-clip-text text-transparent">
                майстори в България
              </span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-4xl mx-auto leading-relaxed">
              Електротехници, водопроводчици, климатици и други професионалисти на разстояние от един клик
            </p>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
            {[
              { number: '500+', label: 'Верифицирани майстори', icon: '🔧', gradient: 'from-blue-500 to-blue-600' },
              { number: '10,000+', label: 'Доволни клиенти', icon: '⭐', gradient: 'from-orange-500 to-orange-600' },
              { number: '24/7', label: 'Поддръжка', icon: '🛠️', gradient: 'from-slate-500 to-slate-600' }
            ].map((stat, index) => (
              <Card key={index} variant="glass" hover padding="lg" className="group border border-white/20 backdrop-blur-md">
                <CardContent>
                  <div className="text-center">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <span className="text-2xl text-white">
                        {stat.icon}
                      </span>
                    </div>
                    <div className="text-3xl font-bold text-white mb-2">
                      {stat.number}
                    </div>
                    <div className="text-white/80 font-medium">
                      {stat.label}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button
              variant="construction"
              size="xl"
              onClick={() => router.push('/search')}
              leftIcon={<span>🔍</span>}
              className="shadow-2xl hover:shadow-3xl transform hover:scale-105"
            >
              Търсете майстор
            </Button>
            <Button
              variant="outline"
              size="xl"
              onClick={() => router.push('/register')}
              leftIcon={<span>🛠️</span>}
              className="border-2 border-white text-white hover:bg-white hover:text-slate-800 shadow-2xl hover:shadow-3xl transform hover:scale-105"
            >
              Станете майстор
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="mt-16 flex flex-wrap justify-center items-center gap-8 opacity-80">
            <div className="flex items-center gap-2 text-white/70">
              <span className="text-green-400">✓</span>
              <span className="text-sm font-medium">Верифицирани професионалисти</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <span className="text-green-400">✓</span>
              <span className="text-sm font-medium">Гарантирано качество</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <span className="text-green-400">✓</span>
              <span className="text-sm font-medium">Бърза поддръжка</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

