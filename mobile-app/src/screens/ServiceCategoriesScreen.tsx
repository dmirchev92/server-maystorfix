import { Logger } from '../utils/Logger';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { SERVICE_CATEGORIES } from '../constants/serviceCategories';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ServiceCategoriesScreen: React.FC = () => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [maxCategories, setMaxCategories] = useState(2);
  const [userTier, setUserTier] = useState('free');

  useEffect(() => {
    loadCategories();
    loadUserTier();
  }, []);

  const loadUserTier = async () => {
    try {
      const userDataStr = await AsyncStorage.getItem('user');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        const tier = userData.subscription_tier_id || userData.subscriptionTierId || 'free';
        setUserTier(tier);
        
        const limits: Record<string, number> = {
          'free': 999,
          'normal': 2,
          'pro': 999
        };
        setMaxCategories(limits[tier] || 2);
      }
    } catch (error) {
      Logger.error('Error loading user tier:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Грешка', 'Моля, влезте отново');
        return;
      }

      const response = await fetch(
        'https://snapfix.bg/api/v1/provider/categories',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();
      if (data.success && data.categories) {
        // API returns objects {category_id, category_label_bg, ...} - extract string IDs
        const catIds = data.categories.map((c: any) => 
          typeof c === 'string' ? c : (c.category_id || c.id || String(c))
        );
        setSelectedCategories(catIds);
      }
    } catch (error) {
      Logger.error('Error loading categories:', error);
      Alert.alert('Грешка', 'Неуспешно зареждане на специализациите');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = async (categoryId: string) => {
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
          `Вашият план позволява максимум ${maxCategories} специализации. Надстройте плана си за повече.`,
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Виж планове', onPress: () => {/* Navigate to subscription */} }
          ]
        );
        return;
      }
      
      // Add
      const newCategories = [...selectedCategories, categoryId];
      await saveCategories(newCategories);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
    await loadUserTier();
    setRefreshing(false);
  };

  const saveCategories = async (categories: string[]) => {
    setSaving(true);

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Грешка', 'Моля, влезте отново');
        return;
      }

      const response = await fetch(
        'https://snapfix.bg/api/v1/provider/categories',
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ categoryIds: categories })
        }
      );

      const data = await response.json();
      if (data.success) {
        setSelectedCategories(categories);
        Alert.alert('Успех', '✅ Специализациите са обновени!\n\nПромените са синхронизирани с уеб версията.');
      } else {
        Alert.alert('Грешка', data.message || 'Неуспешно обновяване');
      }
    } catch (error) {
      Logger.error('Error saving categories:', error);
      Alert.alert('Грешка', 'Неуспешно обновяване на специализациите');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Зареждане...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
            title="Синхронизиране..."
            titleColor="#cbd5e1"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🔧 Специализации</Text>
          <Text style={styles.subtitle}>
            Изберете услугите, които предлагате
          </Text>
          <Text style={styles.counter}>
            {selectedCategories.length}/{maxCategories === 999 ? '∞' : maxCategories} избрани
          </Text>
        </View>

        {/* Upgrade Notice for FREE users */}
        {userTier === 'free' && (
          <View style={styles.upgradeNotice}>
            <Text style={styles.upgradeNoticeText}>
              💡 Надстройте до NORMAL (5 специализации) или PRO (неограничено) за повече възможности
            </Text>
          </View>
        )}

        {/* Categories Grid */}
        <View style={styles.categoriesGrid}>
          {SERVICE_CATEGORIES.map((category) => {
            const isSelected = selectedCategories.includes(category.value);
            const isDisabled = !isSelected && selectedCategories.length >= maxCategories;

            return (
              <TouchableOpacity
                key={category.value}
                onPress={() => !isDisabled && !saving && toggleCategory(category.value)}
                disabled={isDisabled || saving}
                style={[
                  styles.categoryCard,
                  isSelected && styles.categoryCardSelected,
                  isDisabled && styles.categoryCardDisabled
                ]}
              >
                <Text style={[
                  styles.categoryLabel,
                  isSelected && styles.categoryLabelSelected,
                  isDisabled && styles.categoryLabelDisabled
                ]}>
                  {category.label}
                </Text>
                {isSelected && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            <Text style={styles.infoTextBold}>Важно:</Text> Избраните специализации ще се показват на вашия профил и ще помогнат на клиентите да ви намерят по-лесно.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#cbd5e1',
  },
  header: {
    padding: 20,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  counter: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  upgradeNotice: {
    margin: 16,
    padding: 12,
    backgroundColor: '#fbbf2420',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbbf2440',
  },
  upgradeNoticeText: {
    fontSize: 12,
    color: '#fbbf24',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  categoryCard: {
    width: '47%',
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
    minHeight: 60,
    justifyContent: 'center',
  },
  categoryCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f120',
  },
  categoryCardDisabled: {
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
    opacity: 0.5,
  },
  categoryLabel: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  categoryLabelSelected: {
    color: '#6366f1',
    fontWeight: 'bold',
  },
  categoryLabelDisabled: {
    color: '#64748b',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 16,
    color: '#6366f1',
  },
  infoBox: {
    margin: 16,
    padding: 16,
    backgroundColor: '#3b82f620',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f640',
  },
  infoText: {
    fontSize: 13,
    color: '#93c5fd',
    lineHeight: 20,
  },
  infoTextBold: {
    fontWeight: 'bold',
  },
});

export default ServiceCategoriesScreen;
