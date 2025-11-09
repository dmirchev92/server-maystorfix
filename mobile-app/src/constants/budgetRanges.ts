/**
 * Budget Range Configuration
 * Defines predefined budget ranges for case creation
 */

export const BUDGET_RANGES = [
  { value: '1-250', label: '1-250 лв', min: 1, max: 250 },
  { value: '250-500', label: '250-500 лв', min: 250, max: 500 },
  { value: '500-750', label: '500-750 лв', min: 500, max: 750 },
  { value: '750-1000', label: '750-1000 лв', min: 750, max: 1000 },
  { value: '1000-1250', label: '1000-1250 лв', min: 1000, max: 1250 },
  { value: '1250-1500', label: '1250-1500 лв', min: 1250, max: 1500 },
  { value: '1500-1750', label: '1500-1750 лв', min: 1500, max: 1750 },
  { value: '1750-2000', label: '1750-2000 лв', min: 1750, max: 2000 },
  { value: '2000+', label: '2000+ лв', min: 2000, max: null }
] as const;

export type BudgetRangeValue = typeof BUDGET_RANGES[number]['value'];

/**
 * Get the midpoint of a budget range for calculations
 * For "2000+", returns 2500 as a reasonable estimate
 */
export const getBudgetMidpoint = (rangeValue: string): number => {
  const range = BUDGET_RANGES.find(r => r.value === rangeValue);
  if (!range) return 0;
  
  if (range.max === null) {
    // For "2000+", use 2500 as estimate
    return 2500;
  }
  
  return Math.round((range.min + range.max) / 2);
};

/**
 * Get display label for a budget range
 */
export const getBudgetRangeLabel = (rangeValue: string): string => {
  const range = BUDGET_RANGES.find(r => r.value === rangeValue);
  return range ? range.label : rangeValue;
};
