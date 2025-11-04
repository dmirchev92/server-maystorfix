import { Request, Response } from 'express';
import { ProviderCategoryService } from '../services/ProviderCategoryService';
import { DatabaseFactory } from '../models/DatabaseFactory';

const db = DatabaseFactory.getDatabase();
const providerCategoryService = new ProviderCategoryService(db as any);

/**
 * GET /api/v1/provider/categories
 * Get all categories for the authenticated provider
 */
export const getProviderCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const categories = await providerCategoryService.getProviderCategories(userId);

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error getting provider categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get categories'
    });
  }
};

/**
 * POST /api/v1/provider/categories
 * Add a category to the authenticated provider
 */
export const addProviderCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { categoryId } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!categoryId) {
      res.status(400).json({ success: false, error: 'Category ID is required' });
      return;
    }

    const result = await providerCategoryService.addCategory(userId, categoryId);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Error adding provider category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add category'
    });
  }
};

/**
 * DELETE /api/v1/provider/categories/:categoryId
 * Remove a category from the authenticated provider
 */
export const removeProviderCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { categoryId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const result = await providerCategoryService.removeCategory(userId, categoryId);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Error removing provider category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove category'
    });
  }
};

/**
 * PUT /api/v1/provider/categories
 * Set all categories for the authenticated provider (replaces existing)
 */
export const setProviderCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { categoryIds } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!Array.isArray(categoryIds)) {
      res.status(400).json({ success: false, error: 'Category IDs must be an array' });
      return;
    }

    const result = await providerCategoryService.setCategories(userId, categoryIds);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Error setting provider categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set categories'
    });
  }
};
