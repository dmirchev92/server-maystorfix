import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const serviceCategories = [
  {
    id: 'electrician',
    name: 'Електротехник',
    description: 'Електрически инсталации, ремонти, монтаж',
    icon: '⚡',
    gradient: 'from-yellow-500 to-orange-600',
    href: '/search?category=electrician'
  },
  {
    id: 'plumber',
    name: 'Водопроводчик',
    description: 'ВиК услуги, канализация, отопление',
    icon: '🚰',
    gradient: 'from-blue-600 to-blue-700',
    href: '/search?category=plumber'
  },
  {
    id: 'hvac',
    name: 'Климатик',
    description: 'Климатизация, вентилация, отопление',
    icon: '🌡️',
    gradient: 'from-cyan-600 to-blue-600',
    href: '/search?category=hvac'
  },
  {
    id: 'handyman',
    name: 'Майстор за всичко',
    description: 'Различни ремонтни и монтажни работи',
    icon: '🛠️',
    gradient: 'from-slate-600 to-slate-700',
    href: '/search?category=handyman'
  },
  {
    id: 'painter',
    name: 'Бояджия',
    description: 'Боядисване на интериор и екстериор',
    icon: '🖌️',
    gradient: 'from-indigo-600 to-purple-600',
    href: '/search?category=painter'
  },
  {
    id: 'locksmith',
    name: 'Ключар',
    description: 'Ключарски услуги и спешни повиквания',
    icon: '🔐',
    gradient: 'from-orange-600 to-red-600',
    href: '/search?category=locksmith'
  },
  {
    id: 'cleaner',
    name: 'Почистване',
    description: 'Професионално почистване на дом и офис',
    icon: '✨',
    gradient: 'from-teal-600 to-green-600',
    href: '/search?category=cleaner'
  },
  {
    id: 'gardener',
    name: 'Градинар',
    description: 'Поддръжка на градини и озеленяване',
    icon: '🌱',
    gradient: 'from-green-600 to-emerald-600',
    href: '/search?category=gardener'
  }
]

export function ServiceCategories() {
  return (
    <section className="py-20 relative overflow-hidden">
      {/* Industrial Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-500/10 rounded-lg blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-lg blur-3xl"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Популярни услуги
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Изберете от най-търсените професионални услуги
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {serviceCategories.map((category) => (
            <Link key={category.id} href={category.href}>
              <Card 
                variant="elevated" 
                hover 
                padding="lg"
                className="group h-full transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                <CardContent>
                  <div className="text-center">
                    {/* Icon with gradient background */}
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${category.gradient} flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <span className="text-4xl filter drop-shadow-lg">
                        {category.icon}
                      </span>
                    </div>
                    
                    {/* Category name */}
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors duration-300">
                      {category.name}
                    </h3>
                    
                    {/* Description */}
                    <p className="text-slate-300 text-sm leading-relaxed mb-4">
                      {category.description}
                    </p>
                    
                    {/* Popular badge */}
                    <Badge variant="primary" size="sm">
                      Популярно
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Call to action */}
        <div className="text-center mt-16">
          <p className="text-slate-300 mb-6">
            Не намирате това, което търсите?
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-8 py-4 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors duration-300 shadow-lg"
          >
            <span>🔧</span>
            Разгледайте всички услуги
          </Link>
        </div>
      </div>
    </section>
  )
}

