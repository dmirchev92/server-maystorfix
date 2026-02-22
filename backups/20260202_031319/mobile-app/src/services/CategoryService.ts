import ApiService from './ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Category {
  id: string;
  value: string;
  label: string;
  name_en?: string;
  icon?: string;
  description?: string;
}

const CACHE_KEY = 'service_categories';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

class CategoryService {
  private static instance: CategoryService;
  private categories: Category[] = [];
  private lastFetch: number = 0;
  private loading: Promise<Category[]> | null = null;

  private constructor() {}

  static getInstance(): CategoryService {
    if (!CategoryService.instance) {
      CategoryService.instance = new CategoryService();
    }
    return CategoryService.instance;
  }

  /**
   * Get categories - fetches from API or returns cached data
   */
  async getCategories(forceRefresh = false): Promise<Category[]> {
    // Return cached if valid and not forcing refresh
    if (!forceRefresh && this.categories.length > 0 && Date.now() - this.lastFetch < CACHE_DURATION) {
      return this.categories;
    }

    // If already loading, wait for that request
    if (this.loading) {
      return this.loading;
    }

    this.loading = this.fetchCategories();
    try {
      const result = await this.loading;
      return result;
    } finally {
      this.loading = null;
    }
  }

  private async fetchCategories(): Promise<Category[]> {
    try {
      // Try to get from API
      const response = await ApiService.getInstance().getServiceCategories();
      
      if (response.success && response.data && response.data.length > 0) {
        this.categories = response.data;
        this.lastFetch = Date.now();
        
        // Cache to AsyncStorage
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
          categories: this.categories,
          timestamp: this.lastFetch
        }));
        
        console.log('📂 Categories fetched from API:', this.categories.length);
        return this.categories;
      }
    } catch (error) {
      console.error('❌ Error fetching categories from API:', error);
    }

    // Fallback to cached data
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { categories, timestamp } = JSON.parse(cached);
        this.categories = categories;
        this.lastFetch = timestamp;
        console.log('📂 Categories loaded from cache:', this.categories.length);
        return this.categories;
      }
    } catch (error) {
      console.error('❌ Error loading cached categories:', error);
    }

    // Final fallback to hardcoded defaults
    console.log('📂 Using default hardcoded categories');
    return this.getDefaultCategories();
  }

  /**
   * Get category label by id or value
   */
  async getCategoryLabel(categoryId: string): Promise<string> {
    const categories = await this.getCategories();
    const found = categories.find(c => 
      c.id === categoryId || 
      c.value === categoryId ||
      c.id === categoryId.replace('cat_', '') ||
      c.value === `cat_${categoryId}`
    );
    return found?.label || categoryId;
  }

  /**
   * Get categories synchronously (returns cached or defaults)
   */
  getCategoriesSync(): Category[] {
    if (this.categories.length > 0) {
      return this.categories;
    }
    return this.getDefaultCategories();
  }

  /**
   * Default hardcoded categories as fallback
   */
  private getDefaultCategories(): Category[] {
    return [
      { id: 'electrician', value: 'cat_electrician', label: 'Електротехник' },
      { id: 'plumber', value: 'cat_plumber', label: 'Водопроводчик' },
      { id: 'hvac', value: 'cat_hvac', label: 'Отопление и климатизация' },
      { id: 'carpenter', value: 'cat_carpenter', label: 'Дърводелец' },
      { id: 'painter', value: 'cat_painter', label: 'Бояджия' },
      { id: 'locksmith', value: 'cat_locksmith', label: 'Ключар' },
      { id: 'cleaner', value: 'cat_cleaner', label: 'Почистване' },
      { id: 'gardener', value: 'cat_gardener', label: 'Градинар' },
      { id: 'handyman', value: 'cat_handyman', label: 'Дребни ремонти' },
      { id: 'renovation', value: 'cat_renovation', label: 'Цялостни ремонти' },
      { id: 'roofer', value: 'cat_roofer', label: 'Ремонт на покриви' },
      { id: 'mover', value: 'cat_mover', label: 'Хамалски услуги' },
      { id: 'tiler', value: 'cat_tiler', label: 'Майстор Фаянс' },
      { id: 'welder', value: 'cat_welder', label: 'Заварчик' },
      { id: 'appliance', value: 'cat_appliance', label: 'Ремонт на уреди' },
      { id: 'flooring', value: 'cat_flooring', label: 'Подови настилки' },
      { id: 'plasterer', value: 'cat_plasterer', label: 'Шпакловане' },
      { id: 'glasswork', value: 'cat_glasswork', label: 'Стъкларски услуги' },
      { id: 'design', value: 'cat_design', label: 'Дизайн' },
    ];
  }

  /**
   * Preload categories on app start
   */
  async preload(): Promise<void> {
    await this.getCategories();
  }
}

export default CategoryService;
