import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Политика за поверителност</h1>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 text-white space-y-4">
          <p>Последна актуализация: {new Date().toLocaleDateString('bg-BG')}</p>
          <h2 className="text-2xl font-semibold mt-6">Събиране на данни</h2>
          <p>Ние събираме само необходимата информация за предоставяне на нашите услуги.</p>
          <h2 className="text-2xl font-semibold mt-6">Използване на данни</h2>
          <p>Вашите данни се използват само за подобряване на услугите ни.</p>
          <h2 className="text-2xl font-semibold mt-6">Защита на данни</h2>
          <p>Ние използваме съвременни методи за защита на вашата информация.</p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
