import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import '../styles/theme.css'
import { Providers } from './providers'
import GDPRPopup from '@/components/GDPRPopup'
import ChatWidget from '@/components/ChatWidget'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ServiceText Pro Marketplace',
  description: 'Намерете най-добрите професионалисти в България - електротехници, водопроводчици, климатици',
  keywords: 'електротехник, водопроводчик, климатик, майстор, България, София',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="bg">
      <body className={inter.className}>
        <Providers>
          {children}
          <GDPRPopup />
          <ChatWidget />
        </Providers>
      </body>
    </html>
  )
}

