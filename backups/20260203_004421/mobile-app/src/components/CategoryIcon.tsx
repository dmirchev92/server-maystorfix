import React from 'react';
import { Image, ImageSourcePropType } from 'react-native';
import { KeyRound } from 'lucide-react-native';

// Map category keys to custom PNG icons
const CATEGORY_IMAGES: Record<string, ImageSourcePropType> = {
  electrician: require('../../assets/icons/categories/electrician.png'),
  plumber: require('../../assets/icons/categories/plumber.png'),
  hvac: require('../../assets/icons/categories/hvac.png'),
  carpenter: require('../../assets/icons/categories/carpenter.png'),
  painter: require('../../assets/icons/categories/painter.png'),
  locksmith: require('../../assets/icons/categories/locksmith.png'),
  cleaner: require('../../assets/icons/categories/cleaner.png'),
  gardener: require('../../assets/icons/categories/gardener.png'),
  handyman: require('../../assets/icons/categories/handyman.png'),
  renovation: require('../../assets/icons/categories/renovation.png'),
  roofer: require('../../assets/icons/categories/roofer.png'),
  mover: require('../../assets/icons/categories/mover.png'),
  moving: require('../../assets/icons/categories/mover.png'),
  tiler: require('../../assets/icons/categories/tiler.png'),
  welder: require('../../assets/icons/categories/welder.png'),
  appliance: require('../../assets/icons/categories/appliance.png'),
  appliance_repair: require('../../assets/icons/categories/appliance.png'),
  flooring: require('../../assets/icons/categories/flooring.png'),
  plasterer: require('../../assets/icons/categories/plasterer.png'),
  glasswork: require('../../assets/icons/categories/glasswork.png'),
  design: require('../../assets/icons/categories/design.png'),
};

// Normalize category name (remove cat_ prefix, lowercase)
const normalizeCategory = (category: string): string => {
  if (!category) return '';
  return category.toLowerCase().replace('cat_', '');
};

interface CategoryIconProps {
  category: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  size = 24,
  color = '#ffffff',
}) => {
  const normalizedCategory = normalizeCategory(category);
  const imageSource = CATEGORY_IMAGES[normalizedCategory];

  // Use custom image if available
  if (imageSource) {
    return (
      <Image
        source={imageSource}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }

  // Fallback to KeyRound for unknown categories
  return <KeyRound size={size} color={color} strokeWidth={2} />;
};

export default CategoryIcon;
