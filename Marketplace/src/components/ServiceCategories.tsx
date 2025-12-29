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
    <section className="py-16 sm:py-20 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-10 left-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
              🧰 Категории
            </div>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
                Всички услуги
              </span>
            </h2>
            <p className="mt-2 text-lg text-slate-300 max-w-2xl">
              Изберете категория и намерете подходящия специалист
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {serviceCategories.map((category) => (
            <Link key={category.id} href={category.href} className="group">
              <div className="h-full rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 backdrop-blur-md transition-colors">
                <div className="p-3">
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br ${category.gradient} flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow`}>
                    <Image
                      src={`/icons/categories/${category.id}.png`}
                      alt={category.name}
                      width={48}
                      height={48}
                      className="drop-shadow-lg"
                    />
                  </div>
                  <h3 className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors duration-200 leading-tight text-center">
                    {category.name}
                  </h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

