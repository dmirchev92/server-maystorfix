import React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'circular' | 'rounded' | 'square';
  status?: 'online' | 'offline' | 'away' | 'busy';
  showStatus?: boolean;
  className?: string;
  onClick?: () => void;
}

// Shared size classes
const sizes = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
  '2xl': 'h-20 w-20 text-2xl'
};

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  name = '',
  size = 'md',
  variant = 'circular',
  status,
  showStatus = false,
  className,
  onClick
}) => {
  // Generate initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate gradient background based on name
  const getGradientFromName = (name: string) => {
    const colors = [
      'from-purple-400 to-purple-600',
      'from-blue-400 to-blue-600',
      'from-green-400 to-green-600',
      'from-yellow-400 to-yellow-600',
      'from-red-400 to-red-600',
      'from-indigo-400 to-indigo-600',
      'from-pink-400 to-pink-600',
      'from-teal-400 to-teal-600'
    ];
    
    const hash = name.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };

  const variants = {
    circular: 'rounded-full',
    rounded: 'rounded-lg',
    square: 'rounded-md'
  };

  const statusColors = {
    online: 'bg-green-400 border-green-500',
    offline: 'bg-gray-400 border-gray-500',
    away: 'bg-yellow-400 border-yellow-500',
    busy: 'bg-red-400 border-red-500'
  };

  const statusSizes = {
    xs: 'h-1.5 w-1.5',
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
    xl: 'h-3.5 w-3.5',
    '2xl': 'h-4 w-4'
  };

  const baseClasses = `
    relative inline-flex items-center justify-center
    font-medium text-white
    transition-all duration-300 ease-in-out
    ${onClick ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : ''}
  `;

  const initials = getInitials(name);
  const gradientClass = getGradientFromName(name);

  return (
    <div className="relative inline-block">
      <div
        className={cn(
          baseClasses,
          sizes[size],
          variants[variant],
          src ? 'overflow-hidden' : `bg-gradient-to-br ${gradientClass}`,
          'ring-2 ring-white shadow-lg',
          className
        )}
        onClick={onClick}
      >
        {src ? (
          <img
            src={src}
            alt={alt || name}
            className="h-full w-full object-cover"
            onError={(e) => {
              // Fallback to initials if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <span className="font-semibold select-none">
            {initials || '?'}
          </span>
        )}
        
        {/* Overlay gradient for better text visibility */}
        {!src && (
          <div className="absolute inset-0 bg-gradient-to-br from-black/10 to-black/20 rounded-inherit" />
        )}
      </div>

      {/* Status indicator */}
      {showStatus && status && (
        <div
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-white',
            statusSizes[size],
            statusColors[status]
          )}
        />
      )}
    </div>
  );
};

// Avatar Group Component
interface AvatarGroupProps {
  avatars: Array<{
    src?: string;
    name: string;
    alt?: string;
  }>;
  max?: number;
  size?: AvatarProps['size'];
  className?: string;
}

const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  max = 4,
  size = 'md',
  className
}) => {
  const displayAvatars = avatars.slice(0, max);
  const remainingCount = avatars.length - max;

  return (
    <div className={cn('flex -space-x-2', className)}>
      {displayAvatars.map((avatar, index) => (
        <Avatar
          key={index}
          src={avatar.src}
          name={avatar.name}
          alt={avatar.alt}
          size={size}
          className="ring-2 ring-white hover:z-10"
        />
      ))}
      
      {remainingCount > 0 && (
        <div
          className={cn(
            'relative inline-flex items-center justify-center',
            'bg-gray-100 text-gray-600 font-medium',
            'ring-2 ring-white rounded-full',
            sizes[size || 'md']
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

export { Avatar, AvatarGroup };
export type { AvatarProps, AvatarGroupProps };
