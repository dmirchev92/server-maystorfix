import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-orange-500 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-lg">🔧</span>
              </div>
              <span className="text-xl font-bold">ServiceText Pro</span>
            </div>
            <p className="text-gray-400 mb-4">
              Платформата за намиране на най-добрите професионалисти в България. 
              Свързваме клиенти с верифицирани майстори за всички видове услуги.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-white">
                <span className="sr-only">Facebook</span>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white">
                <span className="sr-only">Instagram</span>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987 6.62 0 11.987-5.367 11.987-11.987C24.014 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.323-1.297C4.198 14.895 3.708 13.744 3.708 12.447s.49-2.448 1.297-3.323c.875-.807 2.026-1.297 3.323-1.297s2.448.49 3.323 1.297c.807.875 1.297 2.026 1.297 3.323s-.49 2.448-1.297 3.323c-.875.807-2.026 1.297-3.323 1.297z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Услуги</h3>
            <ul className="space-y-2">
              <li><Link href="/search?service=electrical" className="text-gray-400 hover:text-white">Електротехник</Link></li>
              <li><Link href="/search?service=plumbing" className="text-gray-400 hover:text-white">Водопроводчик</Link></li>
              <li><Link href="/search?service=hvac" className="text-gray-400 hover:text-white">Климатик</Link></li>
              <li><Link href="/search?service=general" className="text-gray-400 hover:text-white">Общ майстор</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Компания</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-gray-400 hover:text-white">За нас</Link></li>
              <li><Link href="/how-it-works" className="text-gray-400 hover:text-white">Как работи</Link></li>
              <li><Link href="/contact" className="text-gray-400 hover:text-white">Контакти</Link></li>
              <li><Link href="/privacy" className="text-gray-400 hover:text-white">Поверителност</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 ServiceText Pro. Всички права запазени.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="/terms" className="text-gray-400 hover:text-white text-sm">
                Условия за ползване
              </Link>
              <Link href="/privacy" className="text-gray-400 hover:text-white text-sm">
                Политика за поверителност
              </Link>
              <Link href="/gdpr" className="text-gray-400 hover:text-white text-sm">
                GDPR
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

