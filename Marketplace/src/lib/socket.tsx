'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
})

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Connect to your existing backend WebSocket
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'
    const token = localStorage.getItem('servicetextpro_token')
    
    const newSocket = io(wsUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    })

    newSocket.on('connect', () => {
      console.log('✅ Connected to SnapFix backend')
      setIsConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from SnapFix backend')
      setIsConnected(false)
    })

    newSocket.on('new_message', (data) => {
      console.log('📨 New message received:', data)
      // Handle new message notification
      // This will trigger real-time updates in your chat components
    })

    newSocket.on('booking_update', (data) => {
      console.log('📅 Booking update received:', data)
      // Handle booking status updates
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

