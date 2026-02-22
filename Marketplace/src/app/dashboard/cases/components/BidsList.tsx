import React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Bid, BidStatus } from '@/types/marketplace'

interface BidsListProps {
  bids: Bid[]
  filter: 'all' | 'pending' | 'won' | 'lost'
  onFilterChange: (filter: 'all' | 'pending' | 'won' | 'lost') => void
}

export const BidsList: React.FC<BidsListProps> = ({ bids, filter, onFilterChange }) => {
  const router = useRouter()

  const filteredBids = bids.filter(bid => filter === 'all' || bid.bid_status === filter)

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>💰</span>
          Моите кандидатури
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Bids Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10 pb-4 overflow-x-auto">
          <button
            onClick={() => onFilterChange('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              filter === 'all'
                ? 'bg-green-500/20 text-green-300 border border-green-400/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Всички ({bids.length})
          </button>
          <button
            onClick={() => onFilterChange('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              filter === 'pending'
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Чакащи ({bids.filter(b => b.bid_status === 'pending').length})
          </button>
          <button
            onClick={() => onFilterChange('won')}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              filter === 'won'
                ? 'bg-green-500/20 text-green-300 border border-green-400/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Спечелени ({bids.filter(b => b.bid_status === 'won').length})
          </button>
          <button
            onClick={() => onFilterChange('lost')}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              filter === 'lost'
                ? 'bg-red-500/20 text-red-300 border border-red-400/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Загубени ({bids.filter(b => b.bid_status === 'lost').length})
          </button>
        </div>

        {/* Bids List */}
        {filteredBids.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-slate-300 text-lg mb-2">Няма кандидатури</p>
            <p className="text-slate-400 text-sm">
              {filter === 'all' 
                ? 'Все още не сте подали кандидатури за заявки'
                : `Няма ${filter === 'pending' ? 'чакащи' : filter === 'won' ? 'спечелени' : 'загубени'} кандидатури`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBids.map((bid) => (
              <Card key={bid.id} variant="outline" hover padding="lg">
                <CardContent>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-green-400">#{bid.bid_order}</span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                          bid.bid_status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30' :
                          bid.bid_status === 'won' ? 'bg-green-500/20 text-green-300 border-green-400/30' :
                          bid.bid_status === 'lost' ? 'bg-red-500/20 text-red-300 border-red-400/30' :
                          'bg-slate-500/20 text-slate-300 border-slate-400/30'
                        }`}>
                          {bid.bid_status === 'pending' ? '⏳ Чакаща' :
                           bid.bid_status === 'won' ? '🎉 Спечелена' :
                           bid.bid_status === 'lost' ? '❌ Загубена' :
                           '↩️ Възстановена'}
                        </span>
                      </div>
                      <h3 className="text-lg font-medium text-white mb-3">
                        {bid.description || bid.service_type || 'Заявка'}
                      </h3>
                      
                      {/* Bid Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-400">💰 Предложена цена:</span>
                            <span className="font-semibold text-green-400">{bid.proposed_budget_range} €</span>
                          </div>
                          {bid.budget && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-400">💵 Бюджет на клиента:</span>
                              <span className="font-medium text-slate-300">{bid.budget} €</span>
                            </div>
                          )}
                          {bid.city && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-400">📍 Град:</span>
                              <span className="text-slate-300">{bid.city}</span>
                            </div>
                          )}
                          {bid.case_status && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-400">📋 Статус на заявката:</span>
                              <span className={`font-medium ${
                                bid.case_status === 'pending' ? 'text-yellow-400' :
                                bid.case_status === 'accepted' ? 'text-green-400' :
                                bid.case_status === 'completed' ? 'text-blue-400' :
                                'text-slate-300'
                              }`}>
                                {bid.case_status === 'pending' ? 'Чакаща' :
                                 bid.case_status === 'accepted' ? 'Приета' :
                                 bid.case_status === 'completed' ? 'Завършена' : bid.case_status}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-400">📅 Дата на оферта:</span>
                            <span className="text-slate-300">{new Date(bid.created_at).toLocaleDateString('bg-BG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className={`text-slate-400 ${
                              bid.bid_status === 'won' ? 'text-red-400' :
                              bid.bid_status === 'lost' ? 'text-yellow-400' :
                              'text-slate-400'
                            }`}>💎 Точки:</span>
                            <span className={`font-medium ${
                              bid.bid_status === 'won' ? 'text-red-400' :
                              bid.bid_status === 'lost' ? 'text-yellow-400' :
                              'text-slate-300'
                            }`}>
                              {bid.bid_status === 'won' ? `-${bid.points_bid}` :
                               bid.bid_status === 'lost' ? `-${bid.points_deducted} (${Math.round((bid.points_bid - (bid.points_deducted || 0)) / bid.points_bid * 100)}% възстановени)` :
                               `-${bid.points_bid} (резервирани)`}
                            </span>
                          </div>
                          {bid.bidding_closed && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-400">🔒 Наддаване:</span>
                              <span className="text-red-400 font-medium">Затворено</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Bid Comment */}
                      {bid.bid_comment && (
                        <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                          <div className="flex items-start gap-2">
                            <span className="text-slate-400 text-sm">💬 Коментар:</span>
                            <p className="text-slate-300 text-sm flex-1">{bid.bid_comment}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {bid.case_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/cases`)}
                      >
                        Виж заявка →
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
