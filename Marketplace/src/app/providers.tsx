'use client'

import { Provider } from 'react-redux'
import { store } from '@/store'
import { SocketProvider } from '@/contexts/SocketContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { ChatWidgetProvider } from '@/contexts/ChatWidgetContext'
import { ChatProvider } from '@/contexts/ChatContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthProvider>
        <SocketProvider>
          <ChatProvider>
            <ChatWidgetProvider>
              {children}
            </ChatWidgetProvider>
          </ChatProvider>
        </SocketProvider>
      </AuthProvider>
    </Provider>
  )
}

