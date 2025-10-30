import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Контакти</h1>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 text-white">
          <p className="text-lg mb-6">Свържете се с нас:</p>
          <div className="space-y-4">
            <p><strong>Email:</strong> info@maystorfix.com</p>
            <p><strong>Телефон:</strong> +359 XXX XXX XXX</p>
            <p><strong>Адрес:</strong> София, България</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
