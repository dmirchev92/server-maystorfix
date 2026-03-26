'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { apiClient } from '@/lib/api'
import { getCategoryLabel } from '@/constants/serviceCategories'

interface VipProvider {
  userId: string
  profileId: string
  businessName: string
  providerName: string
  city: string
  rating: number
  totalReviews: number
  profileImageUrl: string | null
  categoryId: string
  categoryLabelBg: string
  serviceCategories?: string[]
  isVip: boolean
  vipType: string
}

interface VipProvidersSectionProps {
  variant?: 'full' | 'preview'
}

export function VipProvidersSection({ variant = 'full' }: VipProvidersSectionProps = {}) {
  const [providers, setProviders] = useState<VipProvider[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVipProviders()
  }, [])

  const loadVipProviders = async () => {
    try {
      const response = await apiClient.getVipHomepageProviders()
      if (response.data?.data) {
        setProviders(response.data.data.slice(0, 6))
      }
    } catch (error) {
      console.log('VIP providers not available')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return null
  }

  if (providers.length === 0) {
    return null
  }

  if (variant === 'preview') {
    const previewProviders = providers.slice(0, 4)

    return (
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-200">
              <span className="text-yellow-300">👑</span>
              VIP Специалисти
            </div>
          </div>
        </div>

        <div className="mt-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
            {previewProviders.map((provider, index) => (
              <Link
                key={provider.userId || index}
                href={`/provider/${provider.userId}`}
                className="snap-start flex-shrink-0 w-[260px] sm:w-[300px]"
              >
                <div className="h-full rounded-2xl bg-white/5 border border-white/10 hover:border-yellow-500/30 backdrop-blur-md transition-colors">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 text-yellow-200 border border-yellow-500/20 px-2.5 py-1 text-[11px] font-semibold">
                        👑 VIP
                      </span>
                      <div className="inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2 py-1">
                        <span className="text-yellow-300">⭐</span>
                        <span className="text-white font-semibold text-sm">{(provider.rating || 0).toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500/80 to-orange-600/80 flex items-center justify-center overflow-hidden border border-yellow-500/30 flex-shrink-0">
                        {provider.profileImageUrl ? (
                          <img
                            src={provider.profileImageUrl}
                            alt={provider.businessName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-bold text-white">
                            {(provider.businessName || provider.providerName || 'S').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold text-white truncate">
                          {provider.businessName || provider.providerName || 'Специалист'}
                        </div>
                        {/* VIP Category - Show ONLY the category they purchased VIP for */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="bg-yellow-500/20 text-yellow-300 text-[10px] px-1.5 py-0.5 rounded-full font-semibold border border-yellow-400/30">
                            {getCategoryLabel(provider.categoryId) || provider.categoryLabelBg || provider.categoryId}
                          </span>
                        </div>
                        <div className="text-slate-400 text-sm truncate mt-1">
                          📍 {provider.city || 'България'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-200">
            <span className="text-yellow-300">👑</span>
            VIP Специалисти
          </div>
          <h2 className="mt-3 text-2xl md:text-3xl font-bold text-white tracking-tight">
            Платена видимост за най-добрите
          </h2>
          <p className="text-slate-300 mt-2 max-w-2xl">
            Подбрани професионалисти с отлични оценки и реални отзиви.
          </p>
        </div>

        <div className="md:shrink-0">
          <Link
            href="/search"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white px-5 py-2.5 font-semibold transition-colors"
          >
            🔍 Виж всички
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map((provider, index) => (
          <Link
            key={provider.userId || index}
            href={`/provider/${provider.userId}`}
            className="group"
          >
            <div className="h-full rounded-2xl bg-white/5 border border-white/10 hover:border-yellow-500/30 backdrop-blur-md transition-colors">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 text-yellow-200 border border-yellow-500/20 px-3 py-1 text-xs font-semibold">
                    👑 VIP
                    <span className="text-yellow-300/80">• Платена видимост</span>
                  </span>
                  <div className="inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1">
                    <span className="text-yellow-300">⭐</span>
                    <span className="text-white font-semibold">{(provider.rating || 0).toFixed(1)}</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-4">
                  <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500/80 to-orange-600/80 flex items-center justify-center overflow-hidden border border-yellow-500/30 flex-shrink-0">
                    {provider.profileImageUrl ? (
                      <img
                        src={provider.profileImageUrl}
                        alt={provider.businessName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-bold text-white">
                        {(provider.businessName || provider.providerName || 'S').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-white truncate group-hover:text-yellow-200 transition-colors">
                      {provider.businessName || provider.providerName || 'Специалист'}
                    </h3>
                    {/* VIP Category - Show ONLY the category they purchased VIP for */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="bg-yellow-500/20 text-yellow-300 text-xs px-2 py-0.5 rounded-full font-semibold border border-yellow-400/30">
                        {getCategoryLabel(provider.categoryId) || provider.categoryLabelBg || provider.categoryId}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm truncate mt-1">
                      📍 {provider.city || 'България'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5">
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <span className="text-slate-400 text-sm">
                    {provider.totalReviews || 0} отзива
                  </span>
                  <span className="text-white/80 text-sm font-semibold group-hover:text-white transition-colors">
                    Виж профил →
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default VipProvidersSection
