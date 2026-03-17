'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

interface FAQItem {
  question: string
  answer: string | React.ReactNode
  category: 'general' | 'sms' | 'privacy' | 'map' | 'providers' | 'customers'
}

const faqItems: FAQItem[] = [
  // === SMS & Разходи ===
  {
    category: 'sms',
    question: 'Плащам ли за SMS-ите, които изпращам?',
    answer: 'В момента сме в тестова (бета) версия и SMS-ите са напълно безплатни — получавате 50 безплатни SMS на месец. След края на тестовия период SMS-ите ще се заплащат чрез точки: 2 точки за Normal план или 1 точка за PRO план. Точките се купуват допълнително или са включени в месечния абонамент.'
  },
  {
    category: 'sms',
    question: 'Как се изпраща SMS-ът?',
    answer: 'SMS-ът се изпраща чрез външен SMS доставчик, а не директно от вашия телефон. Приложението засича пропуснатото обаждане и автоматично изпраща SMS до клиента от ваше име. Клиентът получава съобщението с линк към вашия профил, за да може да ви потърси обратно.'
  },
  {
    category: 'sms',
    question: 'Защо е по-добре да пиша на латиница?',
    answer: 'Един SMS на латиница побира до 160 символа, докато на кирилица — само 70. Ако съобщението ви е по-дълго, то се разделя на няколко SMS-а.'
  },
  {
    category: 'sms',
    question: 'Какво става с пропуснатите обаждания?',
    answer: 'Когато пропуснете обаждане, приложението го засича автоматично и изпраща SMS на обаждащия се (ако сте включили тази функция). Така шансът да загубите потенциален клиент е много по-малък, дори когато сте заети на обект.'
  },

  // === Поверителност & Данни ===
  {
    category: 'privacy',
    question: 'Следите ли контактите ми?',
    answer: 'Не. Приложението НЕ изпраща вашите контакти към нашите сървъри. Единственото, за което приложението иска достъп до контактите, е за да може да филтрира познати номера и да НЕ изпраща SMS на хора от списъка ви (например семейство, приятели). Тези контакти остават само на вашия телефон.'
  },
  {
    category: 'privacy',
    question: 'Как се съхраняват телефонните номера?',
    answer: 'Всички телефонни номера в нашата база данни са криптирани с AES-256-CBC алгоритъм — същото ниво на криптиране, което използват банките. В базата данни номерата изглеждат така: „a3f8c1...b29d:e4a7f2...91bc" — напълно нечетими. Дори при хипотетичен пробив в сигурността, никой не може да ги разчете без криптографския ключ. Навсякъде другаде номерата се показват маскирани, например: +359****3456.'
  },
  {
    category: 'privacy',
    question: 'Какви лични данни събирате?',
    answer: 'Събираме само минимално необходимите данни: имейл адрес, телефонен номер, име и информация за бизнеса ви (за профила). Всички данни се обработват в съответствие с GDPR (Регламент за защита на личните данни на ЕС). Имате право по всяко време да поискате изтриване на вашите данни.'
  },
  {
    category: 'privacy',
    question: 'Мога ли да изтрия акаунта и данните си?',
    answer: 'Да. Съгласно GDPR имате пълно право на изтриване. Можете да заявите изтриване на акаунта си от Настройки в приложението или от уебсайта. След потвърждение, всички ваши лични данни ще бъдат изтрити в рамките на 30 дни.'
  },

  // === Карта & Местоположение ===
  {
    category: 'map',
    question: 'Следите ли ме на картата?',
    answer: 'Местоположението ви се споделя на картата САМО ако вие изрично го включите от настройките на приложението. По подразбиране проследяването е изключено. Когато е включено, позицията ви се обновява на всеки 5 минути, за да могат клиенти да ви намерят в района. Вие контролирате дали да сте видими или не.'
  },
  {
    category: 'map',
    question: 'Мога ли да спра споделянето на местоположението ми?',
    answer: 'Да, по всяко време! Отидете в Настройки → Проследяване на локация и го изключете. Позицията ви веднага спира да се показва на картата.'
  },
  {
    category: 'map',
    question: 'Клиентите виждат ли адреса ми?',
    answer: 'Ако сте попълнили адрес в профила си — да, той е видим в страницата на вашия профил. Ако не искате клиентите да го виждат, просто не го попълвайте или го премахнете от профила си. На картата се показва само приблизителното ви местоположение (GPS координати), а не точния адрес от профила.'
  },
  {
    category: 'map',
    question: 'Съхранявате ли историята на местоположенията ми?',
    answer: 'Не. Съхраняваме само последното ви известно местоположение, което се презаписва при всяко обновяване. Не пазим история на движенията ви. Когато изключите проследяването, последната позиция се изтрива.'
  },

  // === За Майстори / Изпълнители ===
  {
    category: 'providers',
    question: 'Как получавам клиенти?',
    answer: 'По три начина: (1) Чрез SMS системата — когато пропуснете обаждане, автоматично предлагате услугите си. (2) Чрез картата — клиенти виждат, че сте наблизо и ви избират. (3) Чрез маркетплейса — клиенти публикуват заявки, а вие кандидатствате за тях.'
  },
  {
    category: 'providers',
    question: 'Какво виждат клиентите в моя профил?',
    answer: 'Клиентите виждат: вашето бизнес име, описание, категории услуги, град, квартал, адрес (ако сте го попълнили), снимки от галерията, сертификати, оценка и отзиви. Телефонният ви номер е скрит — клиентите се свързват с вас чрез чата в платформата или чрез заявка.'
  },
  {
    category: 'providers',
    question: 'Защо да използвам SMS функцията?',
    answer: (
      <div className="space-y-3">
        <p>SMS функцията превръща всяко пропуснато обаждане в потенциална работа:</p>
        <ul className="list-disc list-inside space-y-2 text-slate-400">
          <li><strong className="text-white">Не губите клиенти</strong> — Дори когато сте на обект и не можете да вдигнете, клиентът получава SMS с линк към профила ви</li>
          <li><strong className="text-white">Автоматично</strong> — Приложението засича пропуснато обаждане и изпраща SMS без ваша намеса</li>
          <li><strong className="text-white">Професионално послание</strong> — Клиентът вижда, че сте зает, но сте организиран и ще му отговорите</li>
          <li><strong className="text-white">Директен линк</strong> — SMS-ът съдържа линк към вашия профил с галерия, отзиви и чат бутон</li>
        </ul>
        <p className="text-green-400 font-medium">🎁 В момента: 50 безплатни SMS месечно докато сме в бета!</p>
      </div>
    )
  },
  {
    category: 'providers',
    question: 'Какво са точките и как ги използвам?',
    answer: (
      <div className="space-y-3">
        <p>Точките са вътрешната валута на платформата. Получавате определен брой точки всеки месец с абонамента си и можете да закупите допълнителни при нужда.</p>
        <p><strong className="text-white">За какво се харчат:</strong></p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>За кандидатстване по заявки — 3 точки такса участие (за всички)</li>
          <li>Ако спечелите заявката — доплащате остатъка (зависи от бюджета на заявката и плана ви)</li>
          <li>За изпращане на SMS — Normal: 2 точки/SMS, Pro: 1 точка/SMS</li>
        </ul>
        <p><strong className="text-white">Как се получават:</strong></p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Месечна порция с абонамента (Free: 15, Normal: 60, Pro: 100)</li>
          <li>Закупуване на допълнителни (Normal: 0.15 €/0.29 лв. за точка, Pro: 0.13 €/0.25 лв. за точка)</li>
          <li>Реферали — до 15 точки на реферал + 100 точки бонус при 10 реферала</li>
        </ul>
        <p className="text-amber-400 text-sm">⚡ В момента (тестова версия) всички функции са безплатни и точки не се изразходват.</p>
      </div>
    )
  },
  {
    category: 'providers',
    question: 'Какъв е абонаментът и до какъв бюджет мога да приемам заявки?',
    answer: (
      <div className="space-y-4">
        <p>В момента платформата е в <strong className="text-green-400">бета версия</strong> и всичко е безплатно — включително Free планът има пълен достъп до всички функции. След официалното пускане ще има три плана:</p>
        
        {/* Tier comparison table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[400px]">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-2 pr-3 text-slate-400 font-medium"></th>
                <th className="text-center py-2 px-3 text-slate-300 font-medium">🆓 Free</th>
                <th className="text-center py-2 px-3 text-yellow-400 font-medium">⭐ Normal</th>
                <th className="text-center py-2 px-3 text-purple-400 font-medium">👑 Pro</th>
              </tr>
            </thead>
            <tbody className="text-slate-400">
              <tr className="border-b border-white/10">
                <td className="py-2 pr-3 text-slate-300">Цена/месец</td>
                <td className="text-center py-2 px-3">0 €<br/>(0 лв.)</td>
                <td className="text-center py-2 px-3">130 €<br/>(255 лв.)</td>
                <td className="text-center py-2 px-3">180 €<br/>(353 лв.)</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-2 pr-3 text-slate-300">Точки/месец</td>
                <td className="text-center py-2 px-3">15</td>
                <td className="text-center py-2 px-3">60</td>
                <td className="text-center py-2 px-3">100</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-2 pr-3 text-slate-300">Макс. бюджет</td>
                <td className="text-center py-2 px-3 text-red-400">до 200 €<br/>(392 лв.)</td>
                <td className="text-center py-2 px-3 text-yellow-400">до 1 000 €<br/>(1960 лв.)</td>
                <td className="text-center py-2 px-3 text-green-400">Без лимит</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-2 pr-3 text-slate-300">Наддаване</td>
                <td className="text-center py-2 px-3">✅</td>
                <td className="text-center py-2 px-3">✅</td>
                <td className="text-center py-2 px-3">✅</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Points cost per budget range */}
        <p className="text-white font-medium pt-2">Цена в точки за приемане на заявка (по бюджет):</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[400px]">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-2 pr-3 text-slate-400 font-medium">Бюджет</th>
                <th className="text-center py-2 px-3 text-slate-300 font-medium">Free</th>
                <th className="text-center py-2 px-3 text-yellow-400 font-medium">Normal</th>
                <th className="text-center py-2 px-3 text-purple-400 font-medium">Pro</th>
              </tr>
            </thead>
            <tbody className="text-slate-400">
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">1–125 € (2–245 лв.)</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">10</td>
                <td className="text-center py-1.5 px-3">10</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">126–250 € (247–490 лв.)</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">20</td>
                <td className="text-center py-1.5 px-3">15</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">251–400 € (492–784 лв.)</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">40</td>
                <td className="text-center py-1.5 px-3">30</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">401–500 € (786–980 лв.)</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">60</td>
                <td className="text-center py-1.5 px-3">50</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">501–1 000 € (982–1960 лв.)</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">100</td>
                <td className="text-center py-1.5 px-3">80</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">1 001–1 500 € (1962–2940 лв.)</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">110</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">1 501–2 000 € (2942–3920 лв.)</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">160</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">2 001–2 500 € (3922–4900 лв.)</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">215</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">2 501–3 000 € (4902–5880 лв.)</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">280</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">3 001–3 500 € (5882–6860 лв.)</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">350</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">3 501–4 000 € (6862–7840 лв.)</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">430</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">4 001–4 500 € (7842–8820 лв.)</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">520</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3">4 501–5 000 € (8822–9800 лв.)</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">640</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-slate-500 text-xs">❌ = не е достъпно за този план. При наддаване: 3 точки такса участие + остатъка при печалба.</p>

        {/* Features comparison table */}
        <p className="text-white font-medium pt-4">Функции и инструменти по план:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[400px]">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-2 pr-3 text-slate-400 font-medium">Функция</th>
                <th className="text-center py-2 px-3 text-slate-300 font-medium">Free</th>
                <th className="text-center py-2 px-3 text-yellow-400 font-medium">Normal</th>
                <th className="text-center py-2 px-3 text-purple-400 font-medium">Pro</th>
              </tr>
            </thead>
            <tbody className="text-slate-400">
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">Профил в маркетплейса</td>
                <td className="text-center py-1.5 px-3">✅</td>
                <td className="text-center py-1.5 px-3">✅</td>
                <td className="text-center py-1.5 px-3">✅</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">SMS при пропуснато обаждане</td>
                <td className="text-center py-1.5 px-3">✅</td>
                <td className="text-center py-1.5 px-3">✅</td>
                <td className="text-center py-1.5 px-3">✅</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">Чат с клиенти</td>
                <td className="text-center py-1.5 px-3">✅</td>
                <td className="text-center py-1.5 px-3">✅</td>
                <td className="text-center py-1.5 px-3">✅</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">Кандидатстване по заявки</td>
                <td className="text-center py-1.5 px-3">✅</td>
                <td className="text-center py-1.5 px-3">✅</td>
                <td className="text-center py-1.5 px-3">✅</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">Вижда заявки на картата</td>
                <td className="text-center py-1.5 px-3">до 200 €</td>
                <td className="text-center py-1.5 px-3">до 1 000 €</td>
                <td className="text-center py-1.5 px-3">Всички</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">Клиентите го виждат на картата</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">✅</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">Наддаване (bidding)</td>
                <td className="text-center py-1.5 px-3">✅</td>
                <td className="text-center py-1.5 px-3">✅</td>
                <td className="text-center py-1.5 px-3">✅</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">Галерия снимки</td>
                <td className="text-center py-1.5 px-3">до 5</td>
                <td className="text-center py-1.5 px-3">до 15</td>
                <td className="text-center py-1.5 px-3">до 30</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-1.5 pr-3">Категории услуги</td>
                <td className="text-center py-1.5 px-3">1</td>
                <td className="text-center py-1.5 px-3">до 3</td>
                <td className="text-center py-1.5 px-3">до 5</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3">Допълнителни точки</td>
                <td className="text-center py-1.5 px-3 text-red-400">❌</td>
                <td className="text-center py-1.5 px-3">0.15 € / 0.29 лв.</td>
                <td className="text-center py-1.5 px-3">0.13 € / 0.25 лв.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-2">Абонаментът е месец за месец — без дългосрочен ангажимент, просто спирате да плащате ако не желаете да продължите.</p>
      </div>
    )
  },

  // === За Клиенти ===
  {
    category: 'customers',
    question: 'Безплатно ли е за клиенти?',
    answer: 'Да! Клиентите използват платформата напълно безплатно. Можете да търсите майстори, да преглеждате профили и отзиви, да пишете в чата и да публикувате заявки без никакво заплащане. Платформата е безплатна за клиенти завинаги — майсторите плащат абонамент за бизнес инструментите, а клиентите използват всичко без такси.'
  },
  {
    category: 'customers',
    question: 'Как клиентите намират моя профил?',
    answer: (
      <div className="space-y-2">
        <p>Клиентите могат да ви намерят по няколко начина:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Чрез <strong className="text-white">SMS</strong> — получават линк към профила ви при пропуснато обаждане</li>
          <li>Чрез <strong className="text-white">картата</strong> — виждат ви като наблизо специалист (само Pro план)</li>
          <li>Чрез <strong className="text-white">маркетплейса</strong> — търсят по категория и локация</li>
          <li>Чрез <strong className="text-white">заявки</strong> — публикуват заявка и вие кандидатствате</li>
        </ul>
      </div>
    )
  },
  {
    category: 'customers',
    question: 'Как избирам майстор?',
    answer: 'Можете да търсите по категория услуга и локация, да преглеждате профили с отзиви и рейтинг, да използвате картата за намиране на майстори наблизо, или да публикувате заявка и да получите оферти от заинтересовани майстори.'
  },
  {
    category: 'customers',
    question: 'Виждат ли майсторите моя телефонен номер?',
    answer: 'Не всеки. Когато публикувате заявка, телефонният ви номер е скрит (показва се като ***-***-****). Само майсторът, когото вие изберете да работи по заявката ви, получава достъп до номера ви. Останалите майстори никога не виждат реалния ви номер.'
  },

  // === Общи въпроси ===
  {
    category: 'general',
    question: 'Какво е SnapFix?',
    answer: 'SnapFix е платформа, която свързва клиенти с проверени майстори и сервизни специалисти в България. За майстори предлагаме инструменти за управление на заявки, SMS автоматизация при пропуснати обаждания, профил в маркетплейса и видимост на картата. За клиенти — лесно търсене и връзка с подходящ специалист.'
  },
  {
    category: 'general',
    question: 'Как мога да изтегля приложението?',
    answer: (
      <div className="space-y-3">
        <p>В момента приложението е в <strong className="text-green-400">бета версия</strong> и можете да се присъедините като бета тестер напълно безплатно!</p>
        <div className="bg-indigo-900/30 border border-indigo-500/30 rounded-lg p-4">
          <p className="font-medium text-white mb-2">📱 Регистрирайте се за бета достъп:</p>
          <a 
            href="https://snapfix.bg/beta/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
          >
            <span>🔗</span>
            Регистрация за бета тестване
          </a>
        </div>
        <p className="text-sm text-slate-400">Регистрирайте се на страницата и ще получите инструкции как да изтеглите приложението (чрез Google Play за Gmail адреси или директно APK за други имейли).</p>
      </div>
    )
  },
  {
    category: 'general',
    question: 'Какво е бета версия и защо да се присъединя сега?',
    answer: (
      <div className="space-y-3">
        <p>Бета версията е ранна тестова версия на приложението, която пускаме преди официалния старт. Ето защо си струва да се присъедините сега:</p>
        <ul className="list-disc list-inside space-y-2 text-slate-400">
          <li><strong className="text-green-400">50 безплатни SMS месечно</strong> — докато тестваме платформата</li>
          <li><strong className="text-green-400">Всички функции напълно безплатно</strong> — без ограничения за бюджет на заявки, брой снимки, категории услуги</li>
          <li><strong className="text-yellow-400">Първи на пазара</strong> — започнете да градите профил, галерия и отзиви преди конкуренцията</li>
          <li><strong className="text-yellow-400">Реферален бонус</strong> — спечелете до 250 точки като поканите колеги (виж долу)</li>
          <li><strong className="text-purple-400">Влияние върху развитието</strong> — вашата обратна връзка помага да направим приложението още по-добро</li>
        </ul>
        <p className="text-amber-400 font-medium">⏰ Когато излезем от бета, данните ви остават — профил, галерия, отзиви, реферални точки!</p>
      </div>
    )
  },
  {
    category: 'general',
    question: 'Има ли iOS версия?',
    answer: 'В момента разработваме само за Android (Google Play). iOS версията ще бъде пусната след официалния старт на платформата. Междувременно можете да използвате уебсайта snapfix.bg от всяко устройство.'
  },
  {
    category: 'general',
    question: 'Трябва ли ми приложението или мога да ползвам само сайта?',
    answer: 'Сайтът е достъпен за всички — и за търсене на майстори, и за управление на профила. Но мобилното приложение е необходимо за SMS функцията при пропуснати обаждания и за споделяне на местоположение на картата, тъй като тези функции изискват достъп до телефонните възможности.'
  },
  {
    category: 'general',
    question: 'Как се регистрирам?',
    answer: 'Регистрацията е бърза — нужни са ви само имейл адрес и парола. След регистрация попълвате профила си с информация за бизнеса, категории услуги и локация. Можете да добавите снимки, сертификати и описание.'
  },
  {
    category: 'general',
    question: 'Как работи реферал програмата?',
    answer: (
      <div className="space-y-3">
        <p>Можете да печелите точки като поканите други майстори да се регистрират в платформата с вашия реферален код.</p>
        <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg p-4">
          <p className="font-medium text-white mb-2">💰 Как печеля:</p>
          <ul className="space-y-2 text-slate-300">
            <li>• <strong className="text-yellow-400">5 точки</strong> — Реферал се регистрира с вашия код</li>
            <li>• <strong className="text-yellow-400">+5 точки</strong> — Реферал попълни профила си (снимка, услуги, локация)</li>
            <li>• <strong className="text-yellow-400">+5 точки</strong> — Реферал активира SMS функцията</li>
            <li>• <strong className="text-green-400">+100 точки БОНУС</strong> — При достигане на 10 активни реферала</li>
          </ul>
        </div>
        <p className="text-sm"><strong className="text-white">Максимум:</strong> 15 точки на реферал × 10 реферала + 100 бонус = <span className="text-green-400 font-bold">250 точки</span></p>
        <p className="text-slate-400">Реферални код намирате в Настройки → Моят реферален код. Споделете го с колеги от бранша!</p>
      </div>
    )
  },
  {
    category: 'general',
    question: 'Какво се случва с моите данни след края на бета версията?',
    answer: 'Всички ваши данни остават запазени! Профил, галерия снимки, отзиви, чат история, спечелени реферални точки — всичко остава. Когато платформата излезе официално, просто ще изберете абонаментен план и ще продължите да използвате акаунта си с всички постижения.'
  },
  {
    category: 'providers',
    question: 'Как работят отстъпките при първа покупка на абонамент?',
    answer: (
      <div className="space-y-3">
        <p>Всеки потребител има право на <strong className="text-green-400">отстъпка при първа покупка</strong> за всяка комбинация от план и тип абонамент:</p>
        
        <div className="bg-gradient-to-r from-green-900/30 to-purple-900/30 border border-green-500/30 rounded-lg p-4">
          <p className="font-medium text-white mb-3">🎁 Налични отстъпки (общо 4):</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-green-400 font-medium mb-1">Normal Месечен</p>
              <p className="text-slate-300">10% отстъпка (спестявате 13 €)</p>
              <p className="text-slate-400 text-xs">Плащате 117 € вместо 130 €</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-green-400 font-medium mb-1">Normal Годишен</p>
              <p className="text-slate-300">10% отстъпка (спестявате 140 €)</p>
              <p className="text-slate-400 text-xs">Плащате 1,260 € вместо 1,400 €</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-purple-400 font-medium mb-1">Pro Месечен</p>
              <p className="text-slate-300">15% отстъпка (спестявате 34.50 €)</p>
              <p className="text-slate-400 text-xs">Плащате 195.50 € вместо 230 €</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-purple-400 font-medium mb-1">Pro Годишен</p>
              <p className="text-slate-300">15% отстъпка (спестявате 285 €)</p>
              <p className="text-slate-400 text-xs">Плащате 1,615 € вместо 1,900 €</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
          <p className="font-medium text-white mb-2">✅ Важно да знаете:</p>
          <ul className="space-y-2 text-slate-300 text-sm">
            <li>• Всяка отстъпка се прилага <strong>само веднъж</strong> за съответната комбинация</li>
            <li>• Можете да получите отстъпка за <strong>всяка от 4-те комбинации</strong> независимо</li>
            <li>• Например: Ако купите Normal месечен с отстъпка, по-късно можете да получите отстъпка и за Normal годишен</li>
            <li>• Или: Ако започнете с Pro месечен, можете да надградите до Pro годишен и пак да получите отстъпка</li>
            <li>• Не е важно кой план купувате първи - всяка комбинация има своя независима отстъпка</li>
          </ul>
        </div>

        <p className="text-amber-400 text-sm font-medium">💡 Съвет: Годишният план винаги е по-изгоден - освен отстъпката при първа покупка, спестявате и от по-ниската годишна цена!</p>
      </div>
    )
  },
]

const categories = [
  { id: 'all', label: 'Всички', icon: '📚' },
  { id: 'general', label: 'Общи', icon: '❓' },
  { id: 'sms', label: 'SMS & Точки', icon: '📱' },
  { id: 'privacy', label: 'Поверителност', icon: '🔒' },
  { id: 'map', label: 'Карта & Локация', icon: '🗺️' },
  { id: 'providers', label: 'За Майстори', icon: '🔧' },
  { id: 'customers', label: 'За Клиенти', icon: '👤' },
]

function FAQAccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden transition-all duration-200 hover:border-white/20">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left bg-slate-800/30 hover:bg-slate-800/50 transition-colors duration-200"
      >
        <span className="text-white font-medium pr-4">{item.question}</span>
        <svg
          className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="p-5 pt-2 text-slate-300 leading-relaxed">
          {item.answer}
        </div>
      </div>
    </div>
  )
}

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())

  const filteredItems = activeCategory === 'all'
    ? faqItems
    : faqItems.filter(item => item.category === activeCategory)

  const toggleItem = (index: number) => {
    setOpenItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const expandAll = () => {
    setOpenItems(new Set(filteredItems.map((_, i) => i)))
  }

  const collapseAll = () => {
    setOpenItems(new Set())
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Често Задавани Въпроси
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Отговори на най-важните въпроси за SnapFix — сигурност, поверителност и как работи платформата
          </p>
        </div>

        {/* Privacy Highlight Banner */}
        <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-500/30 rounded-2xl p-6 md:p-8 mb-10">
          <div className="flex items-start gap-4">
            <span className="text-4xl flex-shrink-0">🛡️</span>
            <div>
              <h2 className="text-xl font-bold text-green-400 mb-2">Вашата поверителност е наш приоритет</h2>
              <p className="text-slate-300">
                Телефонните номера са <strong className="text-white">криптирани с AES-256</strong> (банково ниво) в базата данни. 
                Местоположението на картата е <strong className="text-white">изцяло по ваш избор</strong>. 
                Не четем контактите ви. Профилът ви (име, услуги, локация, отзиви) е публично видим в сайта — така клиентите ви намират.
              </p>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id)
                setOpenItems(new Set())
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white border border-white/10'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Expand/Collapse All */}
        <div className="flex justify-end gap-3 mb-4">
          <button
            onClick={expandAll}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Разгъни всички
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={collapseAll}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Сгъни всички
          </button>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {filteredItems.map((item, index) => (
            <FAQAccordionItem
              key={`${activeCategory}-${index}`}
              item={item}
              isOpen={openItems.has(index)}
              onToggle={() => toggleItem(index)}
            />
          ))}
        </div>

        {/* Still have questions? */}
        <div className="mt-16 text-center bg-slate-800/30 border border-white/10 rounded-2xl p-8">
          <span className="text-5xl mb-4 block">💬</span>
          <h2 className="text-2xl font-bold text-white mb-3">Имате друг въпрос?</h2>
          <p className="text-slate-300 mb-6 max-w-lg mx-auto">
            Не намерихте отговор на вашия въпрос? Свържете се с нас и ще ви отговорим възможно най-бързо.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              ✉️ Свържете се с нас
            </Link>
            <Link
              href="/privacy"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              🔒 Политика за поверителност
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
