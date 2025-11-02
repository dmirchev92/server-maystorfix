'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface SMSVerificationProps {
  phoneNumber: string;
  onVerified: () => void;
  onPhoneChange?: (phone: string) => void;
}

export default function SMSVerification({ 
  phoneNumber, 
  onVerified,
  onPhoneChange 
}: SMSVerificationProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isVerified, setIsVerified] = useState(false);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sendCode = async () => {
    if (!phoneNumber || phoneNumber.length < 9) {
      setError('Моля, въведете валиден телефонен номер');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/v1/verification/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.data.message);
        setStep('code');
        setCountdown(300); // 5 minutes
        
        // In development, show the code
        if (data.data.code) {
          console.log('🔐 Verification code:', data.data.code);
          setSuccess(`${data.data.message} (Dev: ${data.data.code})`);
        }
      } else {
        setError(data.error?.message || 'Грешка при изпращане на код');
      }
    } catch (err) {
      setError('Грешка при свързване със сървъра');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code || code.length !== 6) {
      setError('Моля, въведете 6-цифрен код');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/v1/verification/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('✅ Телефонът е потвърден успешно!');
        setIsVerified(true);
        setTimeout(() => {
          onVerified();
        }, 1000);
      } else {
        setError(data.error?.message || 'Невалиден код');
      }
    } catch (err) {
      setError('Грешка при свързване със сървъра');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = () => {
    setCode('');
    setError('');
    setSuccess('');
    sendCode();
  };

  if (isVerified) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <div>
          <p className="text-sm font-medium text-green-800">Телефонът е потвърден</p>
          <p className="text-xs text-green-600">{phoneNumber}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Phone Number Input */}
      {step === 'phone' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Телефонен номер *
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => onPhoneChange?.(e.target.value)}
              placeholder="0889 123 456"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Ще получите SMS с код за потвърждение
            </p>
          </div>

          <button
            type="button"
            onClick={sendCode}
            disabled={loading || !phoneNumber}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Изпращане...' : 'Изпрати код за потвърждение'}
          </button>
        </div>
      )}

      {/* Code Verification Input */}
      {step === 'code' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              📱 Код изпратен на <strong>{phoneNumber}</strong>
            </p>
            {countdown > 0 && (
              <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Кодът изтича след {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')} мин
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Код за потвърждение
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(value);
                setError('');
              }}
              placeholder="123456"
              maxLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest font-mono"
              disabled={loading}
              autoFocus
            />
          </div>

          <button
            type="button"
            onClick={verifyCode}
            disabled={loading || code.length !== 6}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Проверка...' : 'Потвърди'}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError('');
              }}
              className="text-gray-600 hover:text-gray-800"
              disabled={loading}
            >
              ← Промени номер
            </button>
            
            {countdown === 0 ? (
              <button
                type="button"
                onClick={resendCode}
                className="text-blue-600 hover:text-blue-800 font-medium"
                disabled={loading}
              >
                Изпрати отново
              </button>
            ) : (
              <span className="text-gray-500">
                Изпрати отново след {countdown}s
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && !error && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}
    </div>
  );
}
