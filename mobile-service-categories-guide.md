# Service Categories Management - Mobile App Integration Guide

## API Endpoints Available

The backend is ready with these endpoints:

### 1. Get Provider Categories
```
GET /api/v1/provider/categories
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "categories": ["electrician", "plumber", "hvac"]
}
```

### 2. Add Category
```
POST /api/v1/provider/categories
Headers: Authorization: Bearer {token}
Body: { "categoryId": "electrician" }

Response:
{
  "success": true
}
OR
{
  "success": false,
  "message": "Вашият план позволява максимум 2 специализации..."
}
```

### 3. Remove Category
```
DELETE /api/v1/provider/categories/:categoryId
Headers: Authorization: Bearer {token}

Response:
{
  "success": true
}
```

### 4. Set All Categories (Replace)
```
PUT /api/v1/provider/categories
Headers: Authorization: Bearer {token}
Body: { "categoryIds": ["electrician", "plumber"] }

Response:
{
  "success": true
}
OR
{
  "success": false,
  "message": "Вашият план позволява максимум 2 специализации..."
}
```

## Service Categories List

Use this constant in your mobile app:

```javascript
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
];
```

## Tier Limits

- **FREE**: 2 categories maximum
- **NORMAL**: 5 categories maximum  
- **PRO**: 999 categories (unlimited)

## Mobile App Implementation Example (React Native)

```jsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SERVICE_CATEGORIES } from './constants';

export default function ServiceCategoryScreen({ user, authToken }) {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [maxCategories, setMaxCategories] = useState(2);

  useEffect(() => {
    loadCategories();
    loadTierLimits();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch(
        'https://maystorfix.com/api/v1/provider/categories',
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setSelectedCategories(data.categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTierLimits = () => {
    const tier = user?.subscription_tier_id || 'free';
    const limits = { 'free': 2, 'normal': 5, 'pro': 999 };
    setMaxCategories(limits[tier] || 2);
  };

  const toggleCategory = async (categoryId) => {
    const isSelected = selectedCategories.includes(categoryId);
    
    if (isSelected) {
      // Remove
      const newCategories = selectedCategories.filter(c => c !== categoryId);
      await saveCategories(newCategories);
    } else {
      // Check limit
      if (selectedCategories.length >= maxCategories) {
        Alert.alert(
          'Лимит достигнат',
          `Вашият план позволява максимум ${maxCategories} специализации. Надстройте плана си за повече.`
        );
        return;
      }
      
      // Add
      const newCategories = [...selectedCategories, categoryId];
      await saveCategories(newCategories);
    }
  };

  const saveCategories = async (categories) => {
    try {
      const response = await fetch(
        'https://maystorfix.com/api/v1/provider/categories',
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ categoryIds: categories })
        }
      );

      const data = await response.json();
      if (data.success) {
        setSelectedCategories(categories);
        Alert.alert('Успех', 'Специализациите са обновени!');
      } else {
        Alert.alert('Грешка', data.message);
      }
    } catch (error) {
      Alert.alert('Грешка', 'Неуспешно обновяване на специализациите');
    }
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
        🔧 Специализации
      </Text>
      <Text style={{ marginBottom: 16 }}>
        Изберете услугите, които предлагате ({selectedCategories.length}/{maxCategories === 999 ? '∞' : maxCategories})
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SERVICE_CATEGORIES.map((category) => {
          const isSelected = selectedCategories.includes(category.value);
          const isDisabled = !isSelected && selectedCategories.length >= maxCategories;

          return (
            <TouchableOpacity
              key={category.value}
              onPress={() => !isDisabled && toggleCategory(category.value)}
              disabled={isDisabled}
              style={{
                padding: 12,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: isSelected ? '#6366f1' : isDisabled ? '#374151' : '#4b5563',
                backgroundColor: isSelected ? '#6366f120' : isDisabled ? '#37415110' : '#4b556310',
                opacity: isDisabled ? 0.5 : 1,
                minWidth: '45%'
              }}
            >
              <Text style={{ 
                color: isSelected ? '#6366f1' : isDisabled ? '#6b7280' : '#fff',
                fontWeight: isSelected ? 'bold' : 'normal'
              }}>
                {category.label} {isSelected && '✓'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
```

## Where to Add in Mobile App

Add a new screen/section in:
1. **Settings/Profile Screen** - Main place for users to manage categories
2. **Registration Flow** - Allow selecting categories during signup (optional)

## Database Schema

The backend uses this table:
```sql
CREATE TABLE provider_service_categories (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES users(id),
    category_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider_id, category_id)
);
```

## Notes

- Categories are validated against subscription tier limits on the backend
- The old `service_category` field in `service_provider_profiles` is kept for backward compatibility
- Multiple categories are now supported via the junction table
- All existing providers have been migrated to the new system
