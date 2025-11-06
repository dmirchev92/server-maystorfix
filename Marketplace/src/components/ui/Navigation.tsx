import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';

interface NavigationProps {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    avatar?: string;
    subscription_tier_id?: 'free' | 'normal' | 'pro';
  };
  unreadCount?: number;
  onLogout?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ user, unreadCount = 0, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const router = useRouter();

  const getTierBadge = (tier?: 'free' | 'normal' | 'pro') => {
    if (!tier || tier === 'free') return null;
    
    const tierConfig = {
      normal: { label: 'NORMAL', color: 'bg-green-500/20 text-green-300 border-green-400/30' },
      pro: { label: 'PRO', color: 'bg-purple-500/20 text-purple-300 border-purple-400/30' }
    };
    
    const config = tierConfig[tier];
    return (
      <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold border", config.color)}>
        {config.label}
      </span>
    );
  };

  const navigationItems = [
    { href: '/search', label: 'Търсене', icon: '🔍' },
    // Service provider items
    ...(user?.role === 'tradesperson' || user?.role === 'service_provider' ? [
      { href: '/dashboard/cases', label: 'Заявки', icon: '📋' },
      { href: '/dashboard', label: 'Табло', icon: '📊' },
      { href: '/referrals', label: 'Препоръки', icon: '🎯' },
    ] : []),
    // Customer items
    ...(user && user.role !== 'tradesperson' && user.role !== 'service_provider' ? [
      { href: '/create-case', label: 'Нова заявка', icon: '➕' },
      { href: '/my-cases', label: 'Моите заявки', icon: '📋' },
    ] : []),
  ];

  const userMenuItems = [
    { href: '/notifications', label: 'Известия', icon: '🔔', badge: unreadCount },
    ...(user?.role === 'tradesperson' || user?.role === 'service_provider' ? [
      { href: '/settings/sms', label: 'SMS Настройки', icon: '📱' }
    ] : []),
    { href: '/settings', label: 'Настройки', icon: '⚙️' },
  ];

  return (
    <nav className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900/90 text-slate-100 backdrop-blur-md border-b border-white/10 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 transform group-hover:scale-110 transition-transform duration-200">
              <img 
                src="/icon2.png" 
                alt="MaystorFix" 
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-xl font-bold text-white">
              MaystorFix
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-all duration-200 group"
              >
                <span className="group-hover:scale-110 transition-transform duration-200">
                  {item.icon}
                </span>
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* User Menu / Auth Buttons */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/10 transition-all duration-200 group"
                >
                  <div className="relative">
                    <Avatar
                      name={`${user.firstName} ${user.lastName}`}
                      src={user.avatar}
                      size="sm"
                      status="online"
                      showStatus
                    />
                    {/* Red dot indicator for unread notifications */}
                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-slate-900 rounded-full animate-pulse"></div>
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-white">
                        {user.firstName} {user.lastName}
                      </p>
                      {(user.role === 'tradesperson' || user.role === 'service_provider') && getTierBadge(user.subscription_tier_id)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        user.role === 'tradesperson' || user.role === 'service_provider' 
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' 
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      )}>
                        {user.role === 'tradesperson' || user.role === 'service_provider' ? 'Изпълнител' : 'Клиент'}
                      </span>
                    </div>
                  </div>
                  <svg
                    className={cn(
                      'w-4 h-4 text-slate-300 transition-transform duration-200',
                      isProfileMenuOpen && 'rotate-180'
                    )}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Profile Dropdown */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/10 py-2 z-50">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-sm font-medium text-white">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-slate-300">{user.email}</p>
                    </div>
                    
                    {userMenuItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center justify-between px-4 py-2 text-sm text-slate-200 hover:bg-white/10 hover:text-white transition-colors duration-200"
                        onClick={() => setIsProfileMenuOpen(false)}
                      >
                        <div className="flex items-center space-x-3">
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </div>
                        {item.badge && item.badge > 0 && (
                          <Badge variant="error" size="sm">
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    ))}
                    
                    <div className="border-t border-white/10 mt-2 pt-2">
                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onLogout?.();
                        }}
                        className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors duration-200"
                      >
                        <span>🚪</span>
                        <span>Изход</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link href="/auth/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      console.log('🔘 Вход button clicked');
                    }}
                  >
                    Вход
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      console.log('🔘 Регистрация button clicked');
                    }}
                  >
                    Регистрация
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors duration-200"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-white/10 py-4">
            <div className="space-y-2">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors duration-200"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span>{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close menus */}
      {(isMenuOpen || isProfileMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsMenuOpen(false);
            setIsProfileMenuOpen(false);
          }}
        />
      )}
    </nav>
  );
};

export { Navigation };
export type { NavigationProps };
