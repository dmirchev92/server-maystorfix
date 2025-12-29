'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function PricingPage() {
  const [selectedTier, setSelectedTier] = useState<'normal' | 'pro'>('normal')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Абонаментни Планове
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Изберете плана, който отговаря на вашите нужди и развийте бизнеса си с SnapFix
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {/* Free Tier */}
          <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-2xl p-8 relative">
            <div className="text-center mb-6">
              <span className="text-4xl mb-4 block">🆓</span>
              <h2 className="text-2xl font-bold text-white mb-2">Безплатен</h2>
              <p className="text-slate-400">Пробен период</p>
            </div>
            
            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-white">0 лв</span>
              <span className="text-slate-400 block">14 дни или 5 заявки</span>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-green-400 mt-1">✓</span>
                <span>Достъп до заявки до 500 лв</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-green-400 mt-1">✓</span>
                <span>2 категории услуги</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-green-400 mt-1">✓</span>
                <span>5 снимки в галерията</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-green-400 mt-1">✓</span>
                <span>Чат съобщения</span>
              </li>
              <li className="flex items-start gap-2 text-slate-400">
                <span className="text-slate-600 mt-1">✗</span>
                <span>Без SMS известия</span>
              </li>
              <li className="flex items-start gap-2 text-slate-400">
                <span className="text-slate-600 mt-1">✗</span>
                <span>Без наддаване</span>
              </li>
            </ul>

            <Link href="/signup?tier=free" className="block w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg text-center transition-colors">
              Започни безплатно
            </Link>
          </div>

          {/* Normal Tier */}
          <div className="bg-gradient-to-b from-green-900/30 to-slate-800/50 backdrop-blur-md border-2 border-green-500/50 rounded-2xl p-8 relative transform md:scale-105">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
              Препоръчан
            </div>
            
            <div className="text-center mb-6">
              <span className="text-4xl mb-4 block">⭐</span>
              <h2 className="text-2xl font-bold text-white mb-2">Нормален</h2>
              <p className="text-green-400">За активни майстори</p>
            </div>
            
            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-white">349 лв</span>
              <span className="text-slate-400 block">на година (с ДДС)</span>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-green-400 mt-1">✓</span>
                <span><strong className="text-green-400">350 точки</strong> годишно</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-green-400 mt-1">✓</span>
                <span>Заявки до <strong>1500 лв</strong> бюджет</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-green-400 mt-1">✓</span>
                <span>SMS известия (<strong>2 точки/SMS</strong>)</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-green-400 mt-1">✓</span>
                <span>5 категории услуги</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-green-400 mt-1">✓</span>
                <span>20 снимки в галерията</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-green-400 mt-1">✓</span>
                <span>Подобрена видимост в търсенето</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-green-400 mt-1">✓</span>
                <span>Допълнителни точки: <strong>0.30 лв/точка</strong></span>
              </li>
            </ul>

            <Link href="/signup?tier=normal" className="block w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-center transition-colors">
              Избери Нормален
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="bg-gradient-to-b from-purple-900/30 to-slate-800/50 backdrop-blur-md border border-purple-500/30 rounded-2xl p-8 relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
              👑 PRO
            </div>
            
            <div className="text-center mb-6">
              <span className="text-4xl mb-4 block">👑</span>
              <h2 className="text-2xl font-bold text-white mb-2">Професионален</h2>
              <p className="text-purple-400">За сериозни професионалисти</p>
            </div>
            
            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-white">489 лв</span>
              <span className="text-slate-400 block">на година (с ДДС)</span>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-purple-400 mt-1">✓</span>
                <span><strong className="text-purple-400">500 точки</strong> годишно</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-purple-400 mt-1">✓</span>
                <span><strong>Всички бюджети</strong> на заявки</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-purple-400 mt-1">✓</span>
                <span>SMS известия (<strong>1 точка/SMS</strong>)</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-purple-400 mt-1">✓</span>
                <span><strong>Неограничени</strong> категории</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-purple-400 mt-1">✓</span>
                <span><strong>100 снимки</strong> в галерията</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-purple-400 mt-1">✓</span>
                <span><strong>Система за наддаване</strong></span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-purple-400 mt-1">✓</span>
                <span>Най-висока видимост</span>
              </li>
              <li className="flex items-start gap-2 text-slate-300">
                <span className="text-purple-400 mt-1">✓</span>
                <span>Допълнителни точки: <strong>0.25 лв/точка</strong></span>
              </li>
            </ul>

            <Link href="/signup?tier=pro" className="block w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-center transition-colors">
              Избери PRO
            </Link>
          </div>
        </div>

        {/* Points System Explanation */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">💰 Как работи системата с точки?</h2>
            <p className="text-slate-300 max-w-2xl mx-auto">
              Точките са вашата валута в платформата. Използвайте ги за достъп до заявки и изпращане на SMS известия.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Points for Cases */}
            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">📋</span>
                Точки за заявки
              </h3>
              <p className="text-slate-300 mb-4">
                Когато приемете заявка от клиент, се изразходват точки в зависимост от бюджета на заявката.
                <strong className="text-green-400"> PRO потребителите плащат по-малко точки!</strong>
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 text-slate-400">Бюджет на заявка</th>
                      <th className="text-center py-2 text-green-400">Normal</th>
                      <th className="text-center py-2 text-purple-400">PRO</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2">1 - 250 лв</td>
                      <td className="text-center">15 точки</td>
                      <td className="text-center">12 точки</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">251 - 500 лв</td>
                      <td className="text-center">25 точки</td>
                      <td className="text-center">20 точки</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">501 - 750 лв</td>
                      <td className="text-center">35 точки</td>
                      <td className="text-center">28 точки</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">751 - 1000 лв</td>
                      <td className="text-center">45 точки</td>
                      <td className="text-center">36 точки</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">1001 - 2000 лв</td>
                      <td className="text-center">70 точки</td>
                      <td className="text-center">56 точки</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">2001 - 3000 лв</td>
                      <td className="text-center text-slate-500">—</td>
                      <td className="text-center">100 точки</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">3001 - 4000 лв</td>
                      <td className="text-center text-slate-500">—</td>
                      <td className="text-center">140 точки</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">4001 - 5000 лв</td>
                      <td className="text-center text-slate-500">—</td>
                      <td className="text-center">180 точки</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">5001 - 6000 лв</td>
                      <td className="text-center text-slate-500">—</td>
                      <td className="text-center">220 точки</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">6001 - 7000 лв</td>
                      <td className="text-center text-slate-500">—</td>
                      <td className="text-center">260 точки</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">7001 - 8000 лв</td>
                      <td className="text-center text-slate-500">—</td>
                      <td className="text-center">300 точки</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">8001 - 9000 лв</td>
                      <td className="text-center text-slate-500">—</td>
                      <td className="text-center">340 точки</td>
                    </tr>
                    <tr>
                      <td className="py-2">9001 - 10000 лв</td>
                      <td className="text-center text-slate-500">—</td>
                      <td className="text-center">380 точки</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Points for SMS */}
            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">📱</span>
                Точки за SMS
              </h3>
              <p className="text-slate-300 mb-4">
                Изпращайте SMS известия на клиенти директно от приложението. Идеално за пропуснати обаждания!
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                  <p className="text-green-400 font-bold text-2xl">2 точки</p>
                  <p className="text-slate-400 text-sm">Normal план</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 text-center">
                  <p className="text-purple-400 font-bold text-2xl">1 точка</p>
                  <p className="text-slate-400 text-sm">PRO план</p>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-amber-400 mb-2">💡 Съвет за SMS</h4>
                <p className="text-slate-300 text-sm">
                  Използвайте <strong>латиница</strong> вместо кирилица за по-евтини SMS! 
                  Латиницата позволява 160 символа на SMS, докато кирилицата - само 70.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Buy More Points */}
        <section className="mb-20">
          <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 backdrop-blur-md border border-indigo-500/30 rounded-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">🛒 Нужни са ви повече точки?</h2>
              <p className="text-slate-300 max-w-2xl mx-auto">
                Можете да закупите допълнителни точки по всяко време. Цената зависи от вашия план.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              <div className="bg-slate-800/50 rounded-xl p-6 text-center">
                <h3 className="text-xl font-bold text-green-400 mb-2">Normal план</h3>
                <p className="text-3xl font-bold text-white mb-2">0.30 лв</p>
                <p className="text-slate-400">за точка</p>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <p>50 точки = 15 лв</p>
                  <p>100 точки = 30 лв</p>
                  <p>200 точки = 60 лв</p>
                </div>
              </div>
              
              <div className="bg-slate-800/50 rounded-xl p-6 text-center">
                <h3 className="text-xl font-bold text-purple-400 mb-2">PRO план</h3>
                <p className="text-3xl font-bold text-white mb-2">0.25 лв</p>
                <p className="text-slate-400">за точка</p>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <p>50 точки = 12.50 лв</p>
                  <p>100 точки = 25 лв</p>
                  <p>200 точки = 50 лв</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Comparison */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">📊 Сравнение на плановете</h2>
            <p className="text-slate-300">Всички функции на един поглед</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-slate-700/50">
                  <th className="text-left p-4 text-white">Функция</th>
                  <th className="text-center p-4 text-slate-400">Безплатен</th>
                  <th className="text-center p-4 text-green-400">Normal</th>
                  <th className="text-center p-4 text-purple-400">PRO</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-t border-white/5">
                  <td className="p-4 font-medium">Годишни точки</td>
                  <td className="text-center p-4">—</td>
                  <td className="text-center p-4 text-green-400 font-bold">350</td>
                  <td className="text-center p-4 text-purple-400 font-bold">500</td>
                </tr>
                <tr className="border-t border-white/5 bg-white/5">
                  <td className="p-4 font-medium">Максимален бюджет на заявка</td>
                  <td className="text-center p-4">500 лв</td>
                  <td className="text-center p-4">1500 лв</td>
                  <td className="text-center p-4 text-purple-400">Неограничен</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-4 font-medium">SMS известия</td>
                  <td className="text-center p-4">❌</td>
                  <td className="text-center p-4">2 точки/SMS</td>
                  <td className="text-center p-4 text-purple-400">1 точка/SMS</td>
                </tr>
                <tr className="border-t border-white/5 bg-white/5">
                  <td className="p-4 font-medium">Категории услуги</td>
                  <td className="text-center p-4">2</td>
                  <td className="text-center p-4">5</td>
                  <td className="text-center p-4 text-purple-400">Неограничени</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-4 font-medium">Снимки в галерия</td>
                  <td className="text-center p-4">5</td>
                  <td className="text-center p-4">20</td>
                  <td className="text-center p-4">100</td>
                </tr>
                <tr className="border-t border-white/5 bg-white/5">
                  <td className="p-4 font-medium">Система за наддаване</td>
                  <td className="text-center p-4">❌</td>
                  <td className="text-center p-4">❌</td>
                  <td className="text-center p-4 text-green-400">✓</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-4 font-medium">Видимост в търсенето</td>
                  <td className="text-center p-4">Стандартна</td>
                  <td className="text-center p-4">Подобрена</td>
                  <td className="text-center p-4 text-purple-400">Премиум</td>
                </tr>
                <tr className="border-t border-white/5 bg-white/5">
                  <td className="p-4 font-medium">Значка в профила</td>
                  <td className="text-center p-4">—</td>
                  <td className="text-center p-4 text-green-400">⭐ Потвърден</td>
                  <td className="text-center p-4 text-purple-400">👑 PRO</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-4 font-medium">Приоритетни известия</td>
                  <td className="text-center p-4">❌</td>
                  <td className="text-center p-4 text-green-400">✓</td>
                  <td className="text-center p-4 text-green-400">✓</td>
                </tr>
                <tr className="border-t border-white/5 bg-white/5">
                  <td className="p-4 font-medium">Цена за допълнителни точки</td>
                  <td className="text-center p-4">—</td>
                  <td className="text-center p-4">0.30 лв</td>
                  <td className="text-center p-4 text-purple-400">0.25 лв</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Map Feature Section */}
        <section className="mb-20">
          <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 backdrop-blur-md border border-blue-500/30 rounded-2xl p-8 md:p-12">
            <div className="text-center mb-12">
              <span className="text-6xl mb-4 block">🗺️</span>
              <h2 className="text-3xl font-bold text-white mb-4">Карта на майсторите</h2>
              <p className="text-slate-300 max-w-3xl mx-auto text-lg">
                Бъдете видими за клиенти в реално време! Нашата интерактивна карта показва вашето местоположение 
                на потенциални клиенти, които търсят услуги във вашия район.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* For Service Providers */}
              <div className="bg-slate-800/70 rounded-xl p-6">
                <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                  <span>🔧</span> За майстори
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 text-xl mt-1">📍</span>
                    <div>
                      <p className="font-semibold text-white">Проследяване на локация</p>
                      <p className="text-slate-300 text-sm">Включете GPS проследяването от мобилното приложение и вашето местоположение се обновява автоматично на картата.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 text-xl mt-1">👁️</span>
                    <div>
                      <p className="font-semibold text-white">Видимост в реално време</p>
                      <p className="text-slate-300 text-sm">Клиентите виждат къде се намирате в момента. Ако сте близо до тях, шансът да ви изберат е много по-голям!</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 text-xl mt-1">🎯</span>
                    <div>
                      <p className="font-semibold text-white">Локални клиенти</p>
                      <p className="text-slate-300 text-sm">Привличайте клиенти от вашия район. Без да пътувате далеч, спестявате време и гориво.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 text-xl mt-1">⚡</span>
                    <div>
                      <p className="font-semibold text-white">Бързи реакции</p>
                      <p className="text-slate-300 text-sm">Клиентите с спешни проблеми търсят най-близкия майстор. Бъдете първият, който ще им помогне!</p>
                    </div>
                  </li>
                </ul>
              </div>

              {/* For Customers */}
              <div className="bg-slate-800/70 rounded-xl p-6">
                <h3 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                  <span>👤</span> За клиенти
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-400 text-xl mt-1">🔍</span>
                    <div>
                      <p className="font-semibold text-white">Търсене по район</p>
                      <p className="text-slate-300 text-sm">Намерете майстори близо до вас с един поглед. Филтрирайте по категория услуга и радиус.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-400 text-xl mt-1">⏱️</span>
                    <div>
                      <p className="font-semibold text-white">Бързо обслужване</p>
                      <p className="text-slate-300 text-sm">Виждате кои майстори са активни в момента и могат да дойдат бързо при вас.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-400 text-xl mt-1">📋</span>
                    <div>
                      <p className="font-semibold text-white">Профили и отзиви</p>
                      <p className="text-slate-300 text-sm">Кликнете върху маркер, за да видите профила на майстора, неговите услуги и отзиви от клиенти.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-400 text-xl mt-1">💬</span>
                    <div>
                      <p className="font-semibold text-white">Директен контакт</p>
                      <p className="text-slate-300 text-sm">Свържете се директно с избрания майстор чрез чат или телефон.</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            {/* How to Use Map */}
            <div className="bg-slate-900/50 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-6 text-center">📱 Как да използвате картата?</h3>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">1️⃣</span>
                  </div>
                  <p className="text-white font-medium mb-1">Изтеглете приложението</p>
                  <p className="text-slate-400 text-sm">Инсталирайте SnapFix на телефона си</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">2️⃣</span>
                  </div>
                  <p className="text-white font-medium mb-1">Включете локацията</p>
                  <p className="text-slate-400 text-sm">Отидете в Настройки → Проследяване на локация</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">3️⃣</span>
                  </div>
                  <p className="text-white font-medium mb-1">Работете нормално</p>
                  <p className="text-slate-400 text-sm">Локацията се обновява автоматично на всеки 5 минути</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">4️⃣</span>
                  </div>
                  <p className="text-white font-medium mb-1">Получавайте клиенти</p>
                  <p className="text-slate-400 text-sm">Клиентите ви намират на картата и се свързват с вас</p>
                </div>
              </div>
            </div>

            {/* Map Benefits */}
            <div className="mt-8 grid md:grid-cols-3 gap-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-400">+40%</p>
                <p className="text-slate-300 text-sm">повече запитвания от локални клиенти</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-400">-30%</p>
                <p className="text-slate-300 text-sm">по-малко време за пътуване</p>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-purple-400">2x</p>
                <p className="text-slate-300 text-sm">по-бърза реакция на спешни заявки</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Helps Your Business */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">🚀 Как ще ви помогне?</h2>
            <p className="text-slate-300 max-w-2xl mx-auto">
              SnapFix е създаден специално за майстори и сервизни специалисти
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6 text-center">
              <span className="text-5xl mb-4 block">📞</span>
              <h3 className="text-xl font-bold text-white mb-3">Никога не пропускайте клиент</h3>
              <p className="text-slate-300">
                Автоматични SMS известия при пропуснати обаждания. Клиентът получава вашата визитка и може да ви потърси отново.
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6 text-center">
              <span className="text-5xl mb-4 block">🎯</span>
              <h3 className="text-xl font-bold text-white mb-3">Достъп до качествени заявки</h3>
              <p className="text-slate-300">
                Получавайте заявки от клиенти, които активно търсят вашите услуги. Без студени обаждания, без загуба на време.
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6 text-center">
              <span className="text-5xl mb-4 block">⭐</span>
              <h3 className="text-xl font-bold text-white mb-3">Изградете репутация</h3>
              <p className="text-slate-300">
                Събирайте отзиви от доволни клиенти. Вашият профил става по-видим и привлича повече клиенти.
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6 text-center">
              <span className="text-5xl mb-4 block">🗺️</span>
              <h3 className="text-xl font-bold text-white mb-3">Карта в реално време</h3>
              <p className="text-slate-300">
                Бъдете видими на картата за клиенти във вашия район. GPS проследяване показва къде се намирате в момента.
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6 text-center">
              <span className="text-5xl mb-4 block">💬</span>
              <h3 className="text-xl font-bold text-white mb-3">Директна комуникация</h3>
              <p className="text-slate-300">
                Чат система за бърза комуникация с клиенти. Договаряйте детайли, изпращайте оферти, уточнявайте срокове.
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6 text-center">
              <span className="text-5xl mb-4 block">📱</span>
              <h3 className="text-xl font-bold text-white mb-3">Мобилно приложение</h3>
              <p className="text-slate-300">
                Управлявайте бизнеса си от телефона. Получавайте известия, отговаряйте на заявки, следете статистики - навсякъде.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">❓ Често задавани въпроси</h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">Какво се случва, ако ми свършат точките?</h3>
              <p className="text-slate-300">
                Можете да закупите допълнителни точки по всяко време от вашия профил. Цената зависи от плана ви - 0.30 лв за Normal и 0.25 лв за PRO.
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">Мога ли да сменя плана си?</h3>
              <p className="text-slate-300">
                Да! Можете да надградите от Normal към PRO по всяко време. При надграждане получавате новите точки за PRO плана.
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">Какво е системата за наддаване?</h3>
              <p className="text-slate-300">
                PRO потребителите могат да наддават за заявки с висок бюджет. Това ви позволява да предложите по-добра цена и да спечелите клиента пред конкуренцията.
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">Как работят SMS известията?</h3>
              <p className="text-slate-300">
                Когато пропуснете обаждане, можете автоматично да изпратите SMS на клиента с вашата визитка и информация за контакт. Това увеличава шанса клиентът да ви потърси отново.
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">Точките прехвърлят ли се за следващата година?</h3>
              <p className="text-slate-300">
                При подновяване на абонамента получавате нова годишна квота точки. Препоръчваме да използвате точките си активно през годината.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <div className="bg-gradient-to-r from-green-900/50 to-indigo-900/50 backdrop-blur-md border border-green-500/30 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-white mb-4">Готови ли сте да започнете?</h2>
            <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
              Присъединете се към хиляди майстори, които вече използват SnapFix за развитие на бизнеса си.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors">
                Започнете безплатно
              </Link>
              <Link href="/contact" className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors">
                Свържете се с нас
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
