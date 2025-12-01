// All 18 service categories with Bulgarian labels
// Note: Backend uses values without 'cat_' prefix (e.g., 'electrician', 'locksmith')
export const SERVICE_CATEGORIES = [
  { value: 'cat_electrician', label: 'Електротехник', icon: 'zap' },
  { value: 'cat_plumber', label: 'Водопроводчик', icon: 'droplet' },
  { value: 'cat_hvac', label: 'Отопление и климатизация', icon: 'wind' },
  { value: 'cat_carpenter', label: 'Дърводелец', icon: 'hammer' },
  { value: 'cat_painter', label: 'Бояджия', icon: 'paintbrush' },
  { value: 'cat_locksmith', label: 'Ключар', icon: 'key' },
  { value: 'cat_cleaner', label: 'Почистване', icon: 'sparkles' },
  { value: 'cat_gardener', label: 'Градинар', icon: 'flower' },
  { value: 'cat_handyman', label: 'Дребни ремонти', icon: 'tool' },
  { value: 'cat_renovation', label: 'Цялостни ремонти', icon: 'wrench' },
  { value: 'cat_roofer', label: 'Покривни услуги', icon: 'home' },
  { value: 'cat_mover', label: 'Хамалски услуги', icon: 'truck' },
  { value: 'cat_tiler', label: 'Майстор Фаянс', icon: 'grid' },
  { value: 'cat_welder', label: 'Заварчик', icon: 'flame' },
  { value: 'cat_appliance', label: 'Ремонт на уреди', icon: 'settings' },
  { value: 'cat_flooring', label: 'Подови настилки', icon: 'layers' },
  { value: 'cat_plasterer', label: 'Шпакловане', icon: 'square' },
  { value: 'cat_glasswork', label: 'Стъкларски услуги', icon: 'maximize' },
  { value: 'cat_design', label: 'Дизайн', icon: 'palette' },
] as const;

// Categories map for quick lookup (supports both with and without 'cat_' prefix)
export const CATEGORY_LABELS: Record<string, string> = {
  // With cat_ prefix
  'cat_electrician': 'Електротехник',
  'cat_plumber': 'Водопроводчик',
  'cat_hvac': 'Отопление и климатизация',
  'cat_carpenter': 'Дърводелец',
  'cat_painter': 'Бояджия',
  'cat_locksmith': 'Ключар',
  'cat_cleaner': 'Почистване',
  'cat_gardener': 'Градинар',
  'cat_handyman': 'Дребни ремонти',
  'cat_renovation': 'Цялостни ремонти',
  'cat_roofer': 'Покривни услуги',
  'cat_mover': 'Хамалски услуги',
  'cat_tiler': 'Майстор Фаянс',
  'cat_welder': 'Заварчик',
  'cat_appliance': 'Ремонт на уреди',
  'cat_flooring': 'Подови настилки',
  'cat_plasterer': 'Шпакловане',
  'cat_glasswork': 'Стъкларски услуги',
  'cat_design': 'Дизайн',
  // Without cat_ prefix (backend format)
  'electrician': 'Електротехник',
  'plumber': 'Водопроводчик',
  'hvac': 'Отопление и климатизация',
  'carpenter': 'Дърводелец',
  'painter': 'Бояджия',
  'locksmith': 'Ключар',
  'cleaner': 'Почистване',
  'gardener': 'Градинар',
  'handyman': 'Дребни ремонти',
  'renovation': 'Цялостни ремонти',
  'roofer': 'Покривни услуги',
  'mover': 'Хамалски услуги',
  'tiler': 'Майстор Фаянс',
  'welder': 'Заварчик',
  'appliance': 'Ремонт на уреди',
  'flooring': 'Подови настилки',
  'plasterer': 'Шпакловане',
  'glasswork': 'Стъкларски услуги',
  'design': 'Дизайн',
};

// Helper function to get Bulgarian label for any category format
export const getCategoryLabel = (category: string): string => {
  if (!category) return '';
  const lowerCategory = category.toLowerCase();
  return CATEGORY_LABELS[lowerCategory] || CATEGORY_LABELS[`cat_${lowerCategory}`] || category;
};

export type ServiceCategoryValue = typeof SERVICE_CATEGORIES[number]['value'];
