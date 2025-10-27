'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Header } from '@/components/Header';

interface SecurityAlert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  userId: string;
  timestamp: string;
  details: any;
}

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  smsBlocked: number;
  smsAllowed: number;
  uptime: number;
  memoryUsage: any;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (user?.role !== 'admin') {
      router.push('/');
      return;
    }

    loadDashboardData();
    
    // Set up real-time notifications
    const interval = setInterval(loadSecurityAlerts, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [isAuthenticated, user, router]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      
      const [dashboardRes, usersRes] = await Promise.all([
        axios.get('http://192.168.0.129:3000/api/v1/admin/dashboard', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://192.168.0.129:3000/api/v1/admin/users', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (dashboardRes.data.success) {
        setSecurityAlerts(dashboardRes.data.data.securityAlerts || []);
        setSystemStats(dashboardRes.data.data.systemStats);
      }

      if (usersRes.data.success) {
        setUsers(usersRes.data.data.users || []);
      }

    } catch (error: any) {
      console.error('❌ Error loading dashboard:', error);
      if (error.response?.status === 403) {
        alert('Access denied. Admin privileges required.');
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSecurityAlerts = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get('http://192.168.0.129:3000/api/v1/admin/security/alerts', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const newAlerts = response.data.data.alerts || [];
        const previousCount = securityAlerts.length;
        
        setSecurityAlerts(newAlerts);
        
        // Show notification for new alerts
        if (newAlerts.length > previousCount) {
          const newCount = newAlerts.length - previousCount;
          addNotification(`🚨 ${newCount} new security alert${newCount > 1 ? 's' : ''} detected!`);
        }
      }
    } catch (error) {
      console.error('❌ Error loading security alerts:', error);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.put(
        `http://192.168.0.129:3000/api/v1/admin/users/${userId}/status`,
        { isActive: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setUsers(users.map(u => 
          u.id === userId ? { ...u, is_active: !currentStatus } : u
        ));
        addNotification(`✅ User ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
      }
    } catch (error: any) {
      console.error('❌ Error toggling user status:', error);
      alert('Error updating user status: ' + (error.response?.data?.error?.message || error.message));
    }
  };

  const viewUserSettings = async (userId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(
        `http://192.168.0.129:3000/api/v1/admin/users/${userId}/settings`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const userData = response.data.data;
        alert(`User Settings for ${userData.user.email}:\n\nSMS Enabled: ${userData.smsSettings.isEnabled}\nSMS Count: ${userData.smsStats.totalCount}\nSuccess Rate: ${userData.smsStats.successRate}%\n\n⚠️ User has been notified of admin access.`);
      }
    } catch (error: any) {
      console.error('❌ Error viewing user settings:', error);
      alert('Error accessing user settings: ' + (error.response?.data?.error?.message || error.message));
    }
  };

  const addNotification = (message: string) => {
    setNotifications(prev => [message, ...prev.slice(0, 4)]); // Keep last 5 notifications
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n !== message));
    }, 5000);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification, index) => (
          <div
            key={index}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in-right"
          >
            {notification}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">👑 Admin Dashboard</h1>
              <p className="text-gray-600">Welcome, {user?.firstName} {user?.lastName}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                🔒 Security Level: HIGH
              </div>
              <button
                onClick={() => router.push('/')}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                Back to App
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* System Stats */}
        {systemStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">👥</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{systemStats.totalUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">✅</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">{systemStats.activeUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">🚫</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">SMS Blocked</p>
                  <p className="text-2xl font-bold text-gray-900">{systemStats.smsBlocked}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">📱</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">SMS Allowed</p>
                  <p className="text-2xl font-bold text-gray-900">{systemStats.smsAllowed}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Security Alerts */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">🚨 Security Alerts</h2>
              <p className="text-sm text-gray-600">Real-time security monitoring</p>
            </div>
            <div className="p-6">
              {securityAlerts.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-2">🛡️</div>
                  <p>No security alerts</p>
                  <p className="text-sm">System is secure</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {securityAlerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{alert.message}</p>
                          <p className="text-sm opacity-75">User: {alert.userId}</p>
                          <p className="text-xs opacity-50">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* User Management */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">👥 User Management</h2>
              <p className="text-sm text-gray-600">Manage user accounts</p>
            </div>
            <div className="p-6">
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {users.slice(0, 10).map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div>
                        <p className="font-medium">{user.first_name} {user.last_name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        <p className="text-xs text-gray-500">{user.role}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => viewUserSettings(user.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View Settings
                      </button>
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                          className={`text-sm ${user.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                        >
                          {user.is_active ? 'Disable' : 'Enable'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
