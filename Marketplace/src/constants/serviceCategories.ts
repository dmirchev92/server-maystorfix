// All 19 service categories with Bulgarian labels and emoji icons
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
] as const

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
}

// Helper function to get emoji icon for any category format
export const getCategoryIcon = (category: string): string => {
  if (!category) return '🔧'
  const lowerCategory = category.toLowerCase()
  return CATEGORY_ICONS[lowerCategory] || CATEGORY_ICONS[`cat_${lowerCategory}`] || '🔧'
}

// Helper function to get Bulgarian label for any category format
export const getCategoryLabel = (category: string): string => {
  if (!category) return ''
  const found = SERVICE_CATEGORIES.find(cat => 
    cat.value === category || 
    cat.value === `cat_${category}` || 
    cat.value.replace('cat_', '') === category.toLowerCase()
  )
  return found ? found.label : category
}

export type ServiceCategoryValue = typeof SERVICE_CATEGORIES[number]['value']
