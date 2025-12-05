import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/Card'
import { SERVICE_CATEGORIES } from '@/constants/serviceCategories'

// All service categories with gradients for homepage display
const categoryGradients: Record<string, string> = {
  'cat_electrician': 'from-yellow-500 to-orange-600',
  'cat_plumber': 'from-blue-600 to-blue-700',
  'cat_hvac': 'from-cyan-600 to-blue-600',
  'cat_carpenter': 'from-amber-700 to-orange-700',
  'cat_painter': 'from-indigo-600 to-purple-600',
  'cat_locksmith': 'from-orange-600 to-red-600',
  'cat_cleaner': 'from-teal-600 to-green-600',
  'cat_gardener': 'from-green-600 to-emerald-600',
  'cat_handyman': 'from-slate-600 to-slate-700',
  'cat_renovation': 'from-rose-600 to-pink-600',
  'cat_roofer': 'from-blue-600 to-indigo-700',
  'cat_mover': 'from-violet-600 to-purple-600',
  'cat_tiler': 'from-sky-600 to-blue-600',
  'cat_welder': 'from-orange-700 to-red-700',
  'cat_appliance': 'from-emerald-600 to-teal-600',
  'cat_flooring': 'from-amber-600 to-yellow-700',
  'cat_plasterer': 'from-stone-600 to-slate-600',
  'cat_glasswork': 'from-cyan-500 to-sky-600',
  'cat_design': 'from-fuchsia-600 to-pink-600',
}

// Map categories for display
const serviceCategories = SERVICE_CATEGORIES.map(cat => ({
  id: cat.value.replace('cat_', ''),
  name: cat.label,
  emoji: cat.emoji,
  gradient: categoryGradients[cat.value] || 'from-slate-600 to-slate-700',
  href: `/search?category=${cat.value.replace('cat_', '')}`
}))

export function ServiceCategories() {
  return (
    <section className="py-20 relative overflow-hidden">
      {/* Industrial Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-500/10 rounded-lg blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-lg blur-3xl"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Всички услуги
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Изберете категория и намерете подходящия специалист
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {serviceCategories.map((category) => (
            <Link key={category.id} href={category.href}>
              <Card 
                variant="elevated" 
                hover 
                padding="sm"
                className="group h-full transform transition-all duration-300 hover:scale-105 hover:shadow-xl"
              >
                <CardContent className="p-3">
                  <div className="text-center">
                    {/* PNG icon with gradient background */}
                    <div className={`w-16 h-16 mx-auto mb-3 rounded-xl bg-gradient-to-br ${category.gradient} flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                      <Image
                        src={`/icons/categories/${category.id}.png`}
                        alt={category.name}
                        width={48}
                        height={48}
                        className="drop-shadow-lg"
                      />
                    </div>
                    
                    {/* Category name */}
                    <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors duration-300 leading-tight">
                      {category.name}
                    </h3>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

      </div>
    </section>
  )
}

