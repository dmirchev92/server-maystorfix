/**
 * Budget Range Configuration
 * Defines predefined budget ranges for case creation
 */

export const BUDGET_RANGES = [
  { value: '1-250', label: '1-250 лв', min: 1, max: 250 },
  { value: '250-500', label: '250-500 лв', min: 250, max: 500 },
  { value: '500-750', label: '500-750 лв', min: 500, max: 750 },
  { value: '750-1000', label: '750-1000 лв', min: 750, max: 1000 },
  { value: '1000-1500', label: '1000-1500 лв', min: 1000, max: 1500 },
  { value: '1500-2000', label: '1500-2000 лв', min: 1500, max: 2000 },
  { value: '2000-3000', label: '2000-3000 лв', min: 2000, max: 3000 },
  { value: '3000-4000', label: '3000-4000 лв', min: 3000, max: 4000 },
  { value: '4000-5000', label: '4000-5000 лв', min: 4000, max: 5000 },
  { value: '5000-7500', label: '5000-7500 лв', min: 5000, max: 7500 },
  { value: '7500-10000', label: '7500-10000 лв', min: 7500, max: 10000 },
  { value: '10000+', label: '10000+ лв', min: 10000, max: null }
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
