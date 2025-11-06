'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Header } from '@/components/Header';

interface Bid {
  id: string;
  case_id: string;
  points_bid: number;
  bid_status: 'pending' | 'won' | 'lost' | 'refunded';
  bid_order: number;
  points_deducted: number;
  created_at: string;
  case_description?: string;
  case_budget?: number;
  case_city?: string;
  case_status?: string;
  customer_name?: string;
}

export default function MyBidsPage() {
  const router = useRouter();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all');

  useEffect(() => {
    fetchBids();
  }, []);

  const fetchBids = async () => {
    try {
      const response = await apiClient.getMyBids();
      
      if (response.data?.success) {
        setBids(response.data.data?.bids || []);
      }
    } catch (error) {
      console.error('Error fetching bids:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: any = {
      pending: { label: 'Чакаща', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30', icon: '⏳' },
      won: { label: 'Спечелена', color: 'bg-green-500/20 text-green-300 border-green-400/30', icon: '🎉' },
      lost: { label: 'Загубена', color: 'bg-red-500/20 text-red-300 border-red-400/30', icon: '❌' },
      refunded: { label: 'Възстановена', color: 'bg-slate-500/20 text-slate-300 border-slate-400/30', icon: '↩️' },
    };
    
    const { label, color, icon } = config[status] || config.pending;
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${color}`}>
        <span className="mr-1">{icon}</span>
        {label}
      </span>
    );
  };

  const filteredBids = bids.filter((bid) => {
    if (filter === 'all') return true;
    return bid.bid_status === filter;
  });

  const stats = {
    total: bids.length,
    pending: bids.filter(b => b.bid_status === 'pending').length,
    won: bids.filter(b => b.bid_status === 'won').length,
    lost: bids.filter(b => b.bid_status === 'lost').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mx-auto"></div>
          <p className="mt-4 text-slate-200">Зареждане...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />
      
      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span>💰</span>
              Моите оферти
            </h1>
            <p className="mt-2 text-slate-300">
              Преглед на всички ваши оферти за заявки
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center px-4 py-2 rounded-lg text-slate-200 bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-200 font-medium"
          >
            ← Назад
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-white/10 rounded-xl p-5 shadow-xl">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">📋</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-400 truncate">Всички</dt>
                  <dd className="text-3xl font-semibold text-white">{stats.total}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm border border-yellow-400/30 rounded-xl p-5 shadow-xl">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">⏳</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-yellow-200 truncate">Чакащи</dt>
                  <dd className="text-3xl font-semibold text-yellow-300">{stats.pending}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-green-400/30 rounded-xl p-5 shadow-xl">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">🎉</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-green-200 truncate">Спечелени</dt>
                  <dd className="text-3xl font-semibold text-green-300">{stats.won}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 backdrop-blur-sm border border-red-400/30 rounded-xl p-5 shadow-xl">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">❌</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-red-200 truncate">Загубени</dt>
                  <dd className="text-3xl font-semibold text-red-300">{stats.lost}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-white/10 rounded-xl shadow-xl">
          <div className="border-b border-white/10">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setFilter('all')}
                className={`${
                  filter === 'all'
                    ? 'border-green-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Всички ({stats.total})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`${
                  filter === 'pending'
                    ? 'border-yellow-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Чакащи ({stats.pending})
              </button>
              <button
                onClick={() => setFilter('won')}
                className={`${
                  filter === 'won'
                    ? 'border-green-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Спечелени ({stats.won})
              </button>
              <button
                onClick={() => setFilter('lost')}
                className={`${
                  filter === 'lost'
                    ? 'border-red-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Загубени ({stats.lost})
              </button>
            </nav>
          </div>

          {/* Bids List */}
          <div className="divide-y divide-white/10">
            {filteredBids.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-6xl">📭</span>
                <h3 className="mt-2 text-sm font-medium text-white">Няма оферти</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {filter === 'all' 
                    ? 'Все още не сте подали оферти за заявки'
                    : `Няма ${filter === 'pending' ? 'чакащи' : filter === 'won' ? 'спечелени' : 'загубени'} оферти`}
                </p>
              </div>
            ) : (
              filteredBids.map((bid) => (
                <div key={bid.id} className="p-6 hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-green-400">
                          #{bid.bid_order}
                        </span>
                        {getStatusBadge(bid.bid_status)}
                      </div>
                      
                      <h3 className="mt-2 text-lg font-medium text-white">
                        {bid.case_description || 'Заявка'}
                      </h3>
                      
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-400">
                        {bid.case_budget && (
                          <span className="flex items-center">
                            <span className="mr-1">💰</span>
                            Бюджет: <span className="ml-1 font-medium text-green-400">{bid.case_budget} BGN</span>
                          </span>
                        )}
                        {bid.case_city && (
                          <span className="flex items-center">
                            <span className="mr-1">📍</span>
                            {bid.case_city}
                          </span>
                        )}
                        <span className="flex items-center">
                          <span className="mr-1">📅</span>
                          {new Date(bid.created_at).toLocaleDateString('bg-BG')}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center space-x-4">
                        <span className={`text-sm font-medium ${
                          bid.bid_status === 'won' ? 'text-red-400' :
                          bid.bid_status === 'lost' ? 'text-yellow-400' :
                          'text-slate-300'
                        }`}>
                          💎 Точки: {
                            bid.bid_status === 'won' ? `-${bid.points_bid}` :
                            bid.bid_status === 'lost' ? `-${bid.points_deducted} (${Math.round((bid.points_bid - bid.points_deducted) / bid.points_bid * 100)}% възстановени)` :
                            `-${bid.points_bid} (резервирани)`
                          }
                        </span>
                      </div>
                    </div>

                    {bid.case_id && (
                      <button
                        onClick={() => router.push(`/dashboard/cases/${bid.case_id}`)}
                        className="ml-4 inline-flex items-center px-4 py-2 rounded-lg text-slate-200 bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-200 font-medium"
                      >
                        Виж заявка →
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
