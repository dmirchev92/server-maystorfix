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
              ServiceText Pro ("ние", "нашата компания") се ангажира да защитава вашата поверителност. 
              Тази политика за поверителност обяснява как събираме, използваме и защитаваме вашата лична информация 
              в съответствие с Общия регламент за защита на данните (GDPR) и българското законодателство.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              2. Какви данни събираме
            </h2>
            <p className="text-gray-700 mb-4">Събираме следните видове лични данни:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Име и фамилия</li>
              <li>Имейл адрес</li>
              <li>Телефонен номер</li>
              <li>Адрес (при необходимост)</li>
              <li>Информация за услугите, които предлагате или търсите</li>
              <li>Данни за използването на платформата</li>
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
              4. Споделяне на данни
            </h2>
            <p className="text-gray-700 mb-6">
              Не продаваме, не търгуваме или по друг начин не прехвърляме вашите лични данни на трети страни, 
              освен в случаите, описани в тази политика или когато имаме вашето изрично съгласие.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              5. Вашите права
            </h2>
            <p className="text-gray-700 mb-4">Съгласно GDPR имате право на:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Достъп до вашите лични данни</li>
              <li>Поправка на неточни данни</li>
              <li>Изтриване на данните ("правото да бъдете забравени")</li>
              <li>Ограничаване на обработката</li>
              <li>Преносимост на данните</li>
              <li>Възражение срещу обработката</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              6. Бисквитки
            </h2>
            <p className="text-gray-700 mb-6">
              Използваме бисквитки за подобряване на функционалността на сайта и анализ на трафика. 
              Можете да управлявате настройките за бисквитки чрез вашия браузър.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              7. Сигурност
            </h2>
            <p className="text-gray-700 mb-6">
              Прилагаме подходящи технически и организационни мерки за защита на вашите лични данни 
              от неоторизиран достъп, промяна, разкриване или унищожаване.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              8. Контакти
            </h2>
            <p className="text-gray-700 mb-6">
              За въпроси относно тази политика за поверителност или за упражняване на вашите права, 
              моля свържете се с нас на: privacy@servicetextpro.bg
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              9. Промени в политиката
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