import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">За нас</h1>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 text-white">
          <p className="text-lg mb-4">
            Добре дошли в ServiceTextPro - вашата платформа за намиране на професионални майстори.
          </p>
          <p className="mb-4">
            Ние свързваме клиенти с проверени специалисти в различни области.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
