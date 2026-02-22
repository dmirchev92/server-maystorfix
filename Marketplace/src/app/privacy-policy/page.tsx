import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Политика за поверителност
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              1. Обща информация
            </h2>
            <p className="text-gray-700 mb-6">
              SnapFix ("ние", "нашата компания") се ангажира да защитава вашата поверителност. 
              Тази политика за поверителност обяснява как събираме, използваме и защитаваме вашата лична информация 
              в съответствие с Общия регламент за защита на данните (GDPR) и българското законодателство.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              2. Какви данни събираме
            </h2>
            <p className="text-gray-700 mb-4">Събираме следните видове лични данни:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li><strong>Лични данни:</strong> Име и фамилия, имейл адрес, телефонен номер</li>
              <li><strong>Местоположение:</strong> Приблизително и точно местоположение (само с ваше съгласие) за показване на доставчици на картата</li>
              <li><strong>Контакти:</strong> Достъп до контактите ви (по избор) за филтриране на познати номера при SMS функцията</li>
              <li><strong>Регистър на обажданията:</strong> Достъп до списъка с обаждания за откриване на пропуснати обаждания и автоматично изпращане на SMS</li>
              <li><strong>Съобщения:</strong> Чат съобщения между клиенти и доставчици в платформата</li>
              <li><strong>Идентификатори на устройството:</strong> За изпращане на push известия</li>
              <li><strong>Информация за услугите:</strong> Данни за услугите, които предлагате или търсите</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              3. Как използваме вашите данни
            </h2>
            <p className="text-gray-700 mb-4">Използваме вашите лични данни за:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Предоставяне на услугите на платформата</li>
              <li>Свързване между клиенти и доставчици на услуги</li>
              <li>Подобряване на потребителското изживяване</li>
              <li>Изпращане на важни съобщения относно услугите</li>
              <li>Спазване на правните изисквания</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              4. Споделяне на данни с трети страни
            </h2>
            <p className="text-gray-700 mb-4">
              Не продаваме вашите лични данни. Споделяме данни със следните доставчици:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li><strong>Между потребители:</strong> Профилът на доставчиците (име, снимка, местоположение, телефон) се показва на клиентите в платформата</li>
              <li><strong>Mobica SMS API:</strong> Телефонните номера се споделят за изпращане на SMS съобщения (с договор за обработка)</li>
              <li><strong>Firebase Cloud Messaging (Google):</strong> За изпращане на push известия (с договор за обработка)</li>
              <li><strong>Облачен хостинг доставчик:</strong> За съхранение на данни в ЕС (с договор за обработка)</li>
              <li><strong>Правни изисквания:</strong> Когато сме задължени по закон</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              5. Вашите права
            </h2>
            <p className="text-gray-700 mb-4">Съгласно GDPR имате право на:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li><strong>Достъп</strong> (чл. 15) — Заявка за копие на вашите лични данни</li>
              <li><strong>Коригиране</strong> (чл. 16) — Поправка на неточни данни</li>
              <li><strong>Изтриване</strong> (чл. 17) — Право на забвене — <a href="/delete-account" className="text-blue-600 hover:underline">Заявка за изтриване на акаунт</a></li>
              <li><strong>Ограничаване</strong> (чл. 18) — Ограничаване на обработката</li>
              <li><strong>Преносимост</strong> (чл. 20) — Получаване на данните в машиночетим формат</li>
              <li><strong>Възражение</strong> (чл. 21) — Възражение срещу обработката</li>
              <li><strong>Оттегляне на съгласие</strong> — По всяко време</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              6. Период на съхранение на данни
            </h2>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Бизнес данни и профил: 60 месеца (5 години)</li>
              <li>Чат разговори: 24 месеца (2 години)</li>
              <li>Аналитика и статистики: 12 месеца (1 година)</li>
              <li>Одитни записи: 84 месеца (7 години)</li>
              <li>Данни за фактуриране: 84 месеца (7 години — законово изискване)</li>
            </ul>
            <p className="text-gray-700 mb-6">
              След изтичането на периода, данните се изтриват или анонимизират автоматично.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              7. Бисквитки
            </h2>
            <p className="text-gray-700 mb-6">
              Използваме бисквитки за подобряване на функционалността на сайта и анализ на трафика. 
              Можете да управлявате настройките за бисквитки чрез вашия браузър.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              8. Сигурност
            </h2>
            <p className="text-gray-700 mb-6">
              Прилагаме подходящи технически и организационни мерки за защита на вашите лични данни 
              от неоторизиран достъп, промяна, разкриване или унищожаване. Всички данни се предават 
              криптирано чрез HTTPS (TLS/SSL).
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              9. Контакти
            </h2>
            <p className="text-gray-700 mb-6">
              За въпроси относно тази политика за поверителност или за упражняване на вашите права, 
              моля свържете се с нас:<br />
              Имейл: <a href="mailto:admin@snapfix.bg" className="text-blue-600 hover:underline">admin@snapfix.bg</a><br />
              Телефон: +359 88 462 9498
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              10. Надзорен орган
            </h2>
            <p className="text-gray-700 mb-6">
              Ако считате, че правата ви са нарушени, можете да подадете жалба до:<br />
              <strong>Комисия за защита на личните данни (КЗЛД)</strong><br />
              Уебсайт: <a href="https://cpdp.bg/" className="text-blue-600 hover:underline" target="_blank" rel="noopener">https://cpdp.bg/</a>
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              11. Промени в политиката
            </h2>
            <p className="text-gray-700 mb-6">
              Запазваме си правото да актуализираме тази политика за поверителност. 
              Промените ще бъдат публикувани на тази страница с нова дата на влизане в сила.
            </p>

            <p className="text-sm text-gray-500 mt-8">
              Последна актуализация: {new Date().toLocaleDateString('bg-BG')}
            </p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  )
}