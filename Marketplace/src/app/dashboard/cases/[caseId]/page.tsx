'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import TrackingMap from '@/components/TrackingMap';
import { formatFullAddress } from '@/utils/addressUtils';
import { getCategoryLabel } from '@/constants/serviceCategories';

export default function CaseDetailsPage() {
  const { caseId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  
  const [caseData, setCaseData] = useState<any>(null);
  const [winningBid, setWinningBid] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && caseId) {
      fetchCaseDetails();
    }
  }, [caseId, isAuthenticated]);

  const fetchCaseDetails = async () => {
    try {
      setLoading(true);
      // Fetch Case
      const caseResponse = await apiClient.getCase(caseId as string);
      console.log('📋 Case Response:', caseResponse.data);
      if (caseResponse.data?.success) {
        const c = caseResponse.data.data;
        console.log('📸 Case Data Screenshots:', c.screenshots);
        setCaseData(c);

        // If there is a winning bid, fetch it to get agreed price
        if (c.winning_bid_id) {
          const bidsResponse = await apiClient.getCaseBids(c.id);
          if (bidsResponse.data?.success) {
            const bids = bidsResponse.data.data || [];
            const winner = bids.find((b: any) => b.id === c.winning_bid_id);
            if (winner) {
              setWinningBid(winner);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching case details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white">Зареждане...</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white">Заявката не е намерена.</div>
      </div>
    );
  }

  // Determine if we should show the map
  // Show map if status is 'accepted', 'wip' and we have coordinates
  const showMap = (caseData.status === 'accepted' || caseData.status === 'wip') && 
                  caseData.latitude && caseData.longitude;

  const agreedPrice = winningBid ? winningBid.proposed_budget_range : (caseData.provider_id ? 'По договаряне' : null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.back()}
              className="mb-4"
            >
              ← Назад
            </Button>
            <h1 className="text-3xl font-bold text-white mb-2">
              Детайли за заявка
            </h1>
            <p className="text-indigo-400 text-base font-semibold">
              Заявка #{caseData.case_number || caseData.id?.slice(-6).toUpperCase()}
            </p>
          </div>
          <StatusBadge status={caseData.status} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Tracking Map Section */}
            {showMap ? (
              <Card variant="elevated" className="overflow-hidden">
                <CardHeader>
                  <CardTitle>📍 Проследяване на изпълнител</CardTitle>
                </CardHeader>
                <div className="p-1">
                  <TrackingMap 
                    caseId={caseData.id}
                    customerLocation={{
                      lat: parseFloat(caseData.latitude),
                      lng: parseFloat(caseData.longitude),
                      address: formatFullAddress(caseData.city, caseData.formatted_address)
                    }}
                    customerBudget={caseData.budget}
                    agreedPrice={agreedPrice}
                    providerName={caseData.provider_name}
                  />
                </div>
              </Card>
            ) : (
               caseData.latitude && (
                <Card variant="elevated">
                  <CardHeader>
                    <CardTitle>📍 Местоположение</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-300">{formatFullAddress(caseData.city, caseData.formatted_address)}</p>
                    <p className="text-sm text-slate-500 mt-2">
                      Картата ще се активира, когато изпълнител приеме заявката.
                    </p>
                  </CardContent>
                </Card>
               )
            )}

            {/* Case Info */}
            <Card variant="elevated">
              <CardHeader>
                <CardTitle>📋 Информация</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Description */}
                <div className="pb-4 border-b border-slate-700">
                  <p className="text-sm text-slate-400 mb-1">Описание</p>
                  <p className="text-white">{caseData.description || 'Няма описание'}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Категория</p>
                    <p className="text-white font-medium">{getCategoryLabel(caseData.category || caseData.service_type)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Дата на изпълнение</p>
                    <p className="text-white font-medium">
                      {new Date(caseData.preferred_date).toLocaleDateString('bg-BG')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Статус</p>
                    <div className="mt-1"><StatusBadge status={caseData.status} /></div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Създадена на</p>
                    <p className="text-white font-medium">
                      {new Date(caseData.created_at).toLocaleDateString('bg-BG')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Screenshots Section */}
            {caseData.screenshots && caseData.screenshots.length > 0 && (
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>📸 Снимки ({caseData.screenshots.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {caseData.screenshots.map((screenshot: any, index: number) => (
                      <a
                        key={screenshot.id || index}
                        href={screenshot.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative aspect-square rounded-lg overflow-hidden border border-slate-600 hover:border-indigo-500 transition-all cursor-pointer"
                      >
                        <img
                          src={screenshot.url}
                          alt={`Screenshot ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium">
                            🔍 Виж пълен размер
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Financials */}
            <Card variant="elevated" className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle>💰 Финансови детайли</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-700">
                  <span className="text-slate-300">Вашият бюджет</span>
                  <span className="text-white font-bold">{caseData.budget ? `${caseData.budget} лв.` : '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Договорена цена</span>
                  <span className="text-green-400 font-bold text-xl">
                    {agreedPrice ? `${agreedPrice} лв.` : 'Очаква се'}
                  </span>
                </div>
                {winningBid && (
                   <div className="text-xs text-slate-500 mt-2">
                     * Базирано на приетата оферта от {caseData.provider_name}
                   </div>
                )}
              </CardContent>
            </Card>

            {/* Provider Info */}
            {caseData.provider_name && (
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>👤 Изпълнител</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold text-white">
                      {caseData.provider_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{caseData.provider_name}</h3>
                      <Badge variant="construction">Проверен</Badge>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button className="w-full" variant="outline">
                      💬 Свържи се
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
