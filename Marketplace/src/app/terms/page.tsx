import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Общи условия за ползване</h1>
          <p className="text-gray-500 mb-8">Последна актуализация: 24 ноември 2025 г.</p>
          
          <div className="prose prose-lg max-w-none space-y-8">
            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Общи положения</h2>
              <p className="text-gray-700 mb-4">
                Настоящите Общи условия уреждат отношенията между MaystorFix (наричана по-долу "Платформата") 
                и потребителите на платформата (клиенти и майстори).
              </p>
              <p className="text-gray-700">
                С регистрацията си в Платформата, Вие потвърждавате, че сте навършили 18 години, 
                прочели сте и приемате тези Общи условия и Политиката за поверителност.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Услуги на платформата</h2>
              <h3 className="text-lg font-medium text-gray-800 mb-2">За клиенти:</h3>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Публикуване на заявки за услуги</li>
                <li>Търсене на майстори по карта и категория</li>
                <li>Комуникация с майстори чрез вграден чат</li>
                <li>Оценяване и рецензиране на майстори</li>
              </ul>
              <h3 className="text-lg font-medium text-gray-800 mb-2">За майстори:</h3>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Създаване на професионален профил</li>
                <li>Получаване на известия за нови заявки</li>
                <li>Кандидатстване и наддаване за заявки</li>
                <li>Управление на репутация и отзиви</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Задължения на потребителите</h2>
              <p className="text-gray-700 mb-4">Всички потребители се задължават да:</p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Предоставят вярна и актуална информация</li>
                <li>Не злоупотребяват с Платформата</li>
                <li>Спазват добрия тон в комуникацията</li>
                <li>Не публикуват незаконно или обидно съдържание</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Забранени действия</h2>
              <p className="text-gray-700 mb-4">Строго забранено е:</p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Публикуване на неверни или подвеждащи данни</li>
                <li>Спам, нежелани съобщения или реклама</li>
                <li>Събиране на лични данни без съгласие</li>
                <li>Измама или опит за измама</li>
                <li>Използване на ботове или автоматизирани скриптове</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Плащания</h2>
              <p className="text-gray-700 mb-4">
                Платформата НЕ събира комисиона от сделките. Плащанията се извършват директно между клиент и майстор.
              </p>
              <p className="text-gray-700">
                Абонаментите за майстори са отделни и се плащат на Платформата. Цените са обявени в лева с ДДС.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Ограничаване на отговорността</h2>
              <p className="text-gray-700 mb-4">
                MaystorFix е ПОСРЕДНИЧЕСКА платформа. Ние:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>НЕ сме страна в договорите между клиенти и майстори</li>
                <li>НЕ гарантираме качеството на услугите</li>
                <li>НЕ носим отговорност за действията на потребителите</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Защита на личните данни (GDPR)</h2>
              <p className="text-gray-700 mb-4">Съгласно GDPR, имате право на:</p>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li><strong>Достъп</strong> - да получите копие на данните си</li>
                <li><strong>Коригиране</strong> - да поправите неточни данни</li>
                <li><strong>Изтриване</strong> - да поискате изтриване на данните</li>
                <li><strong>Преносимост</strong> - да получите данните в машинно-четим формат</li>
                <li><strong>Оттегляне на съгласие</strong> - по всяко време</li>
              </ul>
              <p className="text-gray-700">
                За упражняване на правата си: <a href="mailto:dpo@maystorfix.com" className="text-blue-600 hover:underline">dpo@maystorfix.com</a>
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Прекратяване</h2>
              <p className="text-gray-700">
                Можете да изтриете профила си по всяко време от настройките. 
                Можем да прекратим достъпа Ви при нарушаване на тези Условия или незаконна дейност.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Приложимо право</h2>
              <p className="text-gray-700">
                Прилага се българското законодателство. Споровете се решават от компетентния български съд в град София.
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Контакт</h2>
              <p className="text-gray-700">
                За въпроси относно тези Условия: <a href="mailto:legal@maystorfix.com" className="text-blue-600 hover:underline">legal@maystorfix.com</a>
              </p>
            </section>

            <div className="border-t pt-6 mt-8">
              <p className="text-sm text-gray-500">
                Пълната версия на Общите условия е достъпна при поискване.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                © 2025 MaystorFix. Всички права запазени.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
