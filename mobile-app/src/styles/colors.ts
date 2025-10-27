// Modern Purple Color Scheme - ServiceText Pro Design System
export const Colors = {
  // Primary Purple Palette
  primary: '#6366F1',           // Main purple (buttons, links, accents)
  primaryDark: '#4F46E5',       // Darker purple (hover states)
  primaryLight: '#A5B4FC',      // Light purple (backgrounds, subtle elements)
  
  // Neutral Grays
  background: '#F9FAFB',        // Main background
  surface: '#FFFFFF',           // Cards, forms, surfaces
  surfaceSecondary: '#F3F4F6',  // Secondary backgrounds
  
  // Text Colors
  textPrimary: '#111827',       // Main text
  textSecondary: '#6B7280',     // Secondary text, labels
  textTertiary: '#9CA3AF',      // Placeholder text, hints
  
  // Border Colors
  border: '#D1D5DB',            // Input borders, dividers
  borderLight: '#E5E7EB',       // Light borders
  
  // Status Colors
  success: '#10B981',           // Success states
  error: '#EF4444',             // Error states
  warning: '#F59E0B',           // Warning states
  info: '#3B82F6',              // Info states
  
  // Special Colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// Shadow Styles
export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
};

// Common Spacing
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Typography
export const Typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

// Border Radius
export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};
