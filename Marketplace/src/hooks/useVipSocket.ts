'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/contexts/AuthContext'

interface BidUpdate {
  vipType: string
  categoryId: string
  city: string | null
  bidderId: string
  newBidAmount: number
  rank: number
  totalBids: number
  timestamp: string
}

interface BuyoutUpdate {
  vipType: string
  categoryId: string
  city: string | null
  buyerId: string
  slotsRemaining: number
  timestamp: string
}

interface OutbidNotification {
  vipType: string
  categoryId: string
  categoryLabel: string
  newHighestBid: number
  yourBid: number
  newRank: number
  timestamp: string
}

interface AuctionStatus {
  isOpen: boolean
  nextAuction?: { startsAt: string; endsAt: string }
  timestamp: string
}

interface UseVipSocketOptions {
  onBidUpdate?: (data: BidUpdate) => void
  onBuyout?: (data: BuyoutUpdate) => void
  onOutbid?: (data: OutbidNotification) => void
  onAuctionStatus?: (data: AuctionStatus) => void
  onAuctionUpdate?: (data: any) => void
}

export function useVipSocket(options: UseVipSocketOptions = {}) {
  const { isAuthenticated } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const optionsRef = useRef(options)
  
  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
      return
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1'
    const socketUrl = apiUrl.replace('/api/v1', '')
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token')

    if (!token) return

    console.log('🏆 Connecting to VIP Socket.IO namespace:', `${socketUrl}/vip`)

    const socketInstance = io(`${socketUrl}/vip`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      path: '/socket.io',
      forceNew: true
    })

    socketInstance.on('connect', () => {
      console.log('✅ VIP Socket connected:', socketInstance.id)
      setIsConnected(true)
      // Watch all auctions by default
      socketInstance.emit('watch:all-auctions')
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('🔌 VIP Socket disconnected:', reason)
      setIsConnected(false)
    })

    socketInstance.on('connect_error', (error) => {
      console.error('❌ VIP Socket connection error:', error.message)
    })

    // Listen for bid updates
    socketInstance.on('bid:update', (data: BidUpdate) => {
      console.log('📢 VIP bid update received:', data)
      optionsRef.current.onBidUpdate?.(data)
    })

    // Listen for buyout notifications
    socketInstance.on('buyout:complete', (data: BuyoutUpdate) => {
      console.log('📢 VIP buyout received:', data)
      optionsRef.current.onBuyout?.(data)
    })

    // Listen for outbid notifications (personal)
    socketInstance.on('outbid', (data: OutbidNotification) => {
      console.log('⚠️ You were outbid:', data)
      optionsRef.current.onOutbid?.(data)
    })

    // Listen for auction status changes
    socketInstance.on('auction:status', (data: AuctionStatus) => {
      console.log('📢 Auction status changed:', data)
      optionsRef.current.onAuctionStatus?.(data)
    })

    // Listen for general auction updates
    socketInstance.on('auction:update', (data: any) => {
      console.log('📢 Auction update:', data)
      optionsRef.current.onAuctionUpdate?.(data)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.emit('unwatch:all-auctions')
      socketInstance.disconnect()
    }
  }, [isAuthenticated])

  // Watch a specific auction
  const watchAuction = useCallback((vipType: string, categoryId: string, city?: string) => {
    if (socket?.connected) {
      socket.emit('watch:auction', { vipType, categoryId, city })
    }
  }, [socket])

  // Unwatch a specific auction
  const unwatchAuction = useCallback((vipType: string, categoryId: string, city?: string) => {
    if (socket?.connected) {
      socket.emit('unwatch:auction', { vipType, categoryId, city })
    }
  }, [socket])

  return {
    socket,
    isConnected,
    watchAuction,
    unwatchAuction
  }
}
