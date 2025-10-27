// Theme configuration for ServiceText Pro
export default {
  colors: {
    primary: {
      solid: '#4F46E5', // Indigo
      light: '#818CF8',
      dark: '#3730A3',
    },
    secondary: {
      solid: '#10B981', // Green
      light: '#34D399',
      dark: '#059669',
    },
    background: {
      primary: '#F9FAFB',
      secondary: '#FFFFFF',
      tertiary: '#F3F4F6',
    },
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      tertiary: '#9CA3AF',
      inverse: '#FFFFFF',
    },
    border: {
      light: '#E5E7EB',
      medium: '#D1D5DB',
      dark: '#9CA3AF',
    },
    status: {
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#3B82F6',
    },
    success: {
      solid: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    warning: {
      solid: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
    },
    danger: {
      solid: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  fontWeight: {
    regular: '400' as '400',
    medium: '500' as '500',
    semibold: '600' as '600',
    bold: '700' as '700',
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: '700' as '700',
      lineHeight: 40,
    },
    h2: {
      fontSize: 24,
      fontWeight: '600' as '600',
      lineHeight: 32,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as '600',
      lineHeight: 28,
    },
    h4: {
      fontSize: 18,
      fontWeight: '600' as '600',
      lineHeight: 24,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as '400',
      lineHeight: 24,
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '400' as '400',
      lineHeight: 20,
    },
    caption: {
      fontSize: 14,
      fontWeight: '400' as '400',
      lineHeight: 20,
    },
    small: {
      fontSize: 12,
      fontWeight: '400' as '400',
      lineHeight: 16,
    },
  },
};
