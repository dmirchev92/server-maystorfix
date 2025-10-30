import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Как работи</h1>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 text-white space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-3">1. Регистрация</h2>
            <p>Създайте профил като клиент или майстор.</p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-3">2. Търсене</h2>
            <p>Намерете подходящ специалист за вашата нужда.</p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-3">3. Свързване</h2>
            <p>Свържете се директно чрез нашата платформа.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
