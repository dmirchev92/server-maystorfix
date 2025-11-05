'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Header } from '@/components/Header'
import { PointsBalance } from '@/components/PointsBalance'

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const router = useRouter()
  const [incomeStats, setIncomeStats] = useState<any>(null)
  const [paymentDetailsModal, setPaymentDetailsModal] = useState<{ isOpen: boolean; method: string; transactions: any[] }>({ isOpen: false, method: '', transactions: [] })
  const [monthDetailsModal, setMonthDetailsModal] = useState<{ isOpen: boolean; month: string; transactions: any[] }>({ isOpen: false, month: '', transactions: [] })
  const [showDecemberWarning, setShowDecemberWarning] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [showAllMonths, setShowAllMonths] = useState(false)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login')
      return
    }
    
    // Check if user is a service provider - dashboard is only for SPs
    if (!isLoading && isAuthenticated && user && user.role !== 'service_provider' && user.role !== 'tradesperson') {
      console.log(' User is not a service provider, redirecting to home. Role:', user.role)
      router.push('/')
      return
    }
  }, [isAuthenticated, isLoading, user, router])

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchAvailableYears()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id])

  useEffect(() => {
    if (isAuthenticated && user && selectedYear) {
      fetchIncomeStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, selectedYear])

  const fetchAvailableYears = async () => {
    try {
      if (user?.role === 'tradesperson' || user?.role === 'service_provider') {
        const response = await apiClient.getIncomeYears(user.id)
        if (response.data?.success) {
          const years = response.data.data || []
          setAvailableYears(years)
          
          // Set selected year to current year if available, otherwise the latest year
          const currentYear = new Date().getFullYear()
          if (years.includes(currentYear)) {
            setSelectedYear(currentYear)
          } else if (years.length > 0) {
            setSelectedYear(years[years.length - 1]) // Latest year
          }
        }
      }
    } catch (error) {
      console.error('Error fetching available years:', error)
    }
  }

  const fetchIncomeStats = async () => {
    try {
      if (user?.role === 'tradesperson' || user?.role === 'service_provider') {
        // Calculate start and end dates for selected year
        const startDate = `${selectedYear}-01-01`
        const endDate = `${selectedYear}-12-31`
        
        const response = await apiClient.getIncomeStats(user.id, startDate, endDate)
        if (response.data?.success) {
          setIncomeStats(response.data.data)
          
          // Check if it's December and show warning
          const currentMonth = new Date().getMonth()
          if (currentMonth === 11) { // December is month 11 (0-indexed)
            setShowDecemberWarning(true)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching income stats:', error)
    }
  }

  const downloadIncomeReport = () => {
    if (!incomeStats) return

    // Create CSV content with BOM for proper UTF-8 encoding
    let csvContent = "data:text/csv;charset=utf-8,%EF%BB%BF"
    
    // Overall Summary
    csvContent += "=== ОБЩ ОТЧЕТ ЗА ПРИХОДИ ===\\n\\n"
    csvContent += `Общо приходи:,${incomeStats.summary?.totalIncome?.toFixed(2)} BGN\\n`
    csvContent += `Брой заявки:,${incomeStats.summary?.incomeCount}\\n`
    csvContent += `Средно на заявка:,${incomeStats.summary?.averageIncome?.toFixed(2)} BGN\\n\\n`
    
    // Monthly Breakdown with Details
    csvContent += "=== МЕСЕЧНА РАЗБИВКА ===\\n\\n"
    incomeStats.monthlyIncome?.forEach((month: any) => {
      const monthName = new Date(month.month + '-01').toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })
      csvContent += `--- ${monthName} ---\\n`
      csvContent += `Общо приходи:,${month.total?.toFixed(2)} BGN\\n`
      csvContent += `Брой заявки:,${month.count}\\n`
      csvContent += `Средно на заявка:,${month.average?.toFixed(2)} BGN\\n\\n`
    })
    
    // Summary Table
    csvContent += "=== ОБОБЩЕНА ТАБЛИЦА ===\\n"
    csvContent += "Месец,Общо приходи (BGN),Брой заявки,Средно (BGN)\\n"
    incomeStats.monthlyIncome?.forEach((month: any) => {
      const monthName = new Date(month.month + '-01').toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })
      csvContent += `${monthName},${month.total?.toFixed(2)},${month.count},${month.average?.toFixed(2)}\\n`
    })
    
    // Payment Methods
    csvContent += "\\n=== ПО МЕТОД НА ПЛАЩАНЕ ===\\n"
    csvContent += "Метод,Общо приходи (BGN),Брой заявки,Средно (BGN)\\n"
    incomeStats.paymentMethods?.forEach((pm: any) => {
      const avgPerMethod = pm.count > 0 ? (pm.total / pm.count).toFixed(2) : '0.00'
      csvContent += `${pm.method},${pm.total?.toFixed(2)},${pm.count},${avgPerMethod}\\n`
    })

    // Create download link
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `income_report_${selectedYear}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePaymentMethodClick = async (paymentMethod: string) => {
    try {
      const response = await apiClient.getIncomeTransactionsByMethod(user!.id, paymentMethod)
      if (response.data?.success) {
        setPaymentDetailsModal({
          isOpen: true,
          method: paymentMethod,
          transactions: response.data.data || []
        })
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
      alert('Възникна грешка при зареждането на транзакциите')
    }
  }

  const handleMonthClick = async (month: string) => {
    try {
      const response = await apiClient.getIncomeTransactionsByMonth(user!.id, month)
      if (response.data?.success) {
        setMonthDetailsModal({
          isOpen: true,
          month: month,
          transactions: response.data.data || []
        })
      }
    } catch (error) {
      console.error('Error fetching month transactions:', error)
      alert('Възникна грешка при зареждането на транзакциите')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white/30 mx-auto"></div>
          <p className="mt-4 text-slate-200">Табло????...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      <Header />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header with Navigation */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">
            Табло
          </h1>
          
          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b border-slate-700">
            <Link
              href="/dashboard"
              className="px-6 py-3 font-medium text-white border-b-2 border-green-500 bg-slate-800/50"
            >
               📊 Преглед
            </Link>
            <Link
              href="/dashboard/cases"
              className="px-6 py-3 font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            >
               📋 Заявки
            </Link>
            <Link
              href="/provider/my-bids"
              className="px-6 py-3 font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            >
              💰 Моите оферти
            </Link>
          </div>
        </div>

        {/* Points Balance Card */}
        <div className="mb-6">
          <PointsBalance />
        </div>

        {/* Income Statistics Card - Moved to Top */}
        {incomeStats && (
          <Card className="mb-6 bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border-2 border-green-500/30 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <span className="text-2xl">💰</span>
                  <span>Приходи</span>
                </CardTitle>
                <button
                  onClick={downloadIncomeReport}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <span>📥</span>
                  <span>Изтегли отчет</span>
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {/* December Warning Banner */}
              {showDecemberWarning && (
                <div className="mb-6 bg-gradient-to-r from-orange-500/20 to-red-500/20 border-2 border-orange-400/50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div className="flex-1">
                      <h4 className="text-orange-300 font-bold mb-1">Внимание: Край на годината</h4>
                      <p className="text-slate-300 text-sm mb-3">
                        Всички данни за приходите ще бъдат изтрити на 1 януари. Моля изтеглете вашия годишен отчет преди края на декември.
                      </p>
                      <button
                        onClick={downloadIncomeReport}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        📥 Изтегли годишен отчет сега
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Selected Month - FIRST */}
                {incomeStats.monthlyIncome && incomeStats.monthlyIncome.length > 0 && (
                  <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-4 rounded-lg border border-purple-400/30">
                    <div className="text-sm text-slate-300 mb-2">Избран месец</div>
                    <select
                      value={selectedMonth || incomeStats.monthlyIncome[0]?.month}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full mb-3 px-2 py-1 bg-slate-700 text-slate-200 rounded border border-purple-400/30 text-xs focus:outline-none focus:border-purple-400"
                    >
                      {incomeStats.monthlyIncome.map((m: any) => (
                        <option key={m.month} value={m.month}>
                          {new Date(m.month + '-01').toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const currentMonth = incomeStats.monthlyIncome.find((m: any) => m.month === (selectedMonth || incomeStats.monthlyIncome[0]?.month))
                      return (
                        <>
                          <div className="text-2xl font-bold text-purple-400">
                            {currentMonth?.total?.toFixed(2) || '0.00'} {incomeStats.summary?.currency || 'BGN'}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {currentMonth?.count || 0} заявки • Средно: {currentMonth?.average?.toFixed(2) || '0.00'} BGN
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )}

                {/* Total Income - SECOND */}
                <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 p-4 rounded-lg border border-green-400/30">
                  <div className="text-sm text-slate-300 mb-2">Общо приходи</div>
                  {availableYears.length > 0 && (
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="w-full mb-3 px-2 py-1 bg-slate-700 text-slate-200 rounded border border-green-400/30 text-xs focus:outline-none focus:border-green-400"
                    >
                      {availableYears.map((year) => (
                        <option key={year} value={year}>
                          {year} г.
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="text-2xl font-bold text-green-400">
                    {incomeStats.summary?.totalIncome?.toFixed(2) || '0.00'} {incomeStats.summary?.currency || 'BGN'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {incomeStats.summary?.incomeCount || 0} заявки • Средно: {incomeStats.summary?.averageIncome?.toFixed(2) || '0.00'} BGN
                  </div>
                </div>
              </div>

              {/* Monthly Breakdown */}
              {incomeStats.monthlyIncome && incomeStats.monthlyIncome.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-slate-300">Месечна разбивка</h4>
                    {incomeStats.monthlyIncome.length > 1 && (
                      <select
                        value={showAllMonths ? 'all' : 'current'}
                        onChange={(e) => setShowAllMonths(e.target.value === 'all')}
                        className="px-3 py-1 bg-slate-700 text-slate-200 rounded border border-slate-600 text-xs focus:outline-none focus:border-green-500"
                      >
                        <option value="current">Текущ месец</option>
                        <option value="all">Всички месеци ({incomeStats.monthlyIncome.length})</option>
                      </select>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {(showAllMonths ? incomeStats.monthlyIncome.slice(0, 12) : incomeStats.monthlyIncome.slice(0, 1)).map((month: any) => (
                      <button
                        key={month.month}
                        onClick={() => handleMonthClick(month.month)}
                        className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-700/50 hover:border-green-500/50 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-slate-300 group-hover:text-green-300 transition-colors">
                            {new Date(month.month + '-01').toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })}
                          </span>
                          <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                            {month.count} заявки
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-green-400 group-hover:text-green-300 transition-colors">
                            {month.total?.toFixed(2)} BGN
                          </span>
                          <span className="text-xs text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            👆
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              {incomeStats.paymentMethods && incomeStats.paymentMethods.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-3">По метод на плащане (кликнете за детайли)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(() => {
                      // Payment method display names
                      const methodNames: { [key: string]: string } = {
                        'cash': '💵 Кеш',
                        'card': '💳 Картово плащане',
                        'bank_transfer': '🏦 Банков път',
                        'online': '🌐 Revolut',
                        'other': '📝 Друго'
                      }
                      
                      // Sort by total amount (highest first)
                      const sortedMethods = [...incomeStats.paymentMethods].sort((a, b) => b.total - a.total)
                      
                      return sortedMethods.map((pm: any) => (
                        <button
                          key={pm.method}
                          onClick={() => handlePaymentMethodClick(pm.method)}
                          className="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-center border border-slate-700/50 hover:border-green-500/50 transition-all cursor-pointer group"
                        >
                          <div className="text-xs text-slate-400 group-hover:text-green-400 mb-1 transition-colors">
                            {methodNames[pm.method] || pm.method}
                          </div>
                          <div className="text-sm font-bold text-slate-200 group-hover:text-green-300 transition-colors">{pm.total?.toFixed(2)} BGN</div>
                          <div className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">{pm.count} заявки</div>
                          <div className="text-xs text-green-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                            👆 Виж детайли
                          </div>
                        </button>
                      ))
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>

      {/* Payment Details Modal */}
      {paymentDetailsModal.isOpen && (
        <PaymentDetailsModal
          method={paymentDetailsModal.method}
          transactions={paymentDetailsModal.transactions}
          onClose={() => setPaymentDetailsModal({ isOpen: false, method: '', transactions: [] })}
          onTransactionUpdated={() => {
            fetchIncomeStats()
            setPaymentDetailsModal({ isOpen: false, method: '', transactions: [] })
          }}
        />
      )}

      {/* Month Details Modal */}
      {monthDetailsModal.isOpen && (
        <MonthDetailsModal
          month={monthDetailsModal.month}
          transactions={monthDetailsModal.transactions}
          onClose={() => setMonthDetailsModal({ isOpen: false, month: '', transactions: [] })}
          onTransactionUpdated={() => {
            fetchIncomeStats()
            setMonthDetailsModal({ isOpen: false, month: '', transactions: [] })
          }}
        />
      )}
    </div>
  )
}
// Payment Details Modal Component
function PaymentDetailsModal({ method, transactions, onClose, onTransactionUpdated }: {
  method: string
  transactions: any[]
  onClose: () => void
  onTransactionUpdated: () => void
}) {
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [editForm, setEditForm] = useState({ amount: '', paymentMethod: '', notes: '' })

  const handleEditClick = (transaction: any) => {
    setEditingTransaction(transaction)
    setEditForm({
      amount: transaction.amount.toString(),
      paymentMethod: transaction.payment_method || '',
      notes: transaction.notes || ''
    })
  }

  const handleSaveEdit = async () => {
    try {
      await apiClient.updateIncomeTransaction(editingTransaction.id, {
        amount: parseFloat(editForm.amount),
        paymentMethod: editForm.paymentMethod,
        notes: editForm.notes
      })
      alert('Транзакцията беше обновена успешно!')
      setEditingTransaction(null)
      onTransactionUpdated()
    } catch (error) {
      console.error('Error updating transaction:', error)
      alert('Възникна грешка при обновяването')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-lg sticky top-0">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">💳 Транзакции: {method}</h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl"
            >
              ✕
            </button>
          </div>
          <p className="text-green-100 mt-1">{transactions.length} транзакции</p>
        </div>

        {/* Transactions List */}
        <div className="p-6 space-y-4">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="bg-slate-700/50 border border-slate-600 rounded-lg p-4"
            >
              {editingTransaction?.id === transaction.id ? (
                // Edit Mode
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Сума (BGN)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.amount}
                        onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Метод на плащане</label>
                      <select
                        value={editForm.paymentMethod}
                        onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-green-500 focus:outline-none"
                      >
                        <option value="cash">💵 Кеш</option>
                        <option value="card">💳 Картово плащане</option>
                        <option value="bank_transfer">🏦 Банков път</option>
                        <option value="online">🌐 Revolut</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Бележки</label>
                      <input
                        type="text"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-green-500 focus:outline-none"
                        placeholder="Допълнителни бележки..."
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                    >
                      ✅ Запази
                    </button>
                    <button
                      onClick={() => setEditingTransaction(null)}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                    >
                      ✕ Отказ
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-2xl font-bold text-green-400">
                        {transaction.amount.toFixed(2)} BGN
                      </span>
                      <span className="text-sm text-slate-400">
                        {new Date(transaction.recorded_at).toLocaleDateString('bg-BG', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {transaction.case_description && (
                      <p className="text-sm text-slate-300 mb-1">
                        📋 {transaction.case_description}
                      </p>
                    )}
                    {transaction.notes && (
                      <p className="text-xs text-slate-400">
                        💬 {transaction.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleEditClick(transaction)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-sm"
                  >
                    ✏️ Редактирай
                  </button>
                </div>
              )}
            </div>
          ))}

          {transactions.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <p>Няма транзакции за този метод на плащане</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Month Details Modal Component (same as Payment Details but for months)
function MonthDetailsModal({ month, transactions, onClose, onTransactionUpdated }: {
  month: string
  transactions: any[]
  onClose: () => void
  onTransactionUpdated: () => void
}) {
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [editForm, setEditForm] = useState({ amount: '', paymentMethod: '', notes: '' })

  const handleEditClick = (transaction: any) => {
    setEditingTransaction(transaction)
    setEditForm({
      amount: transaction.amount.toString(),
      paymentMethod: transaction.payment_method || '',
      notes: transaction.notes || ''
    })
  }

  const handleSaveEdit = async () => {
    try {
      await apiClient.updateIncomeTransaction(editingTransaction.id, {
        amount: parseFloat(editForm.amount),
        paymentMethod: editForm.paymentMethod,
        notes: editForm.notes
      })
      alert('Транзакцията беше обновена успешно!')
      setEditingTransaction(null)
      onTransactionUpdated()
    } catch (error) {
      console.error('Error updating transaction:', error)
      alert('Възникна грешка при обновяването')
    }
  }

  const monthName = new Date(month + '-01').toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-lg sticky top-0">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">📅 {monthName}</h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl"
            >
              ✕
            </button>
          </div>
          <p className="text-purple-100 mt-1">{transactions.length} транзакции</p>
        </div>

        {/* Transactions List */}
        <div className="p-6 space-y-4">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="bg-slate-700/50 border border-slate-600 rounded-lg p-4"
            >
              {editingTransaction?.id === transaction.id ? (
                // Edit Mode
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Сума (BGN)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.amount}
                        onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Метод на плащане</label>
                      <select
                        value={editForm.paymentMethod}
                        onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-green-500 focus:outline-none"
                      >
                        <option value="cash">💵 Кеш</option>
                        <option value="card">💳 Картово плащане</option>
                        <option value="bank_transfer">🏦 Банков път</option>
                        <option value="online">🌐 Revolut</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Бележки</label>
                      <input
                        type="text"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-green-500 focus:outline-none"
                        placeholder="Допълнителни бележки..."
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                    >
                      ✅ Запази
                    </button>
                    <button
                      onClick={() => setEditingTransaction(null)}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                    >
                      ✕ Отказ
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-2xl font-bold text-green-400">
                        {transaction.amount.toFixed(2)} BGN
                      </span>
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                        {transaction.payment_method || 'Неуточнен'}
                      </span>
                      <span className="text-sm text-slate-400">
                        {new Date(transaction.recorded_at).toLocaleDateString('bg-BG', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {transaction.case_description && (
                      <p className="text-sm text-slate-300 mb-1">
                        📋 {transaction.case_description}
                      </p>
                    )}
                    {transaction.notes && (
                      <p className="text-xs text-slate-400">
                        💬 {transaction.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleEditClick(transaction)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-sm"
                  >
                    ✏️ Редактирай
                  </button>
                </div>
              )}
            </div>
          ))}

          {transactions.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <p>Няма транзакции за този месец</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


