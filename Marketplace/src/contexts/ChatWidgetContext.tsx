'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ChatWidgetContextType {
  openWithProvider: (providerId: string, providerName: string) => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  activeProviderId: string | null
  activeProviderName: string | null
}

const ChatWidgetContext = createContext<ChatWidgetContextType>({
  openWithProvider: () => {},
  isOpen: false,
  setIsOpen: () => {},
  activeProviderId: null,
  activeProviderName: null,
})

export const useChatWidget = () => useContext(ChatWidgetContext)

export function ChatWidgetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null)
  const [activeProviderName, setActiveProviderName] = useState<string | null>(null)

  const openWithProvider = (providerId: string, providerName: string) => {
    setActiveProviderId(providerId)
    setActiveProviderName(providerName)
    setIsOpen(true)
  }

  return (
    <ChatWidgetContext.Provider
      value={{
        openWithProvider,
        isOpen,
        setIsOpen,
        activeProviderId,
        activeProviderName,
      }}
    >
      {children}
    </ChatWidgetContext.Provider>
  )
}
