'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { apiClient } from '@/lib/api'
import { useVipSocket } from '@/hooks/useVipSocket'

interface VipConfig {
  enabled: boolean
  homepageVip: {
    startBidPoints: number
    buyoutPoints: number
    slotsPerCategory: number
    labelBg: string
  }
  searchVip: {
    startBidPoints: number
    buyoutPoints: number
    slotsPerCategory: number
    labelBg: string
  }
  minBidIncrement: number
  maxBidPoints: number
  isAuctionOpen: boolean
  nextAuction: {
    startsAt: string
    endsAt: string
    coverageStart: string
    coverageEnd: string
  }
}

interface VipPlacement {
  vipType: 'HOMEPAGE_VIP' | 'SEARCH_VIP'
  categoryId: string
  categoryLabelBg: string
  city: string | null
  pointsSpent: number
  rank: number
  expiresAt: string
}

interface VipAuction {
  vipType: 'HOMEPAGE_VIP' | 'SEARCH_VIP'
  categoryId: string
  categoryLabelBg: string
  city: string | null
  startBidPoints: number
  buyoutPoints: number
  currentBid: number | null
  currentRank: number | null
  slotsRemaining: number
  buyoutsTaken: number
}

interface LeaderboardEntry {
  rank: number
  providerName: string
  businessName: string
  city: string
  bidAmount: number
  isCurrentUser: boolean
  isBuyout: boolean
}

export default function ProviderVipPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  
  const [config, setConfig] = useState<VipConfig | null>(null)
  const [placements, setPlacements] = useState<VipPlacement[]>([])
  const [auctions, setAuctions] = useState<VipAuction[]>([])
  const [pointsBalance, setPointsBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  
  // Modal state
  const [bidModalOpen, setBidModalOpen] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [selectedAuction, setSelectedAuction] = useState<VipAuction | null>(null)
  const [bidAmount, setBidAmount] = useState('')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showOutbidAlert, setShowOutbidAlert] = useState(false)
  const [outbidData, setOutbidData] = useState<any>(null)
  
  // New state for category/city selection
  const [providerCategories, setProviderCategories] = useState<{id: string; label: string}[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedVipType, setSelectedVipType] = useState<'HOMEPAGE_VIP' | 'SEARCH_VIP'>('HOMEPAGE_VIP')
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [availableCities, setAvailableCities] = useState<string[]>([])

  // Real-time VIP socket for live updates
  const { isConnected: vipSocketConnected } = useVipSocket({
    onBidUpdate: (data) => {
      console.log('📢 Live bid update:', data)
      // Refresh auction data when someone bids
      loadVipData()
    },
    onBuyout: (data) => {
      console.log('📢 Live buyout:', data)
      // Refresh auction data when someone buys out
      loadVipData()
    },
    onOutbid: (data) => {
      console.log('⚠️ You were outbid!', data)
      setOutbidData(data)
      setShowOutbidAlert(true)
      // Auto-hide after 10 seconds
      setTimeout(() => setShowOutbidAlert(false), 10000)
    },
    onAuctionStatus: (data) => {
      console.log('📢 Auction status changed:', data)
      if (config) {
        setConfig({ ...config, isAuctionOpen: data.isOpen })
      }
      loadVipData()
    }
  })

  useEffect(() => {
    if (isLoading) return
    
    if (!isAuthenticated || !user) {
      router.push('/auth/login')
      return
    }
    
    if (user.role !== 'service_provider' && user.role !== 'tradesperson') {
      router.push('/')
      return
    }
    
    loadVipData()
  }, [isAuthenticated, isLoading, user, router])

  const loadVipData = async () => {
    try {
      const [configRes, overviewRes, auctionsRes, categoriesRes, citiesRes] = await Promise.all([
        apiClient.getVipConfig(),
        apiClient.getVipOverview(),
        apiClient.getVipAuctions(),
        apiClient.getProviderCategories(),
        apiClient.getCities()
      ])
      
      if (configRes.data?.data) {
        setConfig(configRes.data.data)
      }
      
      if (overviewRes.data?.data) {
        setPlacements(overviewRes.data.data.currentPlacements || [])
        setPointsBalance(overviewRes.data.data.pointsBalance || 0)
      }
      
      if (auctionsRes.data?.data) {
        setAuctions(auctionsRes.data.data.auctions || [])
      }

      // Handle provider categories - backend returns { success: true, categories: [...] }
      const categoriesData = categoriesRes.data?.data || categoriesRes.data?.categories
      if (categoriesData && Array.isArray(categoriesData)) {
        const cats = categoriesData.map((c: any) => ({
          id: c.category_id || c.id,
          label: c.category_label_bg || c.label || c.category_id || c.id
        }))
        setProviderCategories(cats)
        // Set first category as default if not already selected
        if (!selectedCategory && cats.length > 0) {
          setSelectedCategory(cats[0].id)
        }
      }

      // Handle cities - fetched from API for consistency with search page
      if (citiesRes.data?.data?.cities && Array.isArray(citiesRes.data.data.cities)) {
        const cityNames = citiesRes.data.data.cities.map((c: any) => c.value || c.label || c.name_bg || c.name)
        setAvailableCities(cityNames)
        // Set first city as default if not already selected
        if (!selectedCity && cityNames.length > 0) {
          setSelectedCity(cityNames[0])
        }
      }
    } catch (error) {
      console.error('Error loading VIP data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('bg-BG', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Countdown timer for auction
  useEffect(() => {
    if (!config?.isAuctionOpen || !config?.nextAuction?.endsAt) return
    
    const updateCountdown = () => {
      const now = new Date().getTime()
      const end = new Date(config.nextAuction.endsAt).getTime()
      const diff = end - now
      
      if (diff <= 0) {
        setTimeLeft('Приключва...')
        return
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      
      setTimeLeft(`${hours}ч ${minutes}м ${seconds}с`)
    }
    
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [config?.isAuctionOpen, config?.nextAuction?.endsAt])

  const openBidModal = (auction: VipAuction) => {
    setSelectedAuction(auction)
    // For new bidders, suggest start price; for existing bidders, suggest min increment
    const suggestedAmount = auction.currentBid 
      ? (config?.minBidIncrement || 5)
      : auction.startBidPoints
    setBidAmount(String(suggestedAmount))
    setBidModalOpen(true)
  }

  const openLeaderboard = async (auction: VipAuction) => {
    setSelectedAuction(auction)
    setLeaderboardOpen(true)
    
    try {
      const res = await apiClient.getVipLeaderboard(
        auction.vipType,
        auction.categoryId,
        auction.city || undefined
      )
      if (res.data?.data?.bids) {
        setLeaderboard(res.data.data.bids)
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      setLeaderboard([])
    }
  }

  const handlePlaceBid = async () => {
    if (!selectedAuction || !bidAmount) return
    
    const increment = parseInt(bidAmount)
    if (isNaN(increment) || increment < (config?.minBidIncrement || 5)) {
      alert(`Минималното увеличение е ${config?.minBidIncrement || 5} точки.`)
      return
    }

    setActionLoading(true)
    try {
      const res = await apiClient.placeVipBid(
        selectedAuction.vipType,
        selectedAuction.categoryId,
        increment,
        selectedAuction.city || undefined
      )

      if (res.data?.success) {
        setBidModalOpen(false)
        setSuccessMessage(res.data?.data?.message || 'Офертата е успешно повишена!')
        setShowSuccessAnimation(true)
        setTimeout(() => setShowSuccessAnimation(false), 3000)
        loadVipData()
      } else {
        alert(res.data?.error?.message || 'Възникна грешка при наддаването.')
      }
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Възникна грешка при наддаването.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBuyout = async (auction: VipAuction) => {
    const buyoutPoints = auction.vipType === 'HOMEPAGE_VIP'
      ? config?.homepageVip.buyoutPoints
      : config?.searchVip.buyoutPoints

    if (!confirm(`Сигурен ли си, че искаш да закупиш VIP слот за ${buyoutPoints} точки?\n\nТочките ще бъдат удържани веднага.`)) {
      return
    }

    setActionLoading(true)
    try {
      const res = await apiClient.buyoutVipSlot(auction.vipType, auction.categoryId, auction.city || undefined)
      if (res.data?.success) {
        setSuccessMessage(res.data?.data?.message || 'VIP слотът е закупен успешно! 🎉')
        setShowSuccessAnimation(true)
        setTimeout(() => setShowSuccessAnimation(false), 3000)
        loadVipData()
      } else {
        alert(res.data?.error?.message || 'Възникна грешка при закупуването.')
      }
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Възникна грешка при закупуването.')
    } finally {
      setActionLoading(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!config?.enabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-20">
            <span className="text-6xl">👑</span>
            <h1 className="text-2xl font-bold text-white mt-4">VIP функцията не е активна</h1>
            <p className="text-gray-400 mt-2">Моля, опитайте по-късно.</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      
      {/* Success Animation Overlay */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-green-500/90 text-white px-8 py-6 rounded-2xl shadow-2xl animate-bounce">
            <div className="text-center">
              <span className="text-5xl mb-2 block">🎉</span>
              <p className="text-xl font-bold">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Outbid Alert */}
      {showOutbidAlert && outbidData && (
        <div className="fixed top-20 right-4 z-50 max-w-sm animate-pulse">
          <div className="bg-red-500/95 text-white p-4 rounded-xl shadow-2xl border border-red-400">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="font-bold">Надвишиха ви!</p>
                <p className="text-sm opacity-90">
                  {outbidData.categoryLabel} - Нова най-висока оферта: {outbidData.newHighestBid} точки
                </p>
                <p className="text-sm opacity-90">
                  Вашата оферта: {outbidData.yourBid} точки (Ранг #{outbidData.newRank})
                </p>
              </div>
              <button 
                onClick={() => setShowOutbidAlert(false)}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                👑 VIP Видимост
              </h1>
              <p className="text-gray-400 mt-2">
                Управлявайте вашата VIP позиция за по-голяма видимост
              </p>
            </div>
            {vipSocketConnected && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                На живо
              </div>
            )}
          </div>
        </div>

        {/* Points Balance & Auction Status */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <p className="text-gray-300 text-sm">Налични точки</p>
              <p className="text-4xl font-bold text-white">{pointsBalance}</p>
            </div>
            <div className="text-right">
              {config.isAuctionOpen ? (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-green-400 font-semibold">Търгът е отворен</span>
                  </div>
                  {timeLeft && (
                    <p className="text-sm text-yellow-400 mt-1">⏱️ Остават: {timeLeft}</p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                    <span className="text-gray-400">Търгът е затворен</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Следващ търг: {formatDate(config.nextAuction.startsAt)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Low Points Warning */}
        {pointsBalance < 50 && (
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-amber-400 font-semibold">Ниски точки</p>
                  <p className="text-gray-300 text-sm">Имате само {pointsBalance} точки. Минималната оферта е 50 точки.</p>
                </div>
              </div>
              <Link 
                href="/points" 
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap"
              >
                Купи точки
              </Link>
            </div>
          </div>
        )}

        {/* Buy VIP Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            🎯 Купи VIP видимост
          </h2>
          
          {providerCategories.length === 0 ? (
            <div className="bg-white/5 rounded-xl p-6 text-center">
              <p className="text-gray-400">Нямате избрани категории. Моля, изберете категории в профила си.</p>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              {/* Category Picker */}
              <div className="mb-4">
                <label className="text-gray-300 text-sm block mb-2">Изберете категория:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                >
                  {providerCategories.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-slate-800">{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* VIP Type Selector */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  onClick={() => setSelectedVipType('HOMEPAGE_VIP')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedVipType === 'HOMEPAGE_VIP'
                      ? 'border-yellow-500 bg-yellow-500/15'
                      : 'border-white/20 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <span className="text-2xl block mb-2">🏠</span>
                  <span className={`font-semibold ${selectedVipType === 'HOMEPAGE_VIP' ? 'text-yellow-400' : 'text-gray-300'}`}>
                    Начална страница
                  </span>
                  <span className="text-gray-400 text-sm block mt-1">
                    {config?.homepageVip?.startBidPoints || 80} - {config?.homepageVip?.buyoutPoints || 150} т.
                  </span>
                </button>
                
                <button
                  onClick={() => {
                    setSelectedVipType('SEARCH_VIP')
                    if (!selectedCity && availableCities.length > 0) {
                      setSelectedCity(availableCities[0])
                    }
                  }}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedVipType === 'SEARCH_VIP'
                      ? 'border-yellow-500 bg-yellow-500/15'
                      : 'border-white/20 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <span className="text-2xl block mb-2">🔍</span>
                  <span className={`font-semibold ${selectedVipType === 'SEARCH_VIP' ? 'text-yellow-400' : 'text-gray-300'}`}>
                    Търсене
                  </span>
                  <span className="text-gray-400 text-sm block mt-1">
                    {config?.searchVip?.startBidPoints || 80} - {config?.searchVip?.buyoutPoints || 150} т.
                  </span>
                </button>
              </div>

              {/* City Picker - Only for Search VIP */}
              {selectedVipType === 'SEARCH_VIP' && (
                <div className="mb-4">
                  <label className="text-gray-300 text-sm block mb-2">Изберете град:</label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                  >
                    {availableCities.map((city) => (
                      <option key={city} value={city} className="bg-slate-800">{city}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Selection Summary */}
              {selectedCategory && (selectedVipType === 'HOMEPAGE_VIP' || selectedCity) && (
                <div className="bg-indigo-500/20 border border-indigo-500/40 rounded-lg p-3 mb-4">
                  <p className="text-gray-400 text-xs mb-1">📋 Избрано:</p>
                  <p className="text-white font-semibold">
                    {selectedVipType === 'HOMEPAGE_VIP' ? '🏠 Начална страница' : '🔍 Търсене'} • {providerCategories.find(c => c.id === selectedCategory)?.label || selectedCategory}
                    {selectedVipType === 'SEARCH_VIP' && selectedCity ? ` • ${selectedCity}` : ''}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              {selectedCategory && (selectedVipType === 'HOMEPAGE_VIP' || selectedCity) && (
                <div>
                  {config?.isAuctionOpen ? (
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => {
                          const auction: VipAuction = {
                            vipType: selectedVipType,
                            categoryId: selectedCategory,
                            categoryLabelBg: providerCategories.find(c => c.id === selectedCategory)?.label || selectedCategory,
                            city: selectedVipType === 'SEARCH_VIP' ? selectedCity : null,
                            startBidPoints: selectedVipType === 'HOMEPAGE_VIP' ? (config?.homepageVip?.startBidPoints || 80) : (config?.searchVip?.startBidPoints || 80),
                            buyoutPoints: selectedVipType === 'HOMEPAGE_VIP' ? (config?.homepageVip?.buyoutPoints || 150) : (config?.searchVip?.buyoutPoints || 150),
                            currentBid: null,
                            currentRank: null,
                            slotsRemaining: 3,
                            buyoutsTaken: 0
                          }
                          openBidModal(auction)
                        }}
                        disabled={actionLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors disabled:opacity-50"
                      >
                        ➕ Наддай
                      </button>
                      
                      <button
                        onClick={() => {
                          const auction: VipAuction = {
                            vipType: selectedVipType,
                            categoryId: selectedCategory,
                            categoryLabelBg: providerCategories.find(c => c.id === selectedCategory)?.label || selectedCategory,
                            city: selectedVipType === 'SEARCH_VIP' ? selectedCity : null,
                            startBidPoints: selectedVipType === 'HOMEPAGE_VIP' ? (config?.homepageVip?.startBidPoints || 80) : (config?.searchVip?.startBidPoints || 80),
                            buyoutPoints: selectedVipType === 'HOMEPAGE_VIP' ? (config?.homepageVip?.buyoutPoints || 150) : (config?.searchVip?.buyoutPoints || 150),
                            currentBid: null,
                            currentRank: null,
                            slotsRemaining: 3,
                            buyoutsTaken: 0
                          }
                          handleBuyout(auction)
                        }}
                        disabled={actionLoading}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors disabled:opacity-50"
                      >
                        ⚡ Купи ({selectedVipType === 'HOMEPAGE_VIP' ? config?.homepageVip?.buyoutPoints : config?.searchVip?.buyoutPoints} т.)
                      </button>
                    </div>
                  ) : (
                    <div className="bg-red-500/15 border border-red-500/30 rounded-lg p-4 text-center">
                      <span className="text-2xl block mb-2">🔒</span>
                      <p className="text-red-400 font-semibold">Търгът е затворен</p>
                      {config?.nextAuction?.startsAt && (
                        <p className="text-gray-400 text-sm mt-1">
                          Следващ: {formatDate(config.nextAuction.startsAt)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Current Placements */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            👑 Активни VIP слотове
          </h2>
          {placements.length === 0 ? (
            <div className="bg-white/5 rounded-xl p-6 text-center">
              <p className="text-gray-400">Нямате активни VIP слотове</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {placements.map((placement, index) => (
                <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-yellow-500/30">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      placement.vipType === 'HOMEPAGE_VIP' 
                        ? 'bg-yellow-500 text-black' 
                        : 'bg-gray-400 text-black'
                    }`}>
                      {placement.vipType === 'HOMEPAGE_VIP' ? 'Начална' : 'Търсене'}
                    </span>
                    <span className="text-2xl font-bold text-yellow-400">#{placement.rank}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{placement.categoryLabelBg}</h3>
                  {placement.city && (
                    <p className="text-gray-400 text-sm">{placement.city}</p>
                  )}
                  <div className="flex justify-between items-center mt-4 text-sm">
                    <span className="text-green-400">{placement.pointsSpent} точки</span>
                    <span className="text-gray-500">до {formatDate(placement.expiresAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Available Auctions */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            🔨 Налични търгове
          </h2>
          {auctions.length === 0 ? (
            <div className="bg-white/5 rounded-xl p-6 text-center">
              <p className="text-gray-400">Няма налични търгове</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {auctions.map((auction, index) => (
                <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      auction.vipType === 'HOMEPAGE_VIP' 
                        ? 'bg-yellow-500 text-black' 
                        : 'bg-gray-400 text-black'
                    }`}>
                      {auction.vipType === 'HOMEPAGE_VIP' ? 'Начална страница' : 'Търсене'}
                    </span>
                    <span className="text-green-400 text-sm">{auction.slotsRemaining} свободни</span>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-white">{auction.categoryLabelBg}</h3>
                  {auction.city && (
                    <p className="text-gray-400 text-sm">{auction.city}</p>
                  )}

                  <div className={`grid gap-3 mt-4 ${auction.currentBid ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-400">Начална цена</p>
                      <p className="text-white font-semibold">{auction.startBidPoints} т.</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-400">Buyout</p>
                      <p className="text-white font-semibold">{auction.buyoutPoints} т.</p>
                    </div>
                    {auction.currentBid && (
                      <div className="bg-green-500/20 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-300">Твоята оферта</p>
                        <p className="text-green-400 font-semibold">{auction.currentBid} т. (#{auction.currentRank})</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    {config.isAuctionOpen && (
                      <>
                        <button
                          onClick={() => openBidModal(auction)}
                          disabled={actionLoading}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50"
                        >
                          ➕ Наддай
                        </button>
                        {auction.slotsRemaining > 0 && (
                          <button
                            onClick={() => handleBuyout(auction)}
                            disabled={actionLoading}
                            className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50"
                          >
                            ⚡ Buyout
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => openLeaderboard(auction)}
                      className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
                    >
                      🏆 Класация
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Info Section */}
        <section className="bg-white/5 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Как работи VIP?</h2>
          <div className="space-y-3 text-gray-300">
            <div className="flex items-center gap-3">
              <span className="text-xl">📅</span>
              <p>Търгът е отворен всяка неделя от 00:00 до 22:00</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">👑</span>
              <p>VIP се показва от понеделник до неделя (7 дни)</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">⚡</span>
              <p><strong>Buyout</strong> = мигновено закупуване на слот (точките се удържат веднага, гарантирана позиция)</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">➕</span>
              <p><strong>Наддай</strong> = участие в търга (точките се удържат само ако спечелите)</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">🏆</span>
              <p>Топ 3 оферти печелят VIP позиция за седмицата</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />

      {/* Bid Modal */}
      {bidModalOpen && selectedAuction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-2">Наддаване</h3>
            <p className="text-gray-400 text-sm mb-4">
              {selectedAuction.categoryLabelBg} - {selectedAuction.vipType === 'HOMEPAGE_VIP' ? 'Начална страница' : 'Търсене'}
            </p>
            
            {selectedAuction.currentBid && (
              <p className="text-green-400 text-sm mb-4">
                Текуща оферта: {selectedAuction.currentBid} точки
              </p>
            )}

            <label className="text-gray-300 text-sm block mb-2">
              Увеличение (мин. {config?.minBidIncrement} точки)
            </label>
            <input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-center text-xl focus:outline-none focus:border-indigo-500"
              min={config?.minBidIncrement}
            />

            <div className="flex gap-2 mt-4">
              {[5, 10, 25, 50].map(amount => (
                <button
                  key={amount}
                  onClick={() => setBidAmount(String(amount))}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg transition-colors"
                >
                  +{amount}
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setBidModalOpen(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold"
              >
                Отказ
              </button>
              <button
                onClick={handlePlaceBid}
                disabled={actionLoading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                {actionLoading ? '...' : 'Наддай'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {leaderboardOpen && selectedAuction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-2">Класация</h3>
            <p className="text-gray-400 text-sm mb-4">{selectedAuction.categoryLabelBg}</p>

            {!config?.isAuctionOpen ? (
              <p className="text-gray-400 text-center py-8">Търгът не е активен</p>
            ) : leaderboard.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Няма оферти</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, index) => (
                  <div
                    key={index}
                    className={`flex items-center p-3 rounded-lg ${
                      entry.isCurrentUser 
                        ? 'bg-indigo-500/20 border border-indigo-500' 
                        : 'bg-white/5'
                    }`}
                  >
                    <span className="text-yellow-400 font-bold w-10">#{entry.rank}</span>
                    <div className="flex-1">
                      <p className="text-white font-semibold">{entry.providerName}</p>
                      <p className="text-gray-400 text-sm">{entry.businessName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">{entry.bidAmount} т.</p>
                      {entry.isBuyout && (
                        <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded">Buyout</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setLeaderboardOpen(false)}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold mt-4"
            >
              Затвори
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
