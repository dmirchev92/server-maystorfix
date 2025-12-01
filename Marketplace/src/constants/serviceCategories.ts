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
] as const

export type ServiceCategoryValue = typeof SERVICE_CATEGORIES[number]['value']
