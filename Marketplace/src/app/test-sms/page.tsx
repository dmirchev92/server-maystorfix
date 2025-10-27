import { Header } from '@/components/Header';

export default function TestSMSPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-4">🧪 SMS Test Page</h1>
          <p>If you can see this, the page is working!</p>
          <p className="text-sm text-gray-500 mt-4">
            URL: http://localhost:3001/test-sms
          </p>
        </div>
      </div>
    </div>
  );
}