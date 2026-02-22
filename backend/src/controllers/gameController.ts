/**
 * Game Controller
 * API endpoints for the fighting game gamification feature
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import gameService from '../services/GameService';
import logger from '../utils/logger';

const router = Router();

// ==================== PLAYER ENDPOINTS ====================

/**
 * GET /api/v1/game/player
 * Get or create player profile
 */
router.get(
  '/player',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const player = await gameService.getOrCreatePlayer(userId);

      res.json({
        success: true,
        data: player
      });
    } catch (error: any) {
      logger.error('Failed to get player', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'PLAYER_ERROR', message: error.message || 'Failed to get player' }
      });
    }
  }
);

/**
 * POST /api/v1/game/player/class
 * Change character class
 */
router.post(
  '/player/class',
  authenticateToken,
  [
    body('characterClass')
      .isString()
      .isIn(['warrior', 'mage', 'rogue', 'paladin', 'berserker', 'archer'])
      .withMessage('Invalid character class')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() }
        });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const { characterClass } = req.body;
      const player = await gameService.changeCharacterClass(userId, characterClass);

      res.json({
        success: true,
        data: player
      });
    } catch (error: any) {
      logger.error('Failed to change class', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'CLASS_ERROR', message: error.message || 'Failed to change class' }
      });
    }
  }
);

/**
 * POST /api/v1/game/player/upgrade
 * Upgrade player stats using skill points
 */
router.post(
  '/player/upgrade',
  authenticateToken,
  [
    body('stat')
      .isString()
      .isIn(['strength', 'agility', 'vitality', 'crit_chance', 'crit_damage'])
      .withMessage('Invalid stat name'),
    body('points')
      .isInt({ min: 1, max: 10 })
      .withMessage('Points must be between 1 and 10')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() }
        });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const { stat, points } = req.body;
      const player = await gameService.upgradeStats(userId, stat, points);

      res.json({
        success: true,
        data: player
      });
    } catch (error: any) {
      logger.error('Failed to upgrade stats', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'UPGRADE_ERROR', message: error.message || 'Failed to upgrade stats' }
      });
    }
  }
);

// ==================== BATTLE ENDPOINTS ====================

/**
 * GET /api/v1/game/opponents
 * Get list of available opponents
 */
router.get(
  '/opponents',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const opponents = await gameService.getOpponents(userId);

      res.json({
        success: true,
        data: opponents
      });
    } catch (error: any) {
      logger.error('Failed to get opponents', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'OPPONENTS_ERROR', message: error.message || 'Failed to get opponents' }
      });
    }
  }
);

/**
 * POST /api/v1/game/battle/start
 * Start a battle with an opponent
 */
router.post(
  '/battle/start',
  authenticateToken,
  [
    body('opponentId')
      .isInt()
      .withMessage('Opponent ID must be a number')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() }
        });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const { opponentId } = req.body;
      const battleData = await gameService.startBattle(userId, opponentId);

      res.json({
        success: true,
        data: battleData
      });
    } catch (error: any) {
      logger.error('Failed to start battle', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'BATTLE_ERROR', message: error.message || 'Failed to start battle' }
      });
    }
  }
);

/**
 * POST /api/v1/game/battle/action
 * Perform a battle action (attack, defend, special)
 */
router.post(
  '/battle/action',
  authenticateToken,
  [
    body('action')
      .isString()
      .isIn(['attack', 'defend', 'special'])
      .withMessage('Invalid action'),
    body('battleData')
      .isObject()
      .withMessage('Battle data is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() }
        });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const { action, battleData } = req.body;
      const result = await gameService.performAction(userId, battleData, action);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      logger.error('Failed to perform action', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'ACTION_ERROR', message: error.message || 'Failed to perform action' }
      });
    }
  }
);

/**
 * POST /api/v1/game/battle/end
 * End a battle and receive rewards
 */
router.post(
  '/battle/end',
  authenticateToken,
  [
    body('battleData')
      .isObject()
      .withMessage('Battle data is required')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() }
        });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const { battleData } = req.body;
      const result = await gameService.endBattle(userId, battleData);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      logger.error('Failed to end battle', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'END_BATTLE_ERROR', message: error.message || 'Failed to end battle' }
      });
    }
  }
);

// ==================== QUEST ENDPOINTS ====================

/**
 * GET /api/v1/game/quests
 * Get all quests and progress
 */
router.get(
  '/quests',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const quests = await gameService.getQuests(userId);

      res.json({
        success: true,
        data: quests
      });
    } catch (error: any) {
      logger.error('Failed to get quests', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'QUESTS_ERROR', message: error.message || 'Failed to get quests' }
      });
    }
  }
);

/**
 * POST /api/v1/game/quests/:questId/claim
 * Claim a completed quest reward
 */
router.post(
  '/quests/:questId/claim',
  authenticateToken,
  [
    param('questId')
      .isInt()
      .withMessage('Quest ID must be a number')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() }
        });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const questId = parseInt(req.params.questId);
      const reward = await gameService.claimQuestReward(userId, questId);

      res.json({
        success: true,
        data: reward
      });
    } catch (error: any) {
      logger.error('Failed to claim quest', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'CLAIM_ERROR', message: error.message || 'Failed to claim quest' }
      });
    }
  }
);

// ==================== ACHIEVEMENT ENDPOINTS ====================

/**
 * GET /api/v1/game/achievements
 * Get all achievements and progress
 */
router.get(
  '/achievements',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const achievements = await gameService.getAchievements(userId);

      res.json({
        success: true,
        data: achievements
      });
    } catch (error: any) {
      logger.error('Failed to get achievements', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'ACHIEVEMENTS_ERROR', message: error.message || 'Failed to get achievements' }
      });
    }
  }
);

// ==================== INVENTORY ENDPOINTS ====================

/**
 * GET /api/v1/game/inventory
 * Get player inventory and equipped items
 */
router.get(
  '/inventory',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const inventory = await gameService.getInventory(userId);

      res.json({
        success: true,
        data: inventory
      });
    } catch (error: any) {
      logger.error('Failed to get inventory', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'INVENTORY_ERROR', message: error.message || 'Failed to get inventory' }
      });
    }
  }
);

/**
 * POST /api/v1/game/inventory/equip
 * Equip an item
 */
router.post(
  '/inventory/equip',
  authenticateToken,
  [
    body('itemId')
      .isInt()
      .withMessage('Item ID must be a number')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() }
        });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const { itemId } = req.body;
      const inventory = await gameService.equipItem(userId, itemId);

      res.json({
        success: true,
        data: inventory
      });
    } catch (error: any) {
      logger.error('Failed to equip item', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'EQUIP_ERROR', message: error.message || 'Failed to equip item' }
      });
    }
  }
);

/**
 * POST /api/v1/game/inventory/unequip
 * Unequip an item
 */
router.post(
  '/inventory/unequip',
  authenticateToken,
  [
    body('itemId')
      .isInt()
      .withMessage('Item ID must be a number')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() }
        });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const { itemId } = req.body;
      const inventory = await gameService.unequipItem(userId, itemId);

      res.json({
        success: true,
        data: inventory
      });
    } catch (error: any) {
      logger.error('Failed to unequip item', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'UNEQUIP_ERROR', message: error.message || 'Failed to unequip item' }
      });
    }
  }
);

// ==================== SHOP ENDPOINTS ====================

/**
 * GET /api/v1/game/shop
 * Get available shop items
 */
router.get(
  '/shop',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const items = await gameService.getShopItems(userId);

      res.json({
        success: true,
        data: items
      });
    } catch (error: any) {
      logger.error('Failed to get shop', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'SHOP_ERROR', message: error.message || 'Failed to get shop' }
      });
    }
  }
);

/**
 * POST /api/v1/game/shop/purchase
 * Purchase an item from the shop
 */
router.post(
  '/shop/purchase',
  authenticateToken,
  [
    body('itemId')
      .isInt()
      .withMessage('Item ID must be a number')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() }
        });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const { itemId } = req.body;
      const result = await gameService.purchaseItem(userId, itemId);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      logger.error('Failed to purchase item', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'PURCHASE_ERROR', message: error.message || 'Failed to purchase item' }
      });
    }
  }
);

// ==================== DAILY REWARD ENDPOINTS ====================

/**
 * POST /api/v1/game/daily/claim
 * Claim daily login reward
 */
router.post(
  '/daily/claim',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
        });
      }

      const reward = await gameService.claimDailyReward(userId);

      res.json({
        success: true,
        data: reward
      });
    } catch (error: any) {
      logger.error('Failed to claim daily reward', { error });
      res.status(error.statusCode || 500).json({
        success: false,
        error: { code: error.code || 'DAILY_ERROR', message: error.message || 'Failed to claim daily reward' }
      });
    }
  }
);

/**
 * GET /api/v1/game/settings
 * Get game settings (for real-time configuration)
 */
router.get(
  '/settings',
  async (req: Request, res: Response) => {
    try {
      const settings = await gameService.getGameSettings();
      res.json({
        success: true,
        data: settings
      });
    } catch (error: any) {
      logger.error('Failed to get game settings', { error });
      res.status(500).json({
        success: false,
        error: { code: 'SETTINGS_ERROR', message: 'Failed to get game settings' }
      });
    }
  }
);

export default router;
