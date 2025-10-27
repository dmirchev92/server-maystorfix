import { Request, Response } from 'express';
import { DatabaseFactory } from '../models/DatabaseFactory';
import logger from '../utils/logger';

const db = DatabaseFactory.getDatabase();

/**
 * Get CRM dashboard data
 */
export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    // For now, return basic dashboard data
    res.json({
      success: true,
      data: {
        totalCustomers: 0,
        totalCases: 0,
        activeCases: 0,
        completedCases: 0,
        message: 'CRM dashboard - coming soon'
      }
    });
  } catch (error) {
    logger.error('❌ Error fetching CRM dashboard:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch CRM dashboard'
      }
    });
  }
};

/**
 * Get customer list
 */
export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const customers = await new Promise<any[]>((resolve, reject) => {
      db.db.all(
        `SELECT DISTINCT customer_name, customer_email, customer_phone, created_at
         FROM marketplace_conversations 
         ORDER BY created_at DESC`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });

    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    logger.error('❌ Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch customers'
      }
    });
  }
};

/**
 * Get case statistics
 */
export const getCaseStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await new Promise<any>((resolve, reject) => {
      db.db.get(
        `SELECT 
          COUNT(*) as total_cases,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_cases,
          SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_cases,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_cases,
          SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined_cases
         FROM marketplace_service_cases`,
        [],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row || {});
          }
        }
      );
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('❌ Error fetching case stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch case statistics'
      }
    });
  }
};