'use client'

import Image from 'next/image'
import { Key } from 'lucide-react'

// Map category keys to custom PNG icon paths
const CATEGORY_IMAGES: Record<string, string> = {
  electrician: '/icons/categories/electrician.png',
  plumber: '/icons/categories/plumber.png',
  hvac: '/icons/categories/hvac.png',
  carpenter: '/icons/categories/carpenter.png',
  painter: '/icons/categories/painter.png',
  locksmith: '/icons/categories/locksmith.png',
  cleaner: '/icons/categories/cleaner.png',
  gardener: '/icons/categories/gardener.png',
  handyman: '/icons/categories/handyman.png',
  renovation: '/icons/categories/renovation.png',
  roofer: '/icons/categories/roofer.png',
  mover: '/icons/categories/mover.png',
  moving: '/icons/categories/mover.png',
  tiler: '/icons/categories/tiler.png',
  welder: '/icons/categories/welder.png',
  appliance: '/icons/categories/appliance.png',
  appliance_repair: '/icons/categories/appliance.png',
  flooring: '/icons/categories/flooring.png',
  plasterer: '/icons/categories/plasterer.png',
  glasswork: '/icons/categories/glasswork.png',
  design: '/icons/categories/design.png',
}

// Normalize category name (remove cat_ prefix, lowercase)
const normalizeCategory = (category: string): string => {
  if (!category) return ''
  return category.toLowerCase().replace('cat_', '')
}

interface CategoryIconProps {
  category: string
  size?: number
  className?: string
}

export function CategoryIcon({ category, size = 32, className = '' }: CategoryIconProps) {
  const normalizedCategory = normalizeCategory(category)
  const imagePath = CATEGORY_IMAGES[normalizedCategory]

  // Use custom image if available
  if (imagePath) {
    return (
      <Image
        src={imagePath}
        alt={normalizedCategory}
        width={size}
        height={size}
        className={className}
      />
    )
  }

  // Fallback to Key icon for unknown categories
  return <Key size={size} className={className} />
}

export default CategoryIcon
