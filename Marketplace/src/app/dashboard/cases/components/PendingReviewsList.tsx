'use client'

import { Case } from '@/types/marketplace'

interface PendingReviewsListProps {
  reviews: Case[]
  onReview: (caseData: Case) => void
}

export function PendingReviewsList({ reviews, onReview }: PendingReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📭</div>
        <h3 className="text-xl font-semibold text-white mb-2">Няма заявки за преглед</h3>
        <p className="text-slate-400">Когато клиент ви изпрати директна заявка, тя ще се появи тук.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">
          📩 Заявки за преглед ({reviews.length})
        </h2>
        <p className="text-sm text-slate-400">
          Клиенти ви изпратиха тези заявки директно
        </p>
      </div>

      {reviews.map((caseItem) => (
        <div 
          key={caseItem.id}
          className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-400/30 rounded-xl p-4 sm:p-6 hover:border-orange-400/50 transition-all"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Case Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full text-xs font-medium">
                  Чака преглед
                </span>
                <span className="text-slate-400 text-sm">
                  {new Date(caseItem.created_at).toLocaleDateString('bg-BG')}
                </span>
              </div>
              
              <h3 className="text-lg font-semibold text-white mb-2">
                {caseItem.service_type || caseItem.category || 'Обща услуга'}
              </h3>
              
              <p className="text-slate-300 text-sm mb-3 line-clamp-2">
                {caseItem.description}
              </p>

              <div className="flex flex-wrap gap-2 text-sm">
                {caseItem.city && (
                  <span className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded">
                    📍 {caseItem.city}
                    {caseItem.neighborhood && `, ${caseItem.neighborhood}`}
                  </span>
                )}
                {(caseItem.budget || (caseItem as any).customer_budget) && (
                  <span className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded font-medium">
                    💰 {(caseItem as any).customer_budget || caseItem.budget} лв
                  </span>
                )}
                {caseItem.preferred_date && (
                  <span className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded">
                    📅 {caseItem.preferred_date}
                  </span>
                )}
              </div>
            </div>

            {/* Action Button */}
            <div className="flex sm:flex-col gap-2">
              <button
                onClick={() => onReview(caseItem)}
                className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-400 hover:to-amber-400 transition-all shadow-lg shadow-orange-500/30"
              >
                Прегледай
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
