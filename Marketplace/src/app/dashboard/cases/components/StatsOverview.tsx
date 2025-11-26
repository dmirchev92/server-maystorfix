import React from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { DashboardStats } from '@/types/marketplace'

interface StatsOverviewProps {
  stats: DashboardStats | null
  onViewChange: (viewMode: 'available' | 'assigned' | 'declined', status?: string) => void
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, onViewChange }) => {
  if (!stats) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {/* Available Cases */}
      <button
        onClick={() => onViewChange('available', '')}
        className="text-left"
      >
        <Card variant="elevated" hover padding="lg" className="group cursor-pointer h-full">
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-300 mb-2">
                  Налични заявки
                </p>
                <p className="text-3xl font-bold text-white">
                  {stats.available || 0}
                </p>
              </div>
              <div className="p-4 rounded-2xl transition-all duration-300 md:group-hover:scale-110 bg-gradient-to-br from-green-500/20 to-green-400/20 border border-green-400/30">
                <span className="text-3xl">📋</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </button>

      {/* Accepted Cases */}
      <button
        onClick={() => onViewChange('assigned', 'accepted')}
        className="text-left"
      >
        <Card variant="elevated" hover padding="lg" className="group cursor-pointer h-full">
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-300 mb-2">
                  Приети
                </p>
                <p className="text-3xl font-bold text-white">
                  {stats.accepted || 0}
                </p>
              </div>
              <div className="p-4 rounded-2xl transition-all duration-300 md:group-hover:scale-110 bg-gradient-to-br from-blue-500/20 to-blue-400/20 border border-blue-400/30">
                <span className="text-3xl">✅</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </button>

      {/* Declined Cases */}
      <button
        onClick={() => onViewChange('declined', '')}
        className="text-left"
      >
        <Card variant="elevated" hover padding="lg" className="group cursor-pointer h-full">
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-300 mb-2">
                  Отказани
                </p>
                <p className="text-3xl font-bold text-white">
                  {stats.declined || 0}
                </p>
              </div>
              <div className="p-4 rounded-2xl transition-all duration-300 md:group-hover:scale-110 bg-gradient-to-br from-red-500/20 to-red-400/20 border border-red-400/30">
                <span className="text-3xl">🚫</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </button>

      {/* Completed Cases */}
      <button
        onClick={() => onViewChange('assigned', 'completed')}
        className="text-left"
      >
        <Card variant="elevated" hover padding="lg" className="group cursor-pointer h-full">
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-300 mb-2">
                  Завършени
                </p>
                <p className="text-3xl font-bold text-white">
                  {stats.completed || 0}
                </p>
              </div>
              <div className="p-4 rounded-2xl transition-all duration-300 md:group-hover:scale-110 bg-gradient-to-br from-purple-500/20 to-purple-400/20 border border-purple-400/30">
                <span className="text-3xl">🏁</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </button>
    </div>
  )
}
