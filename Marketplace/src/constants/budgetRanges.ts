/**
 * Budget Range Configuration
 * Defines predefined budget ranges for case creation
 */

export const BUDGET_RANGES = [
  { value: '1-125', label: '1-125 лв', min: 1, max: 125 },
  { value: '126-250', label: '126-250 лв', min: 126, max: 250 },
  { value: '251-400', label: '251-400 лв', min: 251, max: 400 },
  { value: '401-500', label: '401-500 лв', min: 401, max: 500 },
  { value: '501-1000', label: '501-1000 лв', min: 501, max: 1000 },
  { value: '1001-1500', label: '1001-1500 лв', min: 1001, max: 1500 },
  { value: '1501-2000', label: '1501-2000 лв', min: 1501, max: 2000 },
  { value: '2001-2500', label: '2001-2500 лв', min: 2001, max: 2500 },
  { value: '2501-3000', label: '2501-3000 лв', min: 2501, max: 3000 },
  { value: '3001-3500', label: '3001-3500 лв', min: 3001, max: 3500 },
  { value: '3501-4000', label: '3501-4000 лв', min: 3501, max: 4000 },
  { value: '4001-4500', label: '4001-4500 лв', min: 4001, max: 4500 },
  { value: '4501-5000', label: '4501-5000 лв', min: 4501, max: 5000 },
  { value: '5000+', label: '5000+ лв', min: 5001, max: null }
] as const;

export type BudgetRangeValue = typeof BUDGET_RANGES[number]['value'];

/**
 * Get the midpoint of a budget range for calculations
 * For "5000+", returns 6000 as a reasonable estimate
 */
export const getBudgetMidpoint = (rangeValue: string): number => {
  const range = BUDGET_RANGES.find(r => r.value === rangeValue);
  if (!range) return 0;
  
  if (range.max === null) {
    // For "5000+", use 6000 as estimate
    return 6000;
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
