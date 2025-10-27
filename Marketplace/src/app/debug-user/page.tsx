'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';

export default function DebugUser() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">🔍 User Debug Information</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          <p><strong>Is Authenticated:</strong> {isAuthenticated ? '✅ Yes' : '❌ No'}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Raw User Object</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Properties</h2>
          {user ? (
            <div className="space-y-2">
              <p><strong>ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>First Name:</strong> {user.firstName}</p>
              <p><strong>Last Name:</strong> {user.lastName}</p>
              <p><strong>Role:</strong> <span className="bg-blue-100 px-2 py-1 rounded">{user.role}</span></p>
              <p><strong>Phone:</strong> {user.phoneNumber || 'N/A'}</p>
              <p><strong>Company:</strong> {user.companyName || 'N/A'}</p>
            </div>
          ) : (
            <p className="text-gray-500">No user data available</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">LocalStorage Data</h2>
          <div className="space-y-2">
            <p><strong>Auth Token:</strong> {typeof window !== 'undefined' && localStorage.getItem('auth_token') ? '✅ Present' : '❌ Missing'}</p>
            <p><strong>User Data:</strong> {typeof window !== 'undefined' && localStorage.getItem('user_data') ? '✅ Present' : '❌ Missing'}</p>
            {typeof window !== 'undefined' && localStorage.getItem('user_data') && (
              <div>
                <p><strong>Raw User Data from LocalStorage:</strong></p>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto mt-2">
                  {localStorage.getItem('user_data')}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Admin Access Test</h2>
          <div className="space-y-2">
            <p><strong>Role Check:</strong> {user?.role === 'admin' ? '✅ Admin Role Detected' : '❌ Not Admin Role'}</p>
            <p><strong>Should Have Admin Access:</strong> {user?.role === 'admin' ? '✅ Yes' : '❌ No'}</p>
            {user?.role !== 'admin' && (
              <p className="text-red-600">
                <strong>Issue:</strong> User role is "{user?.role}" but should be "admin"
              </p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <a 
            href="/admin" 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Try Admin Access
          </a>
        </div>
      </div>
    </div>
  );
}
