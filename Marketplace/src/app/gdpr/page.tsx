import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import Link from 'next/link'

export default function GDPRPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">GDPR Съответствие</h1>
          <p className="text-sm text-gray-500 mb-8">Последна актуализация: 10.02.2026 г.</p>

          <div className="prose prose-lg max-w-none space-y-6">
            <p className="text-gray-700">
              SnapFix спазва Общия регламент за защита на данните (GDPR) (Регламент (ЕС) 2016/679) 
              и Закона за защита на личните данни на Република България.
            </p>

            <h2 className="text-xl font-semibold text-gray-900">Администратор на лични данни</h2>
            <p className="text-gray-700">
              <strong>SnapFix</strong><br />
              Адрес: София, България<br />
              Имейл: <a href="mailto:admin@snapfix.bg" className="text-blue-600 hover:underline">admin@snapfix.bg</a><br />
              Телефон: +359 88 462 9498
            </p>

            <h2 className="text-xl font-semibold text-gray-900">Вашите права по GDPR</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Право на достъп</strong> (чл. 15) — Заявка за копие на вашите лични данни</li>
              <li><strong>Право на коригиране</strong> (чл. 16) — Корекция на неточни лични данни</li>
              <li><strong>Право на изтриване</strong> (чл. 17) — Заявка за изтриване на данните ви (право на забвене). <Link href="/delete-account" className="text-blue-600 hover:underline">Заявка за изтриване →</Link></li>
              <li><strong>Право на ограничаване</strong> (чл. 18) — Ограничаване на обработката на данни</li>
              <li><strong>Право на преносимост</strong> (чл. 20) — Получаване на данните в машиночетим формат</li>
              <li><strong>Право на възражение</strong> (чл. 21) — Възражение срещу определени видове обработка</li>
              <li><strong>Оттегляне на съгласие</strong> — По всяко време, без това да засяга законосъобразността на обработката преди оттеглянето</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900">Период на съхранение на данни</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Бизнес данни и профил: 60 месеца (5 години)</li>
              <li>Чат разговори: 24 месеца (2 години)</li>
              <li>Аналитика и статистики: 12 месеца (1 година)</li>
              <li>Одитни записи: 84 месеца (7 години)</li>
              <li>Данни за фактуриране: 84 месеца (7 години — законово изискване)</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900">Трети страни</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>Mobica SMS API</strong> — за изпращане на SMS съобщения (с договор за обработка)</li>
              <li><strong>Firebase Cloud Messaging (Google)</strong> — за push известия (с договор за обработка)</li>
              <li><strong>Облачен хостинг доставчик</strong> — за съхранение на данни в ЕС (с договор за обработка)</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900">Надзорен орган</h2>
            <p className="text-gray-700">
              Ако считате, че правата ви са нарушени, можете да подадете жалба до:<br />
              <strong>Комисия за защита на личните данни (КЗЛД)</strong><br />
              Уебсайт: <a href="https://cpdp.bg/" className="text-blue-600 hover:underline" target="_blank" rel="noopener">https://cpdp.bg/</a>
            </p>

            <h2 className="text-xl font-semibold text-gray-900">Контакт</h2>
            <p className="text-gray-700">
              За въпроси относно GDPR или за упражняване на правата ви:<br />
              Имейл: <a href="mailto:admin@snapfix.bg" className="text-blue-600 hover:underline">admin@snapfix.bg</a><br />
              Отговаряме на всички заявки в рамките на 30 дни.
            </p>

            <div className="flex gap-4 pt-4 text-sm">
              <Link href="/privacy-policy" className="text-blue-600 hover:underline">Политика за поверителност →</Link>
              <Link href="/terms" className="text-blue-600 hover:underline">Общи условия →</Link>
              <Link href="/delete-account" className="text-blue-600 hover:underline">Изтриване на акаунт →</Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
