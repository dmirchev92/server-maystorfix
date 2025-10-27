// Chat Page - Handles incoming chat requests via unique tokens
// URL: /u/{spIdentifier}/c/{token}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

interface ChatPageProps {
  params: {
    spIdentifier: string;
    token: string;
  };
}

interface ValidationResult {
  valid: boolean;
  userId?: string;
  conversationId?: string;
  error?: string;
}

export default function ChatPage({ params }: ChatPageProps) {
  const { spIdentifier, token } = params;
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [formMode, setFormMode] = useState<'register' | 'login'>('register');
  const [authError, setAuthError] = useState<string | null>(null);
  const [providerInfo, setProviderInfo] = useState<any>({
    businessName: '',
    firstName: '',
    serviceCategory: 'electrician'
  });

  // Check for existing session on page load, then auto-validate token
  useEffect(() => {
    if (!hasValidated) {
      checkExistingSession();
    }
  }, [spIdentifier, token, hasValidated]);

  const checkExistingSession = async () => {
    try {
      setHasValidated(true); // Mark as validated to prevent duplicate calls
      
      const sessionKey = `chat_session_${spIdentifier}`;
      const tokenKey = `chat_token_${spIdentifier}`;
      const existingSessionId = localStorage.getItem(sessionKey);
      const lastUsedToken = localStorage.getItem(tokenKey);
      
      // Check if this is a new token (different from the one that created the session)
      if (existingSessionId && lastUsedToken && lastUsedToken !== token) {
        console.log(`New token detected! Last used: ${lastUsedToken}, Current: ${token}`);
        console.log('Forcing token validation for new token...');
        
        // Clear old session since we have a new token
        localStorage.removeItem(sessionKey);
        localStorage.removeItem(tokenKey);
        
        // Force validate the new token
        await validateToken();
        setHasStartedChat(true);
        return;
      }
      
      if (existingSessionId) {
        console.log('Found existing session:', existingSessionId);
        console.log('Same token as before, using existing session');
        
        // Validate existing session
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1';
        const response = await axios.get(
          `${apiUrl}/chat/sessions/${existingSessionId}/validate`,
          { timeout: 10000 }
        );

        if (response.data.success) {
          console.log('✅ Token validation successful:', response.data);
          setValidationResult({
            valid: true,
            userId: response.data.data.userId,
            conversationId: response.data.data.conversationId
          });

          // Fetch provider information
          if (response.data.data.userId) {
            await fetchProviderInfo(response.data.data.userId);
          }

          setHasStartedChat(true);
          return;
        } else {
          // Session invalid, remove from storage
          localStorage.removeItem(sessionKey);
          localStorage.removeItem(tokenKey);
        }
      }
      
      // No existing session found, show welcome screen
      console.log('No existing session, showing welcome screen');
      // Don't auto-validate token - let user click "Start Chat" button
      
    } catch (error) {
      console.log('Session check failed, showing welcome screen:', error);
      // Don't auto-validate token - let user click "Start Chat" button
    }
  };

  const validateToken = async () => {
    try {
      setIsValidating(true);
      setError(null);

      console.log('Validating token:', { spIdentifier, token: token.substring(0, 4) + '****' });

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1';
      const response = await axios.get(
        `${apiUrl}/chat/public/${spIdentifier}/validate/${token}`,
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        console.log('Token validation successful:', response.data);
        
        // Store session ID and token in localStorage for future access
        const sessionKey = `chat_session_${spIdentifier}`;
        const tokenKey = `chat_token_${spIdentifier}`;
        if (response.data.data.sessionId) {
          localStorage.setItem(sessionKey, response.data.data.sessionId);
          localStorage.setItem(tokenKey, token); // Store the token that created this session
          console.log('Stored session ID:', response.data.data.sessionId);
          console.log('Stored token:', token);
        }
        
        setValidationResult({
          valid: true,
          userId: response.data.data.userId,
          conversationId: response.data.data.conversationId
        });
        
        // Each token represents a unique customer interaction
        // Always show customer form for new tokens (new customers)
        setShowCustomerForm(true);
        console.log('📝 Showing customer form for token:', token);
      } else {
        console.error('Token validation failed:', response.data);
        setValidationResult({
          valid: false,
          error: response.data.error?.message || 'Token validation failed'
        });
      }

    } catch (err: any) {
      console.error('Token validation error:', err);
      
      let errorMessage = 'Failed to validate chat token';
      if (err.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setValidationResult({
        valid: false,
        error: errorMessage
      });
      setError(errorMessage);
    } finally {
      setIsValidating(false);
    }
  };

  const startChat = async () => {
    setHasStartedChat(true);
    await validateToken();
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || isSending || !validationResult?.conversationId) {
      console.log('❌ Cannot send message:', {
        hasMessage: !!currentMessage.trim(),
        isSending,
        hasConversationId: !!validationResult?.conversationId,
        conversationId: validationResult?.conversationId
      });
      return;
    }

    console.log('📤 Sending message:', {
      conversationId: validationResult.conversationId,
      messageLength: currentMessage.length,
      validationResult
    });

    setIsSending(true);
    try {
      const newMessage = {
        id: Date.now().toString(),
        text: currentMessage,
        sender: 'customer',
        timestamp: new Date().toISOString()
      };

      // Add message to UI immediately
      setMessages(prev => [...prev, newMessage]);
      setCurrentMessage('');

      // Send to backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1';
      const messageUrl = `${apiUrl}/marketplace/conversations/${validationResult.conversationId}/messages`;
      console.log('📤 Sending message to:', messageUrl);
      
      await axios.post(messageUrl, {
        senderType: 'customer',
        senderName: customerInfo.name || 'Customer',
        message: currentMessage,
        messageType: 'text'
      });

      console.log('✅ Message sent successfully');
    } catch (error: any) {
      console.error('❌ Failed to send message:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      
      // Show user-friendly error
      alert(`Грешка при изпращане на съобщението: ${error.response?.status || 'Неизвестна грешка'}\n\nДетайли: ${error.response?.data?.error?.message || error.message}`);
      
      // Remove message from UI on error
      setMessages(prev => prev.filter(m => m.id !== Date.now().toString()));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleCustomerFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerInfo.name.trim() || !customerInfo.phone.trim()) {
      alert('Моля въведете име и телефон');
      return;
    }
    
    // Store customer info for this specific token
    const customerKey = `customer_info_${token}`;
    localStorage.setItem(customerKey, JSON.stringify(customerInfo));
    
    // Update conversation with customer details
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1';
      const updateUrl = `${apiUrl}/marketplace/conversations/${validationResult?.conversationId}`;
      
      console.log('🔄 Updating conversation with customer details:', {
        url: updateUrl,
        conversationId: validationResult?.conversationId,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerEmail: customerInfo.email
      });
      
      const response = await axios.put(updateUrl, {
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerEmail: customerInfo.email
      });
      
      console.log('✅ Conversation updated successfully:', response.data);
    } catch (error: any) {
      console.error('❌ Failed to update conversation with customer details:', error);
      console.error('❌ Update error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
    }
    
    // Hide form and start chat
    setShowCustomerForm(false);
    setHasStartedChat(true);
  };

  const handleCustomerInfoChange = (field: string, value: string) => {
    setCustomerInfo(prev => ({
      ...prev,
      [field]: value
    }));
    setAuthError(null); // Clear error when user types
  };

  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    
    // Validation
    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone || !customerInfo.password) {
      setAuthError('Моля попълнете всички полета');
      return;
    }
    
    if (customerInfo.password !== customerInfo.confirmPassword) {
      setAuthError('Паролите не съвпадат');
      return;
    }
    
    if (customerInfo.password.length < 6) {
      setAuthError('Паролата трябва да е поне 6 символа');
      return;
    }
    
    try {
      // Register the user
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1';
      const registerResponse = await axios.post(`${apiUrl}/auth/register`, {
        email: customerInfo.email,
        password: customerInfo.password,
        firstName: customerInfo.name.split(' ')[0] || customerInfo.name,
        lastName: customerInfo.name.split(' ').slice(1).join(' ') || '',
        phoneNumber: customerInfo.phone,
        role: 'customer'
      });
      
      if (registerResponse.data?.success) {
        console.log('Registration successful, auto-logging in...');
        // Auto-login after registration
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1';
        const loginResponse = await axios.post(`${apiUrl}/auth/login`, {
          email: customerInfo.email,
          password: customerInfo.password
        });
        
        console.log('Login response after registration:', loginResponse.data);
        
        // The backend returns token in response.data.data.tokens.accessToken
        const token = loginResponse.data?.data?.tokens?.accessToken;
        const user = loginResponse.data?.data?.user;
        
        if (token && user) {
          console.log('Token and user received, saving to localStorage');
          // Save token and user data
          localStorage.setItem('auth_token', token);
          localStorage.setItem('user_data', JSON.stringify(user));
          
          // Update conversation with customer email BEFORE redirecting
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1';
            const updateUrl = `${apiUrl}/marketplace/conversations/${validationResult?.conversationId}`;
            
            console.log('🔄 Updating conversation with customer email before redirect:', {
              conversationId: validationResult?.conversationId,
              customerEmail: user.email,
              customerName: `${user.firstName} ${user.lastName}`.trim(),
              customerPhone: user.phoneNumber
            });
            
            await axios.put(updateUrl, {
              customerName: `${user.firstName} ${user.lastName}`.trim(),
              customerPhone: user.phoneNumber,
              customerEmail: user.email
            });
            
            console.log('✅ Conversation updated with customer email');
          } catch (error: any) {
            console.error('❌ Failed to update conversation:', error);
            // Continue anyway - not critical
          }
          
          console.log('Redirecting to main page with chat open...');
          // Redirect to main page with chat widget open for this provider
          const providerId = validationResult?.userId || spIdentifier;
          window.location.href = `/?openChat=true&providerId=${providerId}`;
        } else {
          console.error('No token in response');
          setAuthError('Грешка: Не е получен токен за вход след регистрация');
        }
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || 'Грешка при регистрация';
      setAuthError(errorMessage);
    }
  };
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    
    // Validation
    if (!customerInfo.email || !customerInfo.password) {
      setAuthError('Моля въведете email и парола');
      return;
    }
    
    try {
      const loginResponse = await axios.post('http://192.168.0.129:3000/api/v1/auth/login', {
        email: customerInfo.email,
        password: customerInfo.password
      });
      
      console.log('🔍 Full login response:', loginResponse);
      console.log('🔍 loginResponse.data:', loginResponse.data);
      console.log('🔍 loginResponse.data.data:', loginResponse.data?.data);
      console.log('🔍 loginResponse.data.data.tokens:', loginResponse.data?.data?.tokens);
      
      // The backend returns token in response.data.data.tokens.accessToken
      const token = loginResponse.data?.data?.tokens?.accessToken;
      const user = loginResponse.data?.data?.user;
      console.log('🔍 Extracted token:', token);
      console.log('🔍 Extracted user:', user);
      
      if (token && user) {
        console.log('Token and user received, saving to localStorage');
        // Save token and user data
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user_data', JSON.stringify(user));
        console.log('Token and user saved successfully!');
        
        // Update conversation with customer email BEFORE redirecting
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1';
          const updateUrl = `${apiUrl}/marketplace/conversations/${validationResult?.conversationId}`;
          
          console.log('🔄 Updating conversation with customer email before redirect:', {
            conversationId: validationResult?.conversationId,
            customerEmail: user.email,
            customerName: `${user.firstName} ${user.lastName}`.trim(),
            customerPhone: user.phoneNumber
          });
          
          await axios.put(updateUrl, {
            customerName: `${user.firstName} ${user.lastName}`.trim(),
            customerPhone: user.phoneNumber,
            customerEmail: user.email
          });
          
          console.log('✅ Conversation updated with customer email');
        } catch (error: any) {
          console.error('❌ Failed to update conversation:', error);
          // Continue anyway - not critical
        }
        
        console.log('Redirecting to main page with chat open...');
        // Redirect to main page with chat widget open for this provider
        const providerId = validationResult?.userId || spIdentifier;
        window.location.href = `/?openChat=true&providerId=${providerId}`;
      } else {
        console.error('No token in response');
        setAuthError('Грешка: Не е получен токен за вход');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || 'Грешка при вход';
      setAuthError(errorMessage);
    }
  };

  const fetchProviderInfo = async (userId: string) => {
    try {
      console.log('🔍 Fetching provider info for userId:', userId);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://maystorfix.com/api/v1';
      const response = await axios.get(`${apiUrl}/marketplace/providers/${userId}`);
      console.log('📡 Provider API response:', response.data);
      
      if (response.data.success) {
        setProviderInfo(response.data.data);
        console.log('✅ Provider info loaded:', response.data.data);
      } else {
        console.error('❌ Provider API returned error:', response.data.error);
        setFallbackProviderInfo();
      }
    } catch (error) {
      console.error('❌ Failed to fetch provider info:', error);
      setFallbackProviderInfo();
    }
  };

  const setFallbackProviderInfo = () => {
    setProviderInfo({
      businessName: 'Специалист',
      firstName: 'Специалист', 
      lastName: '',
      serviceCategory: 'electrician'
    });
    console.log('🔄 Using fallback provider info: Специалист');
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-lg shadow-xl border border-white/20 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Проверяване на връзката...
            </h2>
            <p className="text-indigo-200">
              Моля, изчакайте докато проверим вашата връзка.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show customer information form
  if (showCustomerForm && validationResult?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-lg shadow-xl border border-white/20 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Започнете чат с {providerInfo.businessName || providerInfo.firstName}
            </h2>
            <p className="text-indigo-200 mb-4">
              Регистрирайте се или влезте за да започнете разговор
            </p>
            
            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setFormMode('register')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  formMode === 'register'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                    : 'bg-white/10 text-indigo-200 hover:bg-white/20'
                }`}
              >
                Регистрация
              </button>
              <button
                type="button"
                onClick={() => setFormMode('login')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  formMode === 'login'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                    : 'bg-white/10 text-indigo-200 hover:bg-white/20'
                }`}
              >
                Вход
              </button>
            </div>
            
            {/* Error Message */}
            {authError && (
              <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                {authError}
              </div>
            )}
          </div>

          <form onSubmit={formMode === 'register' ? handleQuickRegister : handleLogin} className="space-y-4">
            {/* Registration Form */}
            {formMode === 'register' && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-white mb-1">
                    Име *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={customerInfo.name}
                    onChange={(e) => handleCustomerInfoChange('name', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Вашето име"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-white mb-1">
                    Телефон *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={customerInfo.phone}
                    onChange={(e) => handleCustomerInfoChange('phone', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="0888 123 456"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-white mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={customerInfo.email}
                    onChange={(e) => handleCustomerInfoChange('email', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-white mb-1">
                    Парола *
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={customerInfo.password}
                    onChange={(e) => handleCustomerInfoChange('password', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Мин. 6 символа"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-1">
                    Потвърди парола *
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={customerInfo.confirmPassword}
                    onChange={(e) => handleCustomerInfoChange('confirmPassword', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Потвърдете паролата"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-2 px-4 rounded-md hover:from-green-700 hover:to-blue-700 transition-all font-medium shadow-lg"
                >
                  🚀 Регистрирай се и започни чат
                </button>
                
                <p className="text-xs text-indigo-300 text-center">
                  Ще бъдете автоматично влезли след регистрацията
                </p>
              </>
            )}
            
            {/* Login Form */}
            {formMode === 'login' && (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-white mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={customerInfo.email}
                    onChange={(e) => handleCustomerInfoChange('email', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-white mb-1">
                    Парола *
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={customerInfo.password}
                    onChange={(e) => handleCustomerInfoChange('password', e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin(e)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Вашата парола"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 to-pink-500 text-white py-2 px-4 rounded-md hover:from-indigo-600 hover:to-pink-600 transition-all font-medium shadow-lg"
                >
                  🔓 Влез и започни чат
                </button>
                
                <p className="text-xs text-indigo-300 text-center">
                  Ще бъдете автоматично влезли и чатът ще се отвори
                </p>
              </>
            )}
          </form>
        </div>
      </div>
    );
  }

  if (hasStartedChat && !validationResult?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-lg shadow-xl border border-white/20 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Невалидна връзка
            </h2>
            <p className="text-indigo-200 mb-4">
              {validationResult?.error || 'Тази връзка вече не е активна или е изтекла.'}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gradient-to-r from-indigo-500 to-pink-500 text-white py-2 px-4 rounded-md hover:from-indigo-600 hover:to-pink-600 transition-all shadow-lg"
              >
                Опитайте отново
              </button>
              <p className="text-sm text-indigo-300">
                Ако проблемът продължава, моля обадете се отново.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show welcome screen if chat hasn't started yet
  if (!hasStartedChat && !validationResult?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-md shadow-lg border-b border-white/20">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-white">
                  💬 Чат с {providerInfo?.businessName || 'техник'}
                </h1>
                <p className="text-sm text-indigo-200">
                  Опишете вашия проблем и ще получите бърз отговор
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-indigo-200">Онлайн</span>
              </div>
            </div>
          </div>
        </div>

        {/* Welcome Screen */}
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 min-h-[600px] flex flex-col items-center justify-center">
            
            {/* Welcome Content */}
            <div className="text-center max-w-md mx-auto p-8">
              <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                {providerInfo?.businessName ? (
                  <span className="text-indigo-300 font-bold text-lg">
                    {providerInfo.businessName.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                )}
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-4">
                Добре дошли в чата с {providerInfo?.businessName || 'нас'}!
              </h2>
              
              <p className="text-indigo-200 mb-6">
                Готови сме да ви помогнем с вашия проблем. Натиснете бутона по-долу за да започнете разговора.
              </p>
              
              <button
                onClick={startChat}
                className="bg-gradient-to-r from-indigo-500 to-pink-500 text-white px-8 py-3 rounded-lg hover:from-indigo-600 hover:to-pink-600 transition-all font-medium shadow-lg"
              >
                Започни чат
              </button>
              
              <div className="mt-8 p-4 bg-indigo-500/10 rounded-lg border border-indigo-400/30">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-medium">
                      {providerInfo?.businessName?.charAt(0).toUpperCase() || 'Т'}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-white font-medium mb-1">
                      {providerInfo?.businessName || 'Техник'} - {providerInfo?.serviceCategory === 'electrician' ? 'Електротехник' : 'Техник'}
                    </p>
                    <p className="text-sm text-indigo-200">
                      Здравейте! Готов съм да ви помогна с вашия проблем.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md shadow-lg border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">
                💬 Чат с {providerInfo?.businessName || 'техник'}
              </h1>
              <p className="text-sm text-indigo-200">
                Опишете вашия проблем и ще получите бърз отговор
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-indigo-200">Онлайн</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 min-h-[600px] flex flex-col">
          
          {/* Welcome Message */}
          <div className="p-6 border-b border-white/20 bg-indigo-500/10">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-medium">
                  {providerInfo?.businessName?.charAt(0).toUpperCase() || 'Т'}
                </span>
              </div>
              <div className="flex-1">
                <div className="bg-white/20 backdrop-blur-sm p-4 rounded-lg shadow-sm border border-white/30">
                  <p className="text-white mb-2">
                    Здравейте! Аз съм {providerInfo?.firstName || providerInfo?.businessName || 'вашият техник'}. 
                  </p>
                  <p className="text-indigo-100 text-sm">
                    Моля, опишете какъв е проблемът и ще ви помогна възможно най-бързо. 
                    Ако е спешно, споменете това в съобщението.
                  </p>
                </div>
                <p className="text-xs text-indigo-300 mt-2">Сега</p>
              </div>
            </div>
          </div>

          {/* Chat Messages Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-indigo-300 py-8">
                  <p>Започнете разговора като напишете съобщение по-долу</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender === 'customer' 
                        ? 'bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-lg' 
                        : 'bg-white/20 backdrop-blur-sm text-white border border-white/30'
                    }`}>
                      <p>{message.text}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender === 'customer' ? 'text-indigo-100' : 'text-indigo-300'
                      }`}>
                        {new Date(message.timestamp).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Message Input */}
          <div className="border-t border-white/20 p-4">
            <div className="flex space-x-3">
              <div className="flex-1">
                <textarea
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Опишете вашия проблем тук..."
                  className="w-full p-3 bg-white/10 border border-white/20 rounded-lg resize-none text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                  disabled={isSending}
                />
              </div>
              <button 
                onClick={sendMessage}
                disabled={!currentMessage.trim() || isSending}
                className="bg-gradient-to-r from-indigo-500 to-pink-500 text-white px-6 py-3 rounded-lg hover:from-indigo-600 hover:to-pink-600 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-indigo-300 mt-2">
              Натиснете Enter за да изпратите или Shift+Enter за нов ред
            </p>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6 bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-6">
          <h3 className="font-semibold text-white mb-3">ℹ️ Полезна информация</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-indigo-200">
            <div>
              <p className="font-medium text-white mb-1">Работно време:</p>
              <p>Понеделник - Петък: 08:00 - 18:00</p>
              <p>Събота: 09:00 - 15:00</p>
            </div>
            <div>
              <p className="font-medium text-white mb-1">Спешни случаи:</p>
              <p>Отговарям в рамките на 15 минути</p>
              <p>Достъпен 24/7 за аварии</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
