import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function GDPRPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">GDPR Съответствие</h1>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 text-white space-y-4">
          <p>Ние спазваме Общия регламент за защита на данните (GDPR).</p>
          <h2 className="text-2xl font-semibold mt-6">Вашите права</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Право на достъп до вашите данни</li>
            <li>Право на коригиране на данните</li>
            <li>Право на изтриване на данните</li>
            <li>Право на преносимост на данните</li>
            <li>Право на възражение срещу обработката</li>
          </ul>
          <h2 className="text-2xl font-semibold mt-6">Контакт</h2>
          <p>За въпроси относно GDPR: gdpr@maystorfix.com</p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
