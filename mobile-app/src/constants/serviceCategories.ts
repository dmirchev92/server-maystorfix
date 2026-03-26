// All 19 service categories with Bulgarian labels and emoji icons
// Note: Backend uses values without 'cat_' prefix (e.g., 'electrician', 'locksmith')
export const SERVICE_CATEGORIES = [
  { value: 'cat_electrician', label: 'Електротехник', icon: 'zap', emoji: '⚡' },
  { value: 'cat_plumber', label: 'Водопроводчик', icon: 'droplets', emoji: '💧' },
  { value: 'cat_hvac', label: 'Отопление и климатизация', icon: 'wind', emoji: '❄️' },
  { value: 'cat_carpenter', label: 'Дърводелец', icon: 'hammer', emoji: '🔨' },
  { value: 'cat_painter', label: 'Бояджия', icon: 'paintbrush', emoji: '🎨' },
  { value: 'cat_locksmith', label: 'Ключар', icon: 'key', emoji: '🔐' },
  { value: 'cat_cleaner', label: 'Почистване', icon: 'sparkles', emoji: '🧹' },
  { value: 'cat_gardener', label: 'Градинар', icon: 'flower', emoji: '🌱' },
  { value: 'cat_handyman', label: 'Дребни ремонти', icon: 'tool', emoji: '🛠️' },
  { value: 'cat_renovation', label: 'Цялостни ремонти', icon: 'hard-hat', emoji: '🏗️' },
  { value: 'cat_roofer', label: 'Ремонт на покриви', icon: 'home', emoji: '🏠' },
  { value: 'cat_mover', label: 'Хамалски услуги', icon: 'truck', emoji: '🚚' },
  { value: 'cat_tiler', label: 'Майстор Фаянс', icon: 'layout-grid', emoji: '💠' },
  { value: 'cat_welder', label: 'Заварчик', icon: 'hammer', emoji: '⚒️' },
  { value: 'cat_appliance', label: 'Ремонт на уреди', icon: 'settings', emoji: '🔌' },
  { value: 'cat_flooring', label: 'Подови настилки', icon: 'layers', emoji: '🪵' },
  { value: 'cat_plasterer', label: 'Шпакловане', icon: 'paint-bucket', emoji: '🧱' },
  { value: 'cat_glasswork', label: 'Стъкларски услуги', icon: 'maximize', emoji: '🪟' },
  { value: 'cat_design', label: 'Дизайн', icon: 'palette', emoji: '🖼️' },
] as const;

// Centralized emoji icons mapping (supports both 'cat_' prefix and non-prefix formats)
export const CATEGORY_ICONS: Record<string, string> = {
  // With cat_ prefix
  'cat_electrician': '⚡',
  'cat_plumber': '💧',
  'cat_hvac': '❄️',
  'cat_carpenter': '🔨',
  'cat_painter': '🎨',
  'cat_locksmith': '🔐',
  'cat_cleaner': '🧹',
  'cat_gardener': '🌱',
  'cat_handyman': '🛠️',
  'cat_renovation': '🏗️',
  'cat_roofer': '🏠',
  'cat_mover': '🚚',
  'cat_tiler': '💠',
  'cat_welder': '⚒️',
  'cat_appliance': '🔌',
  'cat_flooring': '🪵',
  'cat_plasterer': '🧱',
  'cat_glasswork': '🪟',
  'cat_design': '🖼️',
  // Without cat_ prefix (backend format)
  'electrician': '⚡',
  'plumber': '💧',
  'hvac': '❄️',
  'carpenter': '🔨',
  'painter': '🎨',
  'locksmith': '🔐',
  'cleaner': '🧹',
  'gardener': '🌱',
  'handyman': '🛠️',
  'renovation': '🏗️',
  'roofer': '🏠',
  'mover': '🚚',
  'moving': '🚚',
  'tiler': '💠',
  'welder': '⚒️',
  'appliance': '🔌',
  'appliance_repair': '🔌',
  'flooring': '🪵',
  'plasterer': '🧱',
  'glasswork': '🪟',
  'design': '🖼️',
  'general': '🔧',
};

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
  'cat_roofer': 'Ремонт на покриви',
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
  'roofer': 'Ремонт на покриви',
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
  // Defensive: handle objects (e.g., {category_id: '...'}) passed by accident
  if (typeof category !== 'string') {
    const catObj = category as any;
    category = catObj.category_id || catObj.id || catObj.name || String(category);
  }
  const lowerCategory = category.toLowerCase();
  return CATEGORY_LABELS[lowerCategory] || CATEGORY_LABELS[`cat_${lowerCategory}`] || category;
};

// Helper function to get emoji icon for any category format
export const getCategoryIcon = (category: string): string => {
  if (!category) return '🔧';
  const lowerCategory = category.toLowerCase();
  return CATEGORY_ICONS[lowerCategory] || CATEGORY_ICONS[`cat_${lowerCategory}`] || '🔧';
};

export type ServiceCategoryValue = typeof SERVICE_CATEGORIES[number]['value'];
