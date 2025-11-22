import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'outline' | 'construction' | 'professional';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', icon, children, ...props }, ref) => {
    const baseClasses = `
      inline-flex items-center gap-1 font-medium rounded-full
      transition-all duration-200 ease-in-out
      border
    `;

    const variants = {
      default: `
        bg-white/10 text-slate-200 border-white/20 backdrop-blur-sm
        hover:bg-white/20
      `,
      primary: `
        bg-indigo-500/20 text-indigo-300 border-indigo-400/30 backdrop-blur-sm
        hover:bg-indigo-500/30
      `,
      success: `
        bg-green-500/20 text-green-300 border-green-400/30 backdrop-blur-sm
        hover:bg-green-500/30
      `,
      warning: `
        bg-yellow-500/20 text-yellow-300 border-yellow-400/30 backdrop-blur-sm
        hover:bg-yellow-500/30
      `,
      error: `
        bg-red-500/20 text-red-300 border-red-400/30 backdrop-blur-sm
        hover:bg-red-500/30
      `,
      info: `
        bg-blue-500/20 text-white border-blue-400/30 backdrop-blur-sm
        hover:bg-blue-500/30
      `,
      outline: `
        bg-transparent text-slate-300 border-white/30 backdrop-blur-sm
        hover:bg-white/5
      `,
      construction: `
        bg-indigo-600/80 text-white border-transparent backdrop-blur-sm
        hover:bg-indigo-600
        shadow-sm hover:shadow-md
      `,
      professional: `
        bg-white/20 text-white border-white/30 backdrop-blur-sm
        hover:bg-white/30
        shadow-sm hover:shadow-md
      `
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
      lg: 'px-3 py-1.5 text-base'
    };

    return (
      <div
        className={cn(
          baseClasses,
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{children}</span>
      </div>
    );
  }
);

Badge.displayName = 'Badge';

// Status Badge Component for case statuses
interface StatusBadgeProps {
  status: 'open' | 'wip' | 'closed' | 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  size?: BadgeProps['size'];
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className }) => {
  const statusConfig = {
    open: {
      variant: 'success' as const,
      icon: '🟢',
      label: 'Отворена'
    },
    wip: {
      variant: 'warning' as const,
      icon: '⚡',
      label: 'В процес'
    },
    closed: {
      variant: 'default' as const,
      icon: '✅',
      label: 'Затворена'
    },
    pending: {
      variant: 'info' as const,
      icon: '⏳',
      label: 'Чакаща'
    },
    accepted: {
      variant: 'success' as const,
      icon: '✅',
      label: 'Приета'
    },
    declined: {
      variant: 'error' as const,
      icon: '❌',
      label: 'Отказана'
    },
    completed: {
      variant: 'default' as const,
      icon: '🏁',
      label: 'Завършена'
    },
    cancelled: {
      variant: 'error' as const,
      icon: '🚫',
      label: 'Анулирана'
    }
  };

  const config = statusConfig[status] || {
    variant: 'default' as const,
    icon: '❓',
    label: status || 'Неизвестен'
  };

  return (
    <Badge
      variant={config.variant}
      size={size}
      className={className}
      icon={<span>{config.icon}</span>}
    >
      {config.label}
    </Badge>
  );
};

// Rating Badge Component
interface RatingBadgeProps {
  rating: number;
  totalReviews?: number;
  size?: BadgeProps['size'];
  showCount?: boolean;
  className?: string;
}

const RatingBadge: React.FC<RatingBadgeProps> = ({ 
  rating, 
  totalReviews = 0, 
  size = 'md', 
  showCount = true,
  className 
}) => {
  const getVariant = (rating: number) => {
    if (rating >= 4.5) return 'construction';
    if (rating >= 4.0) return 'success';
    if (rating >= 3.0) return 'warning';
    return 'error';
  };

  return (
    <Badge
      variant={getVariant(rating)}
      size={size}
      className={className}
      icon={<span>⭐</span>}
    >
      {rating.toFixed(1)}
      {showCount && totalReviews > 0 && (
        <span className="opacity-75">({totalReviews})</span>
      )}
    </Badge>
  );
};

export { Badge, StatusBadge, RatingBadge };
export type { BadgeProps, StatusBadgeProps, RatingBadgeProps };
