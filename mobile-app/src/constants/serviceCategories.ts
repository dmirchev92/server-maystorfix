export const SERVICE_CATEGORIES = [
  { value: 'electrician', label: 'Електротехник', icon: 'zap' },
  { value: 'plumber', label: 'Водопроводчик', icon: 'droplet' },
  { value: 'hvac', label: 'Климатик', icon: 'wind' },
  { value: 'carpenter', label: 'Дърводелец', icon: 'hammer' },
  { value: 'painter', label: 'Бояджия', icon: 'paintbrush' },
  { value: 'locksmith', label: 'Ключар', icon: 'key' },
  { value: 'cleaner', label: 'Почистване', icon: 'sparkles' },
  { value: 'gardener', label: 'Градинар', icon: 'flower' },
  { value: 'handyman', label: 'Майстор за всичко', icon: 'wrench' },
  { value: 'appliance_repair', label: 'Ремонт на уреди', icon: 'settings' },
  { value: 'mason', label: 'Зидар', icon: 'brick' },
  { value: 'roofer', label: 'Покривджия', icon: 'home' },
  { value: 'flooring', label: 'Подови настилки', icon: 'layers' },
  { value: 'welder', label: 'Заварчик', icon: 'flame' },
  { value: 'glazier', label: 'Стъклар', icon: 'square' },
  { value: 'tiler', label: 'Фаянсаджия', icon: 'grid' },
  { value: 'plasterer', label: 'Мазач', icon: 'palette' },
  { value: 'furniture_assembly', label: 'Сглобяване на мебели', icon: 'package' },
  { value: 'moving', label: 'Преместване', icon: 'truck' },
  { value: 'pest_control', label: 'Дезинфекция', icon: 'bug' }
] as const;

export type ServiceCategoryValue = typeof SERVICE_CATEGORIES[number]['value'];
