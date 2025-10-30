import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Общи условия</h1>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 text-white space-y-4">
          <p>Последна актуализация: {new Date().toLocaleDateString('bg-BG')}</p>
          <h2 className="text-2xl font-semibold mt-6">1. Приемане на условията</h2>
          <p>Използвайки нашата платформа, вие приемате тези условия.</p>
          <h2 className="text-2xl font-semibold mt-6">2. Отговорности на потребителите</h2>
          <p>Потребителите са отговорни за предоставената от тях информация.</p>
          <h2 className="text-2xl font-semibold mt-6">3. Отговорности на платформата</h2>
          <p>Ние се задължаваме да предоставяме качествена услуга.</p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
