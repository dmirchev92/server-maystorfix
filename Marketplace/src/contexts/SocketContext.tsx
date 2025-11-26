'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
})

export const useSocket = () => useContext(SocketContext)

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { isAuthenticated } = useAuth()

  // Initialize socket when authentication state changes
  useEffect(() => {
    // If not authenticated, disconnect existing socket if any
    if (!isAuthenticated) {
      if (socket) {
        console.log('🔒 User logged out - disconnecting socket')
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
      return
    }

    // If already connected and socket exists, check if we need to reconnect (e.g. token changed)
    // For now, we'll assume if isAuthenticated changed to true, we should reconnect
    if (socket && socket.connected) {
       // Optional: check if token in socket.auth matches current token
       // But simpler to just let it be if we assume this effect only runs on auth change
       // actually, if we switch users, isAuthenticated might stay true if we go from User A -> User B directly?
       // No, usually we go via logout (isAuthenticated=false).
       // If we support hot-swapping users, we should check user.id
    }

    // Create Socket.IO connection to /chat namespace
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'
    const socketUrl = apiUrl.replace('/api/v1', '')
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token')

    if (!token) {
      console.log('⚠️ Authenticated but no token found in localStorage - skipping socket connection')
      return
    }
    
    console.log('🔌 Connecting to Socket.IO /chat namespace:', `${socketUrl}/chat`)
    
    const socketInstance = io(`${socketUrl}/chat`, {
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      path: '/socket.io',
      forceNew: true // Ensure new connection
    })

    socketInstance.on('connect', () => {
      console.log('✅ Socket.IO connected:', socketInstance.id)
      setIsConnected(true)
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO disconnected:', reason)
      setIsConnected(false)
    })

    socketInstance.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error)
      setIsConnected(false)
    })

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket.IO reconnected after', attemptNumber, 'attempts')
      setIsConnected(true)
    })

    setSocket(socketInstance)

    // Cleanup on unmount or auth change
    return () => {
      console.log('🧹 SocketContext cleanup - disconnecting socket')
      socketInstance.disconnect()
    }
  }, [isAuthenticated]) // Re-run when auth state changes

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}
