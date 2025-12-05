/**
 * Clean formatted address by removing postal code, city name, and country from the end.
 * Example: "Ж.К Илинден, ул конжовица 65, 1309 София, България" -> "Ж.К Илинден, ул конжовица 65"
 */
export const cleanFormattedAddress = (address: string | undefined, city?: string): string => {
  if (!address) return '';
  
  let cleaned = address;
  
  // Remove ", България" or "България" at the end
  cleaned = cleaned.replace(/,?\s*България\s*$/i, '');
  
  // Remove city name at the end if it matches the case's city
  if (city) {
    const cityPattern = new RegExp(`,?\\s*${city}\\s*$`, 'i');
    cleaned = cleaned.replace(cityPattern, '');
  }
  
  // Remove common Bulgarian city names at the end
  cleaned = cleaned.replace(/,?\s*(София|Пловдив|Варна|Бургас|Русе|Стара Загора|Плевен|Сливен|Добрич|Шумен)\s*$/i, '');
  
  // Remove postal code (4 digits) at the end or before city
  cleaned = cleaned.replace(/,?\s*\d{4}\s*$/g, '');
  cleaned = cleaned.replace(/,?\s*\d{4}\s*,/g, ',');
  
  // Clean up any trailing commas or extra spaces
  cleaned = cleaned.replace(/,\s*$/, '').trim();
  
  return cleaned;
};

/**
 * Format a full address combining city and cleaned street address
 */
export const formatFullAddress = (city?: string, formattedAddress?: string): string => {
  const cleanedAddress = cleanFormattedAddress(formattedAddress, city);
  
  if (city && cleanedAddress) {
    return `${city}, ${cleanedAddress}`;
  }
  
  return city || cleanedAddress || '';
};
