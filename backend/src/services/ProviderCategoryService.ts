import { v4 as uuidv4 } from 'uuid';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';

export interface ProviderCategory {
  id: string;
  providerId: string;
  categoryId: string;
  createdAt: Date;
}

export class ProviderCategoryService {
  private db: PostgreSQLDatabase;

  constructor(db: PostgreSQLDatabase) {
    this.db = db;
  }

  /**
   * Get all categories for a provider
   */
  async getProviderCategories(providerId: string): Promise<string[]> {
    const result = await this.db.query(
      'SELECT category_id FROM provider_service_categories WHERE provider_id = $1 ORDER BY created_at',
      [providerId]
    );
    return result.map((row: any) => row.category_id);
  }

  /**
   * Add a category to a provider
   * Validates against subscription tier limits
   */
  async addCategory(providerId: string, categoryId: string): Promise<{ success: boolean; message?: string }> {
    try {
      // Get user's subscription tier
      const userResult = await this.db.query(
        'SELECT subscription_tier_id FROM users WHERE id = $1',
        [providerId]
      );

      if (!userResult || userResult.length === 0) {
        return { success: false, message: 'User not found' };
      }

      const tierResult = await this.db.query(
        'SELECT limits FROM subscription_tiers WHERE id = $1',
        [userResult[0].subscription_tier_id]
      );

      if (!tierResult || tierResult.length === 0) {
        return { success: false, message: 'Subscription tier not found' };
      }

      const limits = tierResult[0].limits;
      const maxCategories = limits.max_service_categories || 2;

      // Check current category count
      const currentCategories = await this.getProviderCategories(providerId);

      if (currentCategories.length >= maxCategories) {
        return {
          success: false,
          message: `Вашият план позволява максимум ${maxCategories} специализации. Надстройте плана си за повече.`
        };
      }

      // Check if category already exists
      if (currentCategories.includes(categoryId)) {
        return { success: false, message: 'Тази специализация вече е добавена' };
      }

      // Add the category
      await this.db.query(
        'INSERT INTO provider_service_categories (id, provider_id, category_id, created_at) VALUES ($1, $2, $3, NOW())',
        [uuidv4(), providerId, categoryId]
      );

      return { success: true };
    } catch (error) {
      console.error('Error adding category:', error);
      return { success: false, message: 'Грешка при добавяне на специализация' };
    }
  }

  /**
   * Remove a category from a provider
   */
  async removeCategory(providerId: string, categoryId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const result = await this.db.query(
        'DELETE FROM provider_service_categories WHERE provider_id = $1 AND category_id = $2',
        [providerId, categoryId]
      );

      return { success: true };
    } catch (error) {
      console.error('Error removing category:', error);
      return { success: false, message: 'Грешка при премахване на специализация' };
    }
  }

  /**
   * Set all categories for a provider (replaces existing)
   * Validates against subscription tier limits
   */
  async setCategories(providerId: string, categoryIds: string[]): Promise<{ success: boolean; message?: string }> {
    try {
      // Get user's subscription tier
      const userResult = await this.db.query(
        'SELECT subscription_tier_id FROM users WHERE id = $1',
        [providerId]
      );

      if (!userResult || userResult.length === 0) {
        return { success: false, message: 'User not found' };
      }

      const tierResult = await this.db.query(
        'SELECT limits FROM subscription_tiers WHERE id = $1',
        [userResult[0].subscription_tier_id]
      );

      if (!tierResult || tierResult.length === 0) {
        return { success: false, message: 'Subscription tier not found' };
      }

      const limits = tierResult[0].limits;
      const maxCategories = limits.max_service_categories || 2;

      if (categoryIds.length > maxCategories) {
        return {
          success: false,
          message: `Вашият план позволява максимум ${maxCategories} специализации. Надстройте плана си за повече.`
        };
      }

      // Remove all existing categories
      await this.db.query(
        'DELETE FROM provider_service_categories WHERE provider_id = $1',
        [providerId]
      );

      // Add new categories
      for (const categoryId of categoryIds) {
        await this.db.query(
          'INSERT INTO provider_service_categories (id, provider_id, category_id, created_at) VALUES ($1, $2, $3, NOW())',
          [uuidv4(), providerId, categoryId]
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Error setting categories:', error);
      return { success: false, message: 'Грешка при обновяване на специализации' };
    }
  }
}
