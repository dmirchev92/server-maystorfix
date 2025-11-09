export const SERVICE_CATEGORIES = [
  { value: 'electrician', label: 'Електроуслуги', icon: 'zap' },
  { value: 'plumber', label: 'ВиК Услуги', icon: 'droplet' },
  { value: 'hvac', label: 'Отопление и климатизация', icon: 'wind' },
  { value: 'carpenter', label: 'Дърводелски услуги', icon: 'hammer' },
  { value: 'painter', label: 'Боядисване', icon: 'paintbrush' },
  { value: 'locksmith', label: 'Ключар', icon: 'key' },
  { value: 'cleaner', label: 'Почистване', icon: 'sparkles' },
  { value: 'gardener', label: 'Озеленяване', icon: 'flower' },
  { value: 'handyman', label: 'Цялостни ремонти', icon: 'wrench' },
  { value: 'roofer', label: 'Ремонти на покрив', icon: 'home' },
  { value: 'moving', label: 'Хамалски Услуги', icon: 'truck' },
  { value: 'tiler', label: 'Плочки и теракот', icon: 'grid' },
  { value: 'welder', label: 'Железарски услуги', icon: 'flame' },
  { value: 'design', label: 'Дизайн', icon: 'palette' }
] as const;

export type ServiceCategoryValue = typeof SERVICE_CATEGORIES[number]['value'];
