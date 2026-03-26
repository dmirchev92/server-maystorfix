/**
 * Budget Range Configuration
 * Defines predefined budget ranges for case creation
 */

export const BUDGET_RANGES = [
  { value: '1-250', label: '1-250 €', min: 1, max: 250 },
  { value: '251-500', label: '251-500 €', min: 251, max: 500 },
  { value: '501-750', label: '501-750 €', min: 501, max: 750 },
  { value: '751-1000', label: '751-1000 €', min: 751, max: 1000 },
  { value: '1001-2000', label: '1001-2000 €', min: 1001, max: 2000 },
  { value: '2001-3000', label: '2001-3000 €', min: 2001, max: 3000 },
  { value: '3001-4000', label: '3001-4000 €', min: 3001, max: 4000 },
  { value: '4001-5000', label: '4001-5000 €', min: 4001, max: 5000 },
  { value: '5001-6000', label: '5001-6000 €', min: 5001, max: 6000 },
  { value: '6001-7000', label: '6001-7000 €', min: 6001, max: 7000 },
  { value: '7001-8000', label: '7001-8000 €', min: 7001, max: 8000 },
  { value: '8001-9000', label: '8001-9000 €', min: 8001, max: 9000 },
  { value: '9001-10000', label: '9001-10000 €', min: 9001, max: 10000 },
  { value: '10000+', label: '10000+ €', min: 10001, max: null }
] as const;

export type BudgetRangeValue = typeof BUDGET_RANGES[number]['value'];

/**
 * Get the midpoint of a budget range for calculations
 * For "10000+", returns 12000 as a reasonable estimate
 */
export const getBudgetMidpoint = (rangeValue: string): number => {
  const range = BUDGET_RANGES.find(r => r.value === rangeValue);
  if (!range) return 0;
  
  if (range.max === null) {
    // For "10000+", use 12000 as estimate
    return 12000;
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
