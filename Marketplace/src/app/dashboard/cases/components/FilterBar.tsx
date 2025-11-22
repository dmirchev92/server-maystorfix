import React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SERVICE_CATEGORIES } from '@/constants/serviceCategories'
import { sofiaNeighborhoods } from '@/components/NeighborhoodSelect'
import { FilterParams } from '@/types/marketplace'

interface FilterBarProps {
  filters: FilterParams
  onFilterChange: (key: keyof FilterParams, value: any) => void
  userRole: string
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, onFilterChange, userRole }) => {
  const router = useRouter()
  const isProvider = userRole === 'tradesperson' || userRole === 'service_provider'

  return (
    <Card variant="elevated" padding="lg" className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🔍</span>
          Допълнителни филтри
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Status Filter - Only show when viewing assigned cases */}
          {isProvider && filters.viewMode === 'assigned' && (
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-3">
                Статус
              </label>
              <select
                value={filters.status}
                onChange={(e) => onFilterChange('status', e.target.value)}
                className="w-full px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-200 bg-white/10 text-white hover:border-white/30 backdrop-blur-sm [&>option]:bg-slate-800 [&>option]:text-white"
              >
                <option value="" className="bg-slate-800 text-white">Всички статуси</option>
                <option value="pending" className="bg-slate-800 text-white">🆕 Нови</option>
                <option value="accepted" className="bg-slate-800 text-white">✅ Приети</option>
                <option value="declined" className="bg-slate-800 text-white">❌ Отказани</option>
                <option value="completed" className="bg-slate-800 text-white">🏁 Завършени</option>
              </select>
            </div>
          )}
          
          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-3">
              Категория
            </label>
            <select
              value={filters.category}
              onChange={(e) => onFilterChange('category', e.target.value)}
              className="w-full px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-200 bg-white/10 text-white hover:border-white/30 backdrop-blur-sm [&>option]:bg-slate-800 [&>option]:text-white"
            >
              <option value="" className="bg-slate-800 text-white">Всички категории</option>
              {SERVICE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value} className="bg-slate-800 text-white">
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          {/* City Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-3">
              Град
            </label>
            <select
              value={filters.city}
              onChange={(e) => onFilterChange('city', e.target.value)}
              className="w-full px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-200 bg-white/10 text-white hover:border-white/30 backdrop-blur-sm [&>option]:bg-slate-800 [&>option]:text-white"
            >
              <option value="" className="bg-slate-800 text-white">Всички градове</option>
              <option value="София" className="bg-slate-800 text-white">🏙️ София</option>
              <option value="Пловдив" className="bg-slate-800 text-white">🏙️ Пловдив</option>
              <option value="Варна" className="bg-slate-800 text-white">🏙️ Варна</option>
              <option value="Бургас" className="bg-slate-800 text-white">🏙️ Бургас</option>
            </select>
          </div>

          {/* Neighborhood Filter - Only show when Sofia is selected */}
          {filters.city === 'София' && (
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-3">
                Квартал
              </label>
              <select
                value={filters.neighborhood}
                onChange={(e) => onFilterChange('neighborhood', e.target.value)}
                className="w-full px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-200 bg-white/10 text-white hover:border-white/30 backdrop-blur-sm [&>option]:bg-slate-800 [&>option]:text-white"
              >
                <option value="" className="bg-slate-800 text-white">Всички квартали</option>
                {sofiaNeighborhoods.map((neighborhood) => (
                  <option key={neighborhood} value={neighborhood} className="bg-slate-800 text-white">
                    {neighborhood}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="flex items-end">
            <Button
              variant="construction"
              size="lg"
              className="w-full"
              leftIcon={<span>➕</span>}
              onClick={() => router.push('/create-case')}
            >
              Нова заявка
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
