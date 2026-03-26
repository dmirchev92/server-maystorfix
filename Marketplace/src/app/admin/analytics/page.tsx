'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';

interface Overview {
  total_sps: number;
  total_customers: number;
  new_sps_this_week: number;
  new_customers_this_week: number;
  total_cases: number;
  completed_cases: number;
  open_cases: number;
  cases_this_week: number;
  cases_this_month: number;
  total_bids: number;
  winning_bids: number;
  bids_this_week: number;
  total_points_in_circulation: number;
  total_points_spent: number;
  points_spent_this_week: number;
  free_tier_sps: number;
  normal_tier_sps: number;
  pro_tier_sps: number;
}

interface SPPerformance {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  tier: string;
  created_at: string;
  points_balance: number;
  points_total_spent: number;
  business_name: string;
  city: string;
  rating: number;
  total_reviews: number;
  service_category: string;
  cases_completed: number;
  cases_this_week: number;
  cases_this_month: number;
  total_bids: number;
  winning_bids: number;
  points_spent: number;
  points_spent_this_week: number;
}

interface BudgetDistribution {
  budget_range: string;
  case_count: number;
  completed_count: number;
  open_count: number;
}

interface PointsEconomy {
  overview: {
    total_balance: number;
    total_earned: number;
    total_spent: number;
    earned_this_week: number;
    spent_this_week: number;
    earned_this_month: number;
    spent_this_month: number;
    transactions_this_week: number;
    transactions_this_month: number;
  };
  spendingByCategory: Array<{
    category: string;
    transaction_count: number;
    total_points: number;
  }>;
}

interface SMSStats {
  overview: {
    total_sms_sent: number;
    unique_senders: number;
    total_points_spent_on_sms: number;
    sms_this_week: number;
    sms_this_month: number;
  };
  dailyStats: Array<{ date: string; count: number }>;
  topSenders: Array<{
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    business_name: string;
    sms_count: number;
    points_spent: number;
  }>;
}

interface UserSMSStats {
  stats: {
    total_sms_sent: number;
    total_points_spent: number;
    first_sms_at: string;
    last_sms_at: string;
    sms_this_week: number;
    sms_this_month: number;
  };
  recentTransactions: Array<any>;
  dailyStats: Array<{ date: string; count: number }>;
}

interface RevenueStats {
  tierDistribution: Array<{ tier: string; count: number }>;
  pointsPurchases: {
    totalPurchases: number;
    totalPointsPurchased: number;
    totalRevenue: number;
    recentPurchases: Array<any>;
  };
  subscriptionRevenue: {
    byTier: Array<any>;
    total: number;
    thisWeek: number;
    thisMonth: number;
    monthly: Array<{ month: string; revenue: number; transactions: number }>;
  };
  tierPrices: Array<{ id: string; name: string; price_monthly: string; price_yearly: string }>;
  totalRevenue: number;
}

type TabType = 'overview' | 'sps' | 'cases' | 'points' | 'sms' | 'revenue';

export default function AdminAnalyticsPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [overview, setOverview] = useState<Overview | null>(null);
  const [spPerformance, setSPPerformance] = useState<SPPerformance[]>([]);
  const [budgetDistribution, setBudgetDistribution] = useState<BudgetDistribution[]>([]);
  const [pointsEconomy, setPointsEconomy] = useState<PointsEconomy | null>(null);
  
  // SP detail modal
  const [selectedSP, setSelectedSP] = useState<string | null>(null);
  const [spDetails, setSPDetails] = useState<any>(null);
  
  // Points adjustment
  const [adjustingPoints, setAdjustingPoints] = useState<string | null>(null);
  const [pointsAmount, setPointsAmount] = useState('');
  const [pointsReason, setPointsReason] = useState('');
  
  // SMS stats
  const [smsStats, setSMSStats] = useState<SMSStats | null>(null);
  const [selectedUserSMS, setSelectedUserSMS] = useState<string | null>(null);
  const [userSMSStats, setUserSMSStats] = useState<UserSMSStats | null>(null);
  
  // Revenue stats
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://snapfix.bg/api/v1';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        setError('No authentication token');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Fetch all data in parallel
      const [overviewRes, spRes, budgetRes, pointsRes, smsRes, revenueRes] = await Promise.all([
        fetch(`${API_BASE}/admin/analytics/overview`, { headers }),
        fetch(`${API_BASE}/admin/analytics/sp-performance?limit=100`, { headers }),
        fetch(`${API_BASE}/admin/analytics/budget-distribution`, { headers }),
        fetch(`${API_BASE}/admin/analytics/points-economy`, { headers }),
        fetch(`${API_BASE}/admin/analytics/sms`, { headers }),
        fetch(`${API_BASE}/admin/analytics/revenue`, { headers }),
      ]);

      const [overviewData, spData, budgetData, pointsData, smsData, revenueData] = await Promise.all([
        overviewRes.json(),
        spRes.json(),
        budgetRes.json(),
        pointsRes.json(),
        smsRes.json(),
        revenueRes.json(),
      ]);

      if (overviewData.success) setOverview(overviewData.data);
      if (spData.success) setSPPerformance(spData.data.providers || []);
      if (budgetData.success) setBudgetDistribution(budgetData.data || []);
      if (pointsData.success) setPointsEconomy(pointsData.data);
      if (smsData.success) setSMSStats(smsData.data);
      if (revenueData.success) setRevenueStats(revenueData.data);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    if (isLoading) return;
    
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (user?.role !== 'admin') {
      router.push('/');
      return;
    }

    fetchData();
  }, [isAuthenticated, user, isLoading, router, fetchData]);

  const fetchSPDetails = async (spId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE}/admin/analytics/sp/${spId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSPDetails(data.data);
        setSelectedSP(spId);
      }
    } catch (err) {
      console.error('Failed to fetch SP details', err);
    }
  };

  const handleAdjustPoints = async () => {
    if (!adjustingPoints || !pointsAmount || !pointsReason) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE}/admin/users/${adjustingPoints}/adjust-points`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          points: parseInt(pointsAmount),
          reason: pointsReason
        })
      });
      
      const data = await res.json();
      if (data.success) {
        alert(`Points adjusted! New balance: ${data.data.newBalance}`);
        setAdjustingPoints(null);
        setPointsAmount('');
        setPointsReason('');
        fetchData();
      } else {
        alert(`Error: ${data.error?.message}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const fetchUserSMSStats = async (userId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE}/admin/analytics/sms/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUserSMSStats(data.data);
        setSelectedUserSMS(userId);
      }
    } catch (err) {
      console.error('Failed to fetch user SMS stats', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-slate-400">Admin privileges required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Header />
      
      {/* Page Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">📊 Admin Analytics</h1>
              <p className="text-slate-400">Platform statistics and SP performance</p>
            </div>
            <button
              onClick={fetchData}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex space-x-2 bg-slate-800 p-1 rounded-lg w-fit">
          {[
            { id: 'overview', label: '📈 Overview', icon: '📈' },
            { id: 'sps', label: '👷 SPs', icon: '👷' },
            { id: 'cases', label: '📋 Cases', icon: '📋' },
            { id: 'points', label: '💰 Points', icon: '💰' },
            { id: 'sms', label: '📱 SMS', icon: '📱' },
            { id: 'revenue', label: '💵 Revenue', icon: '💵' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && overview && (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Total SPs" value={overview.total_sps} icon="👷" color="blue" />
                  <StatCard title="Total Customers" value={overview.total_customers} icon="👤" color="green" />
                  <StatCard title="Total Cases" value={overview.total_cases} icon="📋" color="purple" />
                  <StatCard title="Completed Cases" value={overview.completed_cases} icon="✅" color="emerald" />
                </div>

                {/* This Week */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">📅 This Week</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MiniStat label="New SPs" value={overview.new_sps_this_week} />
                    <MiniStat label="New Customers" value={overview.new_customers_this_week} />
                    <MiniStat label="New Cases" value={overview.cases_this_week} />
                    <MiniStat label="Bids Placed" value={overview.bids_this_week} />
                  </div>
                </div>

                {/* Subscription Tiers */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">📊 SP Subscription Distribution</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-slate-300">{overview.free_tier_sps}</div>
                      <div className="text-slate-400">Free Tier</div>
                    </div>
                    <div className="bg-blue-900/30 rounded-lg p-4 text-center border border-blue-500/30">
                      <div className="text-3xl font-bold text-blue-400">{overview.normal_tier_sps}</div>
                      <div className="text-blue-300">Normal Tier</div>
                    </div>
                    <div className="bg-purple-900/30 rounded-lg p-4 text-center border border-purple-500/30">
                      <div className="text-3xl font-bold text-purple-400">{overview.pro_tier_sps}</div>
                      <div className="text-purple-300">Pro Tier</div>
                    </div>
                  </div>
                </div>

                {/* Points Economy Summary */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">💰 Points Economy</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <MiniStat label="Points in Circulation" value={overview.total_points_in_circulation} />
                    <MiniStat label="Total Points Spent" value={overview.total_points_spent} />
                    <MiniStat label="Points Spent This Week" value={overview.points_spent_this_week} />
                  </div>
                </div>
              </div>
            )}

            {/* SPs Tab */}
            {activeTab === 'sps' && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                  <h3 className="text-lg font-semibold text-white">👷 Service Provider Performance</h3>
                  <p className="text-slate-400 text-sm">Click on a row to see details</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">SP</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Tier</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase">Cases (Week)</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase">Cases (Total)</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase">Win Rate</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase">Points Spent</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase">Balance</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase">Rating</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {spPerformance.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                            No service providers found
                          </td>
                        </tr>
                      ) : (
                        spPerformance.map((sp) => (
                          <tr 
                            key={sp.id} 
                            className="hover:bg-slate-700/50 cursor-pointer"
                            onClick={() => fetchSPDetails(sp.id)}
                          >
                            <td className="px-4 py-3">
                              <div className="text-white font-medium">{sp.business_name || `${sp.first_name} ${sp.last_name}`}</div>
                              <div className="text-slate-400 text-xs">{sp.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                sp.tier === 'pro' ? 'bg-purple-900/50 text-purple-300' :
                                sp.tier === 'normal' ? 'bg-blue-900/50 text-blue-300' :
                                'bg-slate-700 text-slate-300'
                              }`}>
                                {sp.tier?.toUpperCase() || 'FREE'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-white">{sp.cases_this_week}</td>
                            <td className="px-4 py-3 text-center text-white">{sp.cases_completed}</td>
                            <td className="px-4 py-3 text-center text-white">
                              {sp.total_bids > 0 ? `${Math.round((sp.winning_bids / sp.total_bids) * 100)}%` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center text-orange-400">{sp.points_spent}</td>
                            <td className="px-4 py-3 text-center text-green-400">{sp.points_balance}</td>
                            <td className="px-4 py-3 text-center text-yellow-400">
                              {sp.rating ? `⭐ ${Number(sp.rating).toFixed(1)}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAdjustingPoints(sp.id);
                                }}
                                className="text-indigo-400 hover:text-indigo-300 text-sm"
                              >
                                ±Points
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cases Tab */}
            {activeTab === 'cases' && (
              <div className="space-y-6">
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">📊 Cases by Budget Range</h3>
                  <div className="space-y-3">
                    {budgetDistribution.length === 0 ? (
                      <p className="text-slate-400 text-center py-4">No case data available</p>
                    ) : (
                      budgetDistribution.map((item) => {
                        const total = parseInt(String(item.case_count)) || 0;
                        const completed = parseInt(String(item.completed_count)) || 0;
                        const completionRate = total > 0 ? (completed / total) * 100 : 0;
                        
                        return (
                          <div key={item.budget_range} className="bg-slate-700/50 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-white font-medium">{item.budget_range} €</span>
                              <span className="text-slate-300">{total} cases</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex-1 bg-slate-600 rounded-full h-2">
                                <div 
                                  className="bg-green-500 h-2 rounded-full" 
                                  style={{ width: `${completionRate}%` }}
                                />
                              </div>
                              <span className="text-green-400 text-sm w-20 text-right">
                                {completed} completed
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Points Tab */}
            {activeTab === 'points' && pointsEconomy && (
              <div className="space-y-6">
                {/* Points Overview */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard 
                    title="Total Balance" 
                    value={pointsEconomy.overview.total_balance} 
                    icon="💰" 
                    color="green" 
                  />
                  <StatCard 
                    title="Total Earned" 
                    value={pointsEconomy.overview.total_earned} 
                    icon="📈" 
                    color="blue" 
                  />
                  <StatCard 
                    title="Total Spent" 
                    value={pointsEconomy.overview.total_spent} 
                    icon="📉" 
                    color="orange" 
                  />
                </div>

                {/* This Week/Month */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4">📅 This Week</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Earned</span>
                        <span className="text-green-400">+{pointsEconomy.overview.earned_this_week}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Spent</span>
                        <span className="text-orange-400">-{pointsEconomy.overview.spent_this_week}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Transactions</span>
                        <span className="text-white">{pointsEconomy.overview.transactions_this_week}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4">📆 This Month</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Earned</span>
                        <span className="text-green-400">+{pointsEconomy.overview.earned_this_month}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Spent</span>
                        <span className="text-orange-400">-{pointsEconomy.overview.spent_this_month}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Transactions</span>
                        <span className="text-white">{pointsEconomy.overview.transactions_this_month}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Spending by Category */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">📊 Spending by Category</h3>
                  <div className="space-y-3">
                    {pointsEconomy.spendingByCategory.map((cat) => (
                      <div key={cat.category} className="flex justify-between items-center bg-slate-700/50 rounded-lg p-3">
                        <span className="text-white">{cat.category}</span>
                        <div className="text-right">
                          <div className="text-orange-400 font-medium">{cat.total_points} pts</div>
                          <div className="text-slate-400 text-xs">{cat.transaction_count} transactions</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SMS Tab */}
            {activeTab === 'sms' && smsStats && (
              <div className="space-y-6">
                {/* SMS Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard 
                    title="Total SMS Sent" 
                    value={parseInt(String(smsStats.overview.total_sms_sent))} 
                    icon="📱" 
                    color="blue" 
                  />
                  <StatCard 
                    title="This Week" 
                    value={smsStats.overview.sms_this_week} 
                    icon="📅" 
                    color="green" 
                  />
                  <StatCard 
                    title="This Month" 
                    value={smsStats.overview.sms_this_month} 
                    icon="📆" 
                    color="purple" 
                  />
                  <StatCard 
                    title="Unique Senders" 
                    value={parseInt(String(smsStats.overview.unique_senders))} 
                    icon="👥" 
                    color="orange" 
                  />
                </div>

                {/* Points spent on SMS */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-2">💰 Points Spent on SMS</h3>
                  <p className="text-3xl font-bold text-orange-400">{smsStats.overview.total_points_spent_on_sms} pts</p>
                </div>

                {/* Top SMS Senders */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white">📊 Top SMS Senders</h3>
                    <p className="text-slate-400 text-sm">Click on a row to see detailed SMS history</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-700/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">User</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase">SMS Count</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase">Points Spent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {smsStats.topSenders.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                              No SMS data available
                            </td>
                          </tr>
                        ) : (
                          smsStats.topSenders.map((sender) => (
                            <tr 
                              key={sender.user_id} 
                              className="hover:bg-slate-700/50 cursor-pointer"
                              onClick={() => fetchUserSMSStats(sender.user_id)}
                            >
                              <td className="px-4 py-3">
                                <div className="text-white font-medium">{sender.business_name || `${sender.first_name} ${sender.last_name}`}</div>
                                <div className="text-slate-400 text-xs">{sender.email}</div>
                              </td>
                              <td className="px-4 py-3 text-center text-blue-400 font-medium">{sender.sms_count}</td>
                              <td className="px-4 py-3 text-center text-orange-400">{sender.points_spent} pts</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Daily SMS Chart (simple text version) */}
                {smsStats.dailyStats.length > 0 && (
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4">📈 Daily SMS (Last 30 Days)</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {smsStats.dailyStats.map((day) => (
                        <div key={day.date} className="flex justify-between items-center bg-slate-700/50 rounded p-2">
                          <span className="text-slate-300">{new Date(day.date).toLocaleDateString('bg-BG')}</span>
                          <span className="text-blue-400 font-medium">{day.count} SMS</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Revenue Tab */}
            {activeTab === 'revenue' && revenueStats && (
              <div className="space-y-6">
                {/* Total Revenue */}
                <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 rounded-xl p-6 border border-green-500/30">
                  <h3 className="text-lg font-semibold text-green-300 mb-2">💵 Total Revenue</h3>
                  <p className="text-4xl font-bold text-white">{revenueStats.totalRevenue.toFixed(2)} лв</p>
                  <div className="flex gap-6 mt-4 text-sm">
                    <div>
                      <span className="text-slate-400">Subscriptions:</span>
                      <span className="text-green-400 ml-2">{revenueStats.subscriptionRevenue.total.toFixed(2)} лв</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Points Packages:</span>
                      <span className="text-blue-400 ml-2">{revenueStats.pointsPurchases.totalRevenue.toFixed(2)} лв</span>
                    </div>
                  </div>
                </div>

                {/* Revenue This Week/Month */}
                <div className="grid grid-cols-2 gap-4">
                  <StatCard 
                    title="Revenue This Week" 
                    value={revenueStats.subscriptionRevenue.thisWeek} 
                    icon="📅" 
                    color="green" 
                  />
                  <StatCard 
                    title="Revenue This Month" 
                    value={revenueStats.subscriptionRevenue.thisMonth} 
                    icon="📆" 
                    color="emerald" 
                  />
                </div>

                {/* User Tier Distribution */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">👥 User Tier Distribution</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {revenueStats.tierDistribution.length === 0 ? (
                      <>
                        <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                          <div className="text-3xl font-bold text-purple-400">0</div>
                          <div className="text-slate-400">Pro</div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                          <div className="text-3xl font-bold text-blue-400">0</div>
                          <div className="text-slate-400">Normal</div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                          <div className="text-3xl font-bold text-slate-300">0</div>
                          <div className="text-slate-400">Free</div>
                        </div>
                      </>
                    ) : (
                      revenueStats.tierDistribution.map((tier) => (
                        <div 
                          key={tier.tier} 
                          className={`rounded-lg p-4 text-center ${
                            tier.tier === 'pro' ? 'bg-purple-900/30 border border-purple-500/30' :
                            tier.tier === 'normal' ? 'bg-blue-900/30 border border-blue-500/30' :
                            'bg-slate-700/50'
                          }`}
                        >
                          <div className={`text-3xl font-bold ${
                            tier.tier === 'pro' ? 'text-purple-400' :
                            tier.tier === 'normal' ? 'text-blue-400' :
                            'text-slate-300'
                          }`}>
                            {tier.count}
                          </div>
                          <div className="text-slate-400 capitalize">{tier.tier || 'Free'}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Subscription Prices Reference */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">💳 Subscription Prices</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {revenueStats.tierPrices.map((tier) => (
                      <div key={tier.id} className="bg-slate-700/50 rounded-lg p-4">
                        <div className="text-white font-medium mb-2">{tier.name}</div>
                        <div className="text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Monthly:</span>
                            <span className="text-green-400">{tier.price_monthly} лв</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Yearly:</span>
                            <span className="text-green-400">{tier.price_yearly} лв</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Points Packages Purchased */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">📦 Points Packages Purchased</h3>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-blue-900/30 rounded-lg p-4 text-center border border-blue-500/30">
                      <div className="text-2xl font-bold text-blue-400">{revenueStats.pointsPurchases.totalPurchases}</div>
                      <div className="text-slate-400 text-sm">Total Purchases</div>
                    </div>
                    <div className="bg-purple-900/30 rounded-lg p-4 text-center border border-purple-500/30">
                      <div className="text-2xl font-bold text-purple-400">{revenueStats.pointsPurchases.totalPointsPurchased}</div>
                      <div className="text-slate-400 text-sm">Points Purchased</div>
                    </div>
                    <div className="bg-green-900/30 rounded-lg p-4 text-center border border-green-500/30">
                      <div className="text-2xl font-bold text-green-400">{revenueStats.pointsPurchases.totalRevenue.toFixed(2)} лв</div>
                      <div className="text-slate-400 text-sm">Revenue</div>
                    </div>
                  </div>
                  
                  {revenueStats.pointsPurchases.recentPurchases.length > 0 && (
                    <div>
                      <h4 className="text-white font-medium mb-2">Recent Purchases</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {revenueStats.pointsPurchases.recentPurchases.map((purchase: any, idx: number) => (
                          <div key={idx} className="bg-slate-700/50 rounded p-2 text-sm flex justify-between">
                            <span className="text-slate-300">{purchase.reason}</span>
                            <span className="text-green-400">{purchase.price} {purchase.currency}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Monthly Revenue Breakdown */}
                {revenueStats.subscriptionRevenue.monthly.length > 0 && (
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4">📊 Monthly Revenue (Last 6 Months)</h3>
                    <div className="space-y-2">
                      {revenueStats.subscriptionRevenue.monthly.map((month) => (
                        <div key={month.month} className="flex justify-between items-center bg-slate-700/50 rounded p-3">
                          <span className="text-slate-300">{new Date(month.month).toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })}</span>
                          <div className="text-right">
                            <span className="text-green-400 font-medium">{parseFloat(String(month.revenue)).toFixed(2)} лв</span>
                            <span className="text-slate-400 text-xs ml-2">({month.transactions} transactions)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* User SMS Details Modal */}
      {selectedUserSMS && userSMSStats && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">📱 SMS Details</h3>
              <button onClick={() => setSelectedUserSMS(null)} className="text-slate-400 hover:text-white text-2xl">
                ×
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{userSMSStats.stats.total_sms_sent}</div>
                  <div className="text-slate-400 text-sm">Total SMS</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-orange-400">{userSMSStats.stats.total_points_spent}</div>
                  <div className="text-slate-400 text-sm">Points Spent</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{userSMSStats.stats.sms_this_week}</div>
                  <div className="text-slate-400 text-sm">This Week</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{userSMSStats.stats.sms_this_month}</div>
                  <div className="text-slate-400 text-sm">This Month</div>
                </div>
              </div>

              {/* First/Last SMS */}
              {userSMSStats.stats.first_sms_at && (
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">First SMS:</span>
                    <span className="text-white">{new Date(userSMSStats.stats.first_sms_at).toLocaleString('bg-BG')}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-slate-400">Last SMS:</span>
                    <span className="text-white">{new Date(userSMSStats.stats.last_sms_at).toLocaleString('bg-BG')}</span>
                  </div>
                </div>
              )}

              {/* Recent Transactions */}
              {userSMSStats.recentTransactions.length > 0 && (
                <div>
                  <h4 className="text-white font-medium mb-3">Recent SMS Transactions</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {userSMSStats.recentTransactions.map((tx: any) => (
                      <div key={tx.id} className="bg-slate-700/50 rounded p-2 text-sm flex justify-between">
                        <span className="text-slate-300">{new Date(tx.created_at).toLocaleString('bg-BG')}</span>
                        <span className="text-orange-400">-{Math.abs(tx.points_amount)} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SP Details Modal */}
      {selectedSP && spDetails && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">
                {spDetails.profile?.business_name || `${spDetails.profile?.first_name} ${spDetails.profile?.last_name}`}
              </h3>
              <button onClick={() => setSelectedSP(null)} className="text-slate-400 hover:text-white text-2xl">
                ×
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Profile Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 text-sm">Email</span>
                  <p className="text-white">{spDetails.profile?.email}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-sm">Tier</span>
                  <p className="text-white">{spDetails.profile?.subscription_tier_id?.toUpperCase()}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-sm">City</span>
                  <p className="text-white">{spDetails.profile?.city || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-sm">Rating</span>
                  <p className="text-yellow-400">⭐ {Number(spDetails.profile?.rating || 0).toFixed(1)}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-sm">Points Balance</span>
                  <p className="text-green-400">{spDetails.profile?.points_balance}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-sm">Total Spent</span>
                  <p className="text-orange-400">{spDetails.profile?.points_total_spent}</p>
                </div>
              </div>

              {/* Cases by Budget */}
              {spDetails.casesByBudget?.length > 0 && (
                <div>
                  <h4 className="text-white font-medium mb-3">Cases by Budget Range</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {spDetails.casesByBudget.map((item: any) => (
                      <div key={item.budget_range} className="bg-slate-700/50 rounded p-2 text-sm">
                        <span className="text-slate-300">{item.budget_range}:</span>
                        <span className="text-white ml-2">{item.count} ({item.completed} completed)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Transactions */}
              {spDetails.recentTransactions?.length > 0 && (
                <div>
                  <h4 className="text-white font-medium mb-3">Recent Transactions</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {spDetails.recentTransactions.slice(0, 10).map((tx: any) => (
                      <div key={tx.id} className="bg-slate-700/50 rounded p-2 text-sm flex justify-between">
                        <span className="text-slate-300 truncate flex-1">{tx.reason}</span>
                        <span className={tx.transaction_type === 'earned' ? 'text-green-400' : 'text-orange-400'}>
                          {tx.transaction_type === 'earned' ? '+' : '-'}{Math.abs(tx.points_amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Points Adjustment Modal */}
      {adjustingPoints && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4">Adjust Points</h3>
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-sm">Points (+ to add, - to remove)</label>
                <input
                  type="number"
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white mt-1"
                  placeholder="e.g. 100 or -50"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">Reason</label>
                <input
                  type="text"
                  value={pointsReason}
                  onChange={(e) => setPointsReason(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white mt-1"
                  placeholder="e.g. Bonus for good performance"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setAdjustingPoints(null)}
                  className="flex-1 bg-slate-700 text-white py-2 rounded-lg hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustPoints}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-900/30 border-blue-500/30',
    green: 'bg-green-900/30 border-green-500/30',
    purple: 'bg-purple-900/30 border-purple-500/30',
    orange: 'bg-orange-900/30 border-orange-500/30',
    emerald: 'bg-emerald-900/30 border-emerald-500/30',
  };

  return (
    <div className={`rounded-xl p-6 border ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <div className="text-2xl font-bold text-white">{value?.toLocaleString() || 0}</div>
          <div className="text-slate-400 text-sm">{title}</div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white">{value?.toLocaleString() || 0}</div>
      <div className="text-slate-400 text-sm">{label}</div>
    </div>
  );
}
