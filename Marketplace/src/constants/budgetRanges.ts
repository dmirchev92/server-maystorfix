/**
 * Budget Range Configuration
 * Defines predefined budget ranges for case creation
 */

export const BUDGET_RANGES = [
  { value: '1-125', label: '1-125 €', min: 1, max: 125 },
  { value: '125-250', label: '125-250 €', min: 125, max: 250 },
  { value: '250-375', label: '250-375 €', min: 250, max: 375 },
  { value: '375-500', label: '375-500 €', min: 375, max: 500 },
  { value: '500-750', label: '500-750 €', min: 500, max: 750 },
  { value: '750-1000', label: '750-1000 €', min: 750, max: 1000 },
  { value: '1000-1500', label: '1000-1500 €', min: 1000, max: 1500 },
  { value: '1500-2000', label: '1500-2000 €', min: 1500, max: 2000 },
  { value: '2000-2500', label: '2000-2500 €', min: 2000, max: 2500 },
  { value: '2500-3750', label: '2500-3750 €', min: 2500, max: 3750 },
  { value: '3750-5000', label: '3750-5000 €', min: 3750, max: 5000 },
  { value: '5000+', label: '5000+ €', min: 5000, max: null }
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
