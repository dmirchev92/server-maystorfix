'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

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
      pending: { label: 'Чакаща', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
      won: { label: 'Спечелена', color: 'bg-green-100 text-green-800', icon: '🎉' },
      lost: { label: 'Загубена', color: 'bg-red-100 text-red-800', icon: '❌' },
      refunded: { label: 'Възстановена', color: 'bg-gray-100 text-gray-800', icon: '↩️' },
    };
    
    const { label, color, icon } = config[status] || config.pending;
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${color}`}>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Зареждане...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Моите оферти</h1>
              <p className="mt-1 text-sm text-gray-500">
                Преглед на всички ваши оферти за заявки
              </p>
            </div>
            <button
              onClick={() => router.push('/provider/dashboard')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              ← Назад
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-3xl">📋</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Всички</dt>
                    <dd className="text-3xl font-semibold text-gray-900">{stats.total}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-3xl">⏳</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Чакащи</dt>
                    <dd className="text-3xl font-semibold text-yellow-600">{stats.pending}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-3xl">🎉</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Спечелени</dt>
                    <dd className="text-3xl font-semibold text-green-600">{stats.won}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-3xl">❌</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Загубени</dt>
                    <dd className="text-3xl font-semibold text-red-600">{stats.lost}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mt-6 bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setFilter('all')}
                className={`${
                  filter === 'all'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Всички ({stats.total})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`${
                  filter === 'pending'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Чакащи ({stats.pending})
              </button>
              <button
                onClick={() => setFilter('won')}
                className={`${
                  filter === 'won'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Спечелени ({stats.won})
              </button>
              <button
                onClick={() => setFilter('lost')}
                className={`${
                  filter === 'lost'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Загубени ({stats.lost})
              </button>
            </nav>
          </div>

          {/* Bids List */}
          <div className="divide-y divide-gray-200">
            {filteredBids.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-6xl">📭</span>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Няма оферти</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filter === 'all' 
                    ? 'Все още не сте подали оферти за заявки'
                    : `Няма ${filter === 'pending' ? 'чакащи' : filter === 'won' ? 'спечелени' : 'загубени'} оферти`}
                </p>
              </div>
            ) : (
              filteredBids.map((bid) => (
                <div key={bid.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-indigo-600">
                          #{bid.bid_order}
                        </span>
                        {getStatusBadge(bid.bid_status)}
                      </div>
                      
                      <h3 className="mt-2 text-lg font-medium text-gray-900">
                        {bid.case_description || 'Заявка'}
                      </h3>
                      
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                        {bid.case_budget && (
                          <span className="flex items-center">
                            <span className="mr-1">💰</span>
                            Бюджет: <span className="ml-1 font-medium text-green-600">{bid.case_budget} BGN</span>
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
                          bid.bid_status === 'won' ? 'text-red-600' :
                          bid.bid_status === 'lost' ? 'text-yellow-600' :
                          'text-gray-600'
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
                        className="ml-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
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
