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

  // Initialize socket once on mount
  useEffect(() => {
    // Create Socket.IO connection to /chat namespace
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1'
    const socketUrl = apiUrl.replace('/api/v1', '')
    
    console.log('🔌 Connecting to Socket.IO /chat namespace:', `${socketUrl}/chat`)
    
    const socketInstance = io(`${socketUrl}/chat`, {
      auth: {
        token: localStorage.getItem('auth_token') || localStorage.getItem('token')
      },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      path: '/socket.io'
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

    // Cleanup only on unmount (when browser closes or navigates away)
    return () => {
      console.log('🧹 SocketContext unmounting - disconnecting socket')
      socketInstance.disconnect()
    }
  }, []) // Empty deps - only run once on mount

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}
