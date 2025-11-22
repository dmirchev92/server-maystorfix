import React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Case, User } from '@/types/marketplace'
import { CaseCard } from './CaseCard'

interface CaseListProps {
  cases: Case[]
  loading: boolean
  user: User
  viewMode: string
  myBids: Map<string, any>
  biddingCases: Set<string>
  onStatusChange: (id: string, status: string) => void
  onPlaceBid: (id: string, budget: number) => void
  onUndecline: (id: string) => void
  onCreateCase: () => void
}

export const CaseList: React.FC<CaseListProps> = ({
  cases,
  loading,
  user,
  viewMode,
  myBids,
  biddingCases,
  onStatusChange,
  onPlaceBid,
  onUndecline,
  onCreateCase
}) => {
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>📋</span>
          Заявки за услуги
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white/60 mx-auto mb-4"></div>
            <p className="text-slate-300 font-medium">Зареждане на заявки...</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-slate-300 text-lg mb-4">Няма намерени заявки</p>
            <Button
              variant="construction"
              onClick={onCreateCase}
              leftIcon={<span>➕</span>}
            >
              Създай първата си заявка
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map((case_) => (
              <CaseCard
                key={case_.id}
                caseData={case_}
                user={user}
                viewMode={viewMode}
                hasBid={myBids.has(case_.id)}
                isBidding={biddingCases.has(case_.id)}
                onStatusChange={onStatusChange}
                onPlaceBid={onPlaceBid}
                onUndecline={onUndecline}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
