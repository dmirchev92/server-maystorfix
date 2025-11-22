import React from 'react'
import { useRouter } from 'next/navigation'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SERVICE_CATEGORIES } from '@/constants/serviceCategories'
import { Case, User } from '@/types/marketplace'
import apiClient from '@/lib/api'

interface CaseCardProps {
  caseData: Case
  user: User
  viewMode: string
  hasBid: boolean
  isBidding: boolean
  onStatusChange: (id: string, status: string) => void
  onPlaceBid: (id: string, budget: number) => void
  onUndecline?: (id: string) => void
}

export const CaseCard: React.FC<CaseCardProps> = ({
  caseData,
  user,
  viewMode,
  hasBid,
  isBidding,
  onStatusChange,
  onPlaceBid,
  onUndecline
}) => {
  const router = useRouter()
  const isProvider = user.role === 'tradesperson' || user.role === 'service_provider'

  const getCategoryDisplayName = (category: string) => {
    const found = SERVICE_CATEGORIES.find(cat => cat.value === category)
    return found ? found.label : category
  }

  const estimatePointsCost = (budget: number): string => {
    if (budget <= 500) return '10-20'
    if (budget <= 1000) return '20-40'
    if (budget <= 1500) return '30-60'
    if (budget <= 2000) return '40-80'
    if (budget <= 3000) return '60-120'
    if (budget <= 4000) return '80-160'
    if (budget <= 5000) return '100-200'
    return '100+'
  }

  return (
    <Card 
      variant="outline" 
      hover 
      padding="none"
      className="group bg-white/5 border-l-4 border-l-indigo-500"
    >
      <CardContent>
        {/* Salesforce-style compact header */}
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Category Icon */}
            <div className="flex-shrink-0 w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-400/30">
              <span className="text-xl">
                {caseData.category === 'electrician' ? '⚡' :
                 caseData.category === 'plumber' ? '🔧' :
                 caseData.category === 'hvac' ? '❄️' :
                 caseData.category === 'carpenter' ? '🪚' :
                 caseData.category === 'painter' ? '🎨' :
                 caseData.category === 'locksmith' ? '🔐' :
                 caseData.category === 'cleaner' ? '🧹' :
                 caseData.category === 'gardener' ? '🌱' :
                 caseData.category === 'handyman' ? '🔨' : '🔧'}
              </span>
            </div>
            
            {/* Title and metadata */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white truncate mb-1">
                {caseData.description}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">
                  {getCategoryDisplayName(caseData.category)}
                </span>
                <StatusBadge status={caseData.status} />
                {caseData.provider_id === user?.id && caseData.assignment_type === 'specific' && (
                  <Badge variant="construction" className="text-xs">
                    ⭐ За теб
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex-shrink-0 ml-4">
            {isProvider ? (
              <div className="flex gap-2">
                {/* If case is assigned to me */}
                {caseData.provider_id === user.id ? (
                  <>
                    {(caseData.status === 'accepted' || (caseData.status === 'pending' && caseData.bidding_enabled)) && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onStatusChange(caseData.id, 'completed')
                        }}
                        leftIcon={<span>🏁</span>}
                      >
                        Завърши
                      </Button>
                    )}
                    {caseData.status === 'pending' && !caseData.bidding_enabled && (
                      <span className="text-xs text-slate-400 px-3 py-2">
                        Изчаква потвърждение
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {/* Bidding Logic */}
                    {caseData.status === 'pending' && caseData.bidding_enabled && !caseData.bidding_closed && caseData.budget && (
                      <div className="flex flex-col gap-1">
                        {hasBid ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push('/provider/my-bids')
                            }}
                            leftIcon={<span>👁️</span>}
                            className="bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                          >
                            Виж моята оферта
                          </Button>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="construction"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onPlaceBid(caseData.id, caseData.budget!)
                                }}
                                disabled={isBidding || (caseData.current_bidders || 0) >= (caseData.max_bidders || 3)}
                                leftIcon={<span>💰</span>}
                              >
                                {isBidding ? 'Наддаване...' : 
                                 (caseData.current_bidders || 0) >= (caseData.max_bidders || 3) ? 'Пълно' : 
                                 'Наддай'}
                              </Button>
                              {viewMode !== 'declined' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (confirm('Сигурни ли сте, че искате да скриете тази заявка?')) {
                                      onStatusChange(caseData.id, 'declined')
                                    }
                                  }}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-white/5 text-slate-400 hover:bg-red-600/20 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition-all duration-200"
                                  title="Скрий заявката"
                                >
                                  <span className="text-lg">✕</span>
                                </button>
                              )}
                            </div>
                            <span className="text-xs text-slate-400 text-center">
                              ~{estimatePointsCost(caseData.budget)} точки
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    
                    {/* Accept/Decline Logic */}
                    {caseData.status === 'pending' && !caseData.bidding_enabled && (
                      <>
                        <Button
                          variant="construction"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (viewMode === 'declined' && onUndecline) {
                              onUndecline(caseData.id)
                            }
                            onStatusChange(caseData.id, 'accepted')
                          }}
                          leftIcon={<span>✅</span>}
                        >
                          Приеми
                        </Button>
                        {viewMode !== 'declined' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onStatusChange(caseData.id, 'declined')
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 border-2 border-red-500 text-white hover:bg-red-700 hover:border-red-600 transition-all duration-200"
                          >
                            <span className="text-red-800 drop-shadow-lg">❌</span>
                            Откажи
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                {caseData.bidding_enabled && (caseData.current_bidders || 0) > 0 && !caseData.winning_bid_id && (
                  <Button
                    variant="construction"
                    size="sm"
                    onClick={() => router.push(`/dashboard/cases/${caseData.id}/bids`)}
                    leftIcon={<span>👥</span>}
                  >
                    Виж оферти ({caseData.current_bidders})
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            {caseData.budget && (
              <div>
                <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">
                  {caseData.status === 'completed' && caseData.winning_bid_id ? 'Бюджет на клиента' : 'Бюджет'}
                </div>
                <div className="text-sm font-semibold text-green-400">{caseData.budget} BGN</div>
              </div>
            )}
            
            {caseData.status === 'completed' && caseData.winning_bid_id && (
              <div>
                <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Моята оферта</div>
                <div className="text-sm font-semibold text-blue-400">
                  {caseData.winning_bid_price || 'Няма данни'} {caseData.winning_bid_price && 'лв'}
                </div>
              </div>
            )}
            
            <div>
              <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Локация</div>
              <div className="text-sm font-semibold text-white">
                {caseData.city}{caseData.neighborhood ? `, ${caseData.neighborhood}` : ''}
              </div>
            </div>
            
            <div>
              <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Дата</div>
              <div className="text-sm font-semibold text-white">{caseData.preferred_date}</div>
            </div>
            
            <div>
              <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Време</div>
              <div className="text-sm font-semibold text-white">{caseData.preferred_time}</div>
            </div>
            
            <div>
              <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Телефон</div>
              {caseData.phone_masked ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 font-mono">{caseData.phone}</span>
                  <span className="text-xs text-amber-400">🔒</span>
                </div>
              ) : (
                <a 
                  href={`tel:${caseData.phone}`} 
                  className="text-sm font-semibold text-blue-400 hover:text-blue-300 hover:underline"
                >
                  {caseData.phone}
                </a>
              )}
            </div>
            
            <div>
              <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Приоритет</div>
              <div className="text-sm font-semibold">
                <span className={`${
                  caseData.priority === 'urgent' ? 'text-red-400' :
                  caseData.priority === 'normal' ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {caseData.priority === 'urgent' ? 'Спешен' :
                   caseData.priority === 'normal' ? 'Нормален' :
                   'Нисък'}
                </span>
              </div>
            </div>
            
            <div>
              <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Създадена</div>
              <div className="text-sm font-semibold text-white">
                {new Date(caseData.created_at).toLocaleDateString('bg-BG')}
              </div>
            </div>
            
            {caseData.square_meters && (
              <div>
                <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Площ</div>
                <div className="text-sm font-semibold text-white">{caseData.square_meters} кв.м</div>
              </div>
            )}
            
            {caseData.bidding_enabled && caseData.provider_id !== user?.id && (
              <div>
                <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Оферти</div>
                <div className="text-sm font-semibold text-amber-400">
                  {caseData.current_bidders || 0}/{caseData.max_bidders || 3}
                  {caseData.budget && (
                    <span className="text-xs text-slate-400 ml-1">
                      (~{estimatePointsCost(caseData.budget)} т.)
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {caseData.provider_id && caseData.provider_id !== user?.id && (
              <div>
                <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Изпълнител</div>
                <div className="flex items-center gap-2">
                  <Avatar name={caseData.provider_name || 'Изпълнител'} size="xs" />
                  <span className="text-sm font-semibold text-white truncate">
                    {caseData.provider_name || 'Друг'}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* Screenshots Section */}
          {caseData.screenshots && caseData.screenshots.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">
                📸 Снимки ({caseData.screenshots.length})
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {caseData.screenshots.map((screenshot, index) => (
                  <a
                    key={screenshot.id || index}
                    href={screenshot.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 group relative w-20 h-20 rounded-lg overflow-hidden border border-slate-600 hover:border-indigo-500 transition-all cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={screenshot.url}
                      alt={`Screenshot ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                        🔍
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
          
          {caseData.phone_masked && (
            <div className="mt-4 text-xs text-blue-300 bg-blue-500/10 px-3 py-2 rounded border border-blue-400/20">
              💡 Спечелете наддаването, за да получите достъп до телефонния номер
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
