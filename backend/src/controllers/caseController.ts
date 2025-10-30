// @ts-nocheck
import { Request, Response } from 'express';
import { DatabaseFactory } from '../models/DatabaseFactory';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import SmartMatchingService from '../services/SmartMatchingService';
import NotificationService from '../services/NotificationService';
import { getIO } from '../server';

const db = DatabaseFactory.getDatabase();

// Get NotificationService instance with Socket.IO
function getNotificationService(): NotificationService {
  const notificationService = new NotificationService();
  try {
    const io = getIO();
    notificationService.setSocketIO(io);
  } catch (error) {
    logger.warn('⚠️ Socket.IO not available for NotificationService');
  }
  return notificationService;
}

/**
 * Create a new service case
 */
export const createCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      serviceType,
      description,
      preferredDate,
      preferredTime,
      priority,
      city,
      neighborhood,
      address,
      phone,
      additionalDetails,
      providerId,
      providerName,
      isOpenCase,
      assignmentType,
      screenshots,
      customerId,
      category
    } = req.body;

    // Log case creation details for debugging
    logger.info('📝 Creating case with data:', {
      customerId,
      providerId,
      assignmentType,
      hasCustomerId: !!customerId
    });

    // Validate required fields
    if (!serviceType || !description || !phone || !city) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Missing required fields: serviceType, description, phone, city'
        }
      });
      return;
    }

    // Prevent Service Providers from creating cases for themselves
    if (customerId && providerId && customerId === providerId) {
      logger.warn('⚠️ Service Provider attempted to create case for themselves:', {
        userId: customerId,
        providerId
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Service Providers cannot create cases for themselves'
        }
      });
      return;
    }

    const caseId = uuidv4();
    const now = new Date().toISOString();

    // Create the case record - Use database abstraction
    if (DatabaseFactory.isPostgreSQL()) {
      // PostgreSQL syntax
      await (db as any).query(
        `INSERT INTO marketplace_service_cases (
          id, service_type, description, preferred_date, preferred_time,
          priority, city, neighborhood, phone, additional_details, provider_id,
          provider_name, is_open_case, assignment_type, status,
          customer_id, category, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          caseId,
          serviceType,
          description,
          preferredDate,
          preferredTime || 'morning',
          priority || 'normal',
          city,
          neighborhood,
          phone,
          additionalDetails,
          assignmentType === 'specific' ? providerId : null,
          assignmentType === 'specific' ? providerName : null,
          assignmentType === 'open' ? 1 : 0,
          assignmentType || 'open',
          'pending',
          customerId,
          category || serviceType || 'general',
          now,
          now
        ]
      );
    } else {
      // SQLite syntax
      await new Promise<void>((resolve, reject) => {
        (db as any).db.run(
          `INSERT INTO marketplace_service_cases (
            id, service_type, description, preferred_date, preferred_time,
            priority, city, neighborhood, phone, additional_details, provider_id,
            provider_name, is_open_case, assignment_type, status,
            customer_id, category, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            caseId,
            serviceType,
            description,
            preferredDate,
            preferredTime || 'morning',
            priority || 'normal',
            city,
            neighborhood,
            phone,
            additionalDetails,
            assignmentType === 'specific' ? providerId : null,
            assignmentType === 'specific' ? providerName : null,
            assignmentType === 'open' ? 1 : 0,
            assignmentType || 'open',
            'pending',
            customerId,
            category || serviceType || 'general',
            now,
            now
          ],
          function(err: any) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
    }

    // Handle screenshots if provided
    if (screenshots && screenshots.length > 0) {
      for (const screenshot of screenshots) {
        // Skip screenshots without a valid URL
        const imageUrl = screenshot.url || screenshot.name || screenshot;
        if (!imageUrl || typeof imageUrl !== 'string') {
          continue;
        }

        const screenshotId = uuidv4();
        if (DatabaseFactory.isPostgreSQL()) {
          await (db as any).query(
            `INSERT INTO case_screenshots (id, case_id, image_url, created_at) VALUES ($1, $2, $3, $4)`,
            [screenshotId, caseId, imageUrl, now]
          );
        } else {
          await new Promise<void>((resolve, reject) => {
            (db as any).db.run(
              `INSERT INTO case_screenshots (id, case_id, image_url, created_at) VALUES (?, ?, ?, ?)`,
              [screenshotId, caseId, imageUrl, now],
              function(err: any) {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              }
            );
          });
        }
      }
    }

    // Send notification to SP if case is directly assigned to them
    if (assignmentType === 'specific' && providerId) {
      logger.info('🔔 Creating notification for directly assigned SP', { providerId, caseId });
      try {
        const notificationService = getNotificationService();
        await notificationService.createNotification(
          providerId,
          'case_assigned',
          'Нова заявка директно възложена',
          `Клиент ви възложи нова заявка: ${description.substring(0, 50)}...`,
          { caseId, action: 'view_case', customerName: 'Direct Assignment', serviceType, description, priority: priority || 'medium' }
        );
        logger.info('✅ Notification sent to SP for direct assignment', { providerId, caseId });
      } catch (notifError) {
        logger.error('❌ Error sending notification to SP:', notifError);
      }
    }

    logger.info('✅ Service case created successfully', { caseId, serviceType, assignmentType });

    res.status(201).json({
      success: true,
      data: {
        caseId,
        message: assignmentType === 'specific' 
          ? `Case assigned to ${providerName}` 
          : 'Case created and available to all providers'
      }
    });

  } catch (error) {
    logger.error('❌ Error creating service case:', error);
    logger.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      errorObject: error
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create service case',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
};

/**
 * Get cases for a specific provider
 */
export const getProviderCases = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;

    if (!providerId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Provider ID is required'
        }
      });
      return;
    }

    const cases = await db.query(
      `SELECT * FROM marketplace_service_cases 
       WHERE provider_id = $1 OR is_open_case = 1 
       ORDER BY created_at DESC`,
      [providerId]
    );

    res.json({
      success: true,
      data: cases
    });

  } catch (error) {
    logger.error('❌ Error fetching provider cases:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch cases'
      }
    });
  }
};

/**
 * Accept a case
 */
export const acceptCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { providerId, providerName } = req.body;

    if (!caseId || !providerId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Case ID and Provider ID are required'
        }
      });
      return;
    }

    const now = new Date().toISOString();

    await db.query(
      `UPDATE marketplace_service_cases 
       SET status = 'accepted', provider_id = $1, provider_name = $2, updated_at = $3
       WHERE id = $4 AND status = 'pending'`,
      [providerId, providerName, now, caseId]
    );

    // Get case details for notification
    const caseDetailsResult = await db.query(
      'SELECT customer_id FROM marketplace_service_cases WHERE id = $1',
      [caseId]
    );
    const caseDetails = caseDetailsResult[0];

    // Send notification to customer that their case was accepted
    logger.info('📧 Checking if should send notification to customer:', { 
      hasCustomerId: !!caseDetails?.customer_id,
      customerId: caseDetails?.customer_id,
      caseId,
      providerId
    });
    
    if (caseDetails?.customer_id) {
      logger.info('📧 Sending case accepted notification to customer');
      const notificationService = getNotificationService();
      await notificationService.notifyCaseAssigned(
        caseId,
        caseDetails.customer_id,
        providerId,
        providerName
      );
      logger.info('✅ Case accepted notification sent to customer');
    } else {
      logger.warn('⚠️ Cannot send notification - customer_id is missing from case');
    }

    logger.info('✅ Case accepted successfully', { caseId, providerId });

    res.json({
      success: true,
      data: {
        message: 'Case accepted successfully'
      }
    });

  } catch (error) {
    logger.error('❌ Error accepting case:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to accept case'
      }
    });
  }
};

/**
 * Decline a case - tracks provider-specific declines
 */
export const declineCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { reason, providerId } = req.body;

    if (!caseId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Case ID is required'
        }
      });
      return;
    }

    // Get provider ID from authenticated user if not provided
    const actualProviderId = providerId || (req as any).user?.id;

    if (!actualProviderId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Provider ID is required'
        }
      });
      return;
    }

    const now = new Date().toISOString();
    const declineId = require('uuid').v4();

    // Check if this provider already declined this case
    const existingDeclineResult = await db.query(
      'SELECT * FROM case_declines WHERE case_id = $1 AND provider_id = $2',
      [caseId, actualProviderId]
    );
    const existingDecline = existingDeclineResult[0];

    if (existingDecline) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_DECLINED',
          message: 'You have already declined this case'
        }
      });
      return;
    }

    // Get the case details
    const caseDetailsResult = await db.query(
      'SELECT * FROM marketplace_service_cases WHERE id = $1',
      [caseId]
    );
    const caseDetails = caseDetailsResult[0];

    if (!caseDetails) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CASE_NOT_FOUND',
          message: 'Case not found'
        }
      });
      return;
    }

    // Record the decline for this specific provider
    await db.query(
      `INSERT INTO case_declines (id, case_id, provider_id, reason, declined_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [declineId, caseId, actualProviderId, reason, now]
    );

    // If case was assigned to this provider, unassign it and return to queue
    if (caseDetails.provider_id === actualProviderId) {
      await db.query(
        `UPDATE marketplace_service_cases 
         SET provider_id = NULL, status = 'pending', updated_at = $1
         WHERE id = $2`,
        [now, caseId]
      );
      logger.info('✅ Case unassigned and returned to queue', { caseId, providerId: actualProviderId });
    }

    // Send notification to customer if case was assigned to this provider
    if (caseDetails.provider_id === actualProviderId && caseDetails.customer_id) {
      try {
        await notificationService.createNotification(
          caseDetails.customer_id,
          'case_declined',
          'Заявката е отказана',
          `Специалистът отказа вашата заявка${reason ? ': ' + reason : ''}. Заявката е върната в опашката за други специалисти.`,
          { caseId, providerId: actualProviderId, reason }
        );
        logger.info('✅ Decline notification sent to customer');
      } catch (notifError) {
        logger.error('❌ Error sending decline notification:', notifError);
      }
    }

    logger.info('✅ Case declined by provider', { caseId, providerId: actualProviderId, reason });

    res.json({
      success: true,
      data: {
        message: 'Case declined successfully',
        returnedToQueue: caseDetails.provider_id === actualProviderId
      }
    });

  } catch (error) {
    logger.error('❌ Error declining case:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to decline case'
      }
    });
  }
};

/**
 * Un-decline a case (remove from declined list so provider can see it again)
 */
export const undeclineCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { providerId } = req.body;

    if (!caseId || !providerId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Case ID and Provider ID are required'
        }
      });
      return;
    }

    // Remove the decline record
    await db.query(
      'DELETE FROM case_declines WHERE case_id = $1 AND provider_id = $2',
      [caseId, providerId]
    );

    logger.info('✅ Case un-declined', { caseId, providerId });

    res.json({
      success: true,
      data: {
        message: 'Case un-declined successfully'
      }
    });

  } catch (error) {
    logger.error('❌ Error un-declining case:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to un-decline case'
      }
    });
  }
};

/**
 * Get declined cases for a provider
 */
export const getDeclinedCases = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;

    const cases = await db.query(
      `SELECT c.*, cd.declined_at, cd.reason as decline_reason
       FROM marketplace_service_cases c
       INNER JOIN case_declines cd ON c.id = cd.case_id
       WHERE cd.provider_id = $1
       ORDER BY cd.declined_at DESC`,
      [providerId]
    );

    res.json({
      success: true,
      data: cases
    });

  } catch (error) {
    logger.error('❌ Error fetching declined cases:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch declined cases'
      }
    });
  }
};

/**
 * Get available cases for a provider (open cases)
 * Excludes cases that this provider has already declined
 */
export const getAvailableCases = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;

    const cases = await db.query(
      `SELECT c.* FROM marketplace_service_cases c
       WHERE (
         (c.is_open_case = 1 AND c.status = 'pending') 
         OR (c.provider_id = $1 AND c.status != 'closed')
       )
       AND c.id NOT IN (
         SELECT case_id FROM case_declines WHERE provider_id = $2
       )
       ORDER BY c.created_at DESC`,
      [providerId, providerId]
    );

    res.json({
      success: true,
      data: cases
    });

  } catch (error) {
    logger.error('❌ Error fetching available cases:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch available cases'
      }
    });
  }
};

/**
 * Complete a case (mark as closed/completed)
 */
export const completeCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { completionNotes, income } = req.body;

    if (!caseId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Case ID is required'
        }
      });
      return;
    }

    const now = new Date().toISOString();

    await db.query(
      `UPDATE marketplace_service_cases 
       SET status = 'completed', completion_notes = $1, completed_at = $2, updated_at = $3
       WHERE id = $4 AND status IN ('wip', 'accepted')`,
      [completionNotes, now, now, caseId]
    );

    // Get case details for notification and income tracking
    const caseDetailsResult = await db.query(
      'SELECT customer_id, provider_id FROM marketplace_service_cases WHERE id = $1',
      [caseId]
    );
    const caseDetails = caseDetailsResult[0];

    // Record income if provided
    if (income && income.amount && caseDetails?.provider_id) {
      const incomeId = uuidv4();
      try {
        await db.query(
          `INSERT INTO case_income (
            id, case_id, provider_id, customer_id, amount, 
            currency, payment_method, notes, recorded_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            incomeId,
            caseId,
            caseDetails.provider_id,
            caseDetails.customer_id,
            income.amount,
            income.currency || 'BGN',
            income.paymentMethod || null,
            income.notes || null,
            now,
            now,
            now
          ]
        );
        logger.info('💰 Income recorded successfully', { incomeId, amount: income.amount });
      } catch (err) {
        logger.error('❌ Error recording income:', err);
        throw err;
      }
    }

    // Send notification to customer and request review
    if (caseDetails?.customer_id && caseDetails?.provider_id) {
      logger.info('🔔 Sending completion notification to customer', { 
        caseId, 
        customerId: caseDetails.customer_id, 
        providerId: caseDetails.provider_id 
      });
      try {
        await notificationService.notifyCaseCompleted(
          caseId,
          caseDetails.customer_id,
          caseDetails.provider_id
        );
        logger.info('✅ Completion notification sent successfully');
      } catch (notifError) {
        logger.error('❌ Error sending completion notification:', notifError);
      }
    } else {
      logger.warn('⚠️ Cannot send notification - missing customer or provider ID', { caseDetails });
    }

    logger.info('✅ Case completed successfully', { caseId, incomeRecorded: !!income });

    res.json({
      success: true,
      data: {
        message: 'Case completed successfully',
        incomeRecorded: !!income
      }
    });

  } catch (error) {
    logger.error('❌ Error completing case:', error);
    console.error('❌ DETAILED COMPLETE ERROR:', error);
    console.error('❌ COMPLETE ERROR STACK:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('❌ COMPLETE ERROR MESSAGE:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete case',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
};

/**
 * Get a single case by ID
 */
export const getCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseId } = req.params;

    if (!caseId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CASE_ID',
          message: 'Case ID is required'
        }
      });
      return;
    }

    const caseDataResult = await db.query(
      'SELECT * FROM marketplace_service_cases WHERE id = $1',
      [caseId]
    );
    const caseData = caseDataResult[0];

    if (!caseData) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CASE_NOT_FOUND',
          message: 'Case not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: caseData
    });

  } catch (error) {
    logger.error('❌ Error getting case:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get case'
      }
    });
  }
};

/**
 * Get cases with filtering and pagination
 */
export const getCasesWithFilters = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      status, 
      category,
      city,
      neighborhood,
      providerId, 
      customerId, 
      createdByUserId,
      onlyUnassigned,
      excludeDeclinedBy,
      page = 1, 
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    console.log('🔍 Backend - getCasesWithFilters query params:', req.query);

    // Build WHERE clause dynamically
    const conditions: string[] = [];
    const params: any[] = [];

    let paramIndex = 1;
    if (status) {
      conditions.push(`c.status = $${paramIndex++}`);
      params.push(status);
    }

    if (category) {
      conditions.push(`c.category = $${paramIndex++}`);
      params.push(category);
    }

    if (city) {
      conditions.push(`c.city = $${paramIndex++}`);
      params.push(city);
    }

    if (neighborhood) {
      conditions.push(`c.neighborhood = $${paramIndex++}`);
      params.push(neighborhood);
    }

    // Handle onlyUnassigned filter (for available cases view)
    if (onlyUnassigned === 'true') {
      // Show ALL unassigned cases (provider_id IS NULL)
      conditions.push(`c.provider_id IS NULL`);
      console.log('🔍 Backend - Filtering for unassigned cases (provider_id IS NULL)');
    }

    // Handle user-specific filtering
    if (createdByUserId) {
      // Show cases where user is either customer or provider
      conditions.push(`(c.customer_id = $${paramIndex++} OR c.provider_id = $${paramIndex++})`);
      params.push(createdByUserId, createdByUserId);
    } else {
      // Only apply individual filters if createdByUserId is not provided
      if (providerId) {
        conditions.push(`c.provider_id = $${paramIndex++}`);
        params.push(providerId);
      }

      if (customerId) {
        conditions.push(`c.customer_id = $${paramIndex++}`);
        params.push(customerId);
      }
    }

    // Exclude cases declined by a specific provider (for available cases view)
    if (excludeDeclinedBy) {
      conditions.push(`c.id NOT IN (SELECT case_id FROM marketplace_case_declines WHERE provider_id = $${paramIndex++})`);
      params.push(excludeDeclinedBy);
      console.log('🚫 Backend - Excluding cases declined by provider:', excludeDeclinedBy);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    console.log('🔍 Backend - SQL WHERE clause:', whereClause);
    console.log('🔍 Backend - SQL params:', params);

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM marketplace_service_cases c ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult[0]?.count || '0');

    // Get cases with pagination
    // If no specific status filter is applied, sort by status priority
    let orderClause;
    if (!status) {
      // Custom status priority: pending -> accepted -> wip -> declined -> completed
      orderClause = `ORDER BY 
        CASE c.status 
          WHEN 'pending' THEN 1 
          WHEN 'accepted' THEN 2 
          WHEN 'wip' THEN 3 
          WHEN 'declined' THEN 4 
          WHEN 'completed' THEN 5 
          ELSE 6 
        END ASC, 
        c.created_at DESC`;
    } else {
      orderClause = `ORDER BY c.${sortBy} ${sortOrder}`;
    }

    const cases = await db.query(
      `SELECT 
         c.*,
         CONCAT(u.first_name, ' ', u.last_name) as customer_name
       FROM marketplace_service_cases c
       LEFT JOIN users u ON c.customer_id = u.id
       ${whereClause}
       ${orderClause}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, Number(limit), offset]
    );

    console.log('📊 Backend - Query returned', cases.length, 'cases');
    if (cases.length > 0) {
      console.log('📋 Backend - First case:', {
        id: cases[0].id,
        service_type: cases[0].service_type,
        status: cases[0].status,
        provider_id: cases[0].provider_id,
        customer_id: cases[0].customer_id
      });
    }

    res.json({
      success: true,
      data: {
        cases,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('❌ Error fetching cases with filters:', error);
    console.error('❌ DETAILED ERROR:', error);
    console.error('❌ ERROR STACK:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('❌ ERROR MESSAGE:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch cases',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
};

/**
 * Get case statistics
 */
export const getCaseStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, customerId } = req.query;

    let whereClause = '';
    const params: any[] = [];

    if (providerId) {
      whereClause = 'WHERE provider_id = $1';
      params.push(providerId);
    } else if (customerId) {
      whereClause = 'WHERE customer_id = $1';
      params.push(customerId);
    }

    // Get status distribution using database abstraction
    const statusStatsQuery = `SELECT status, COUNT(*) as count FROM marketplace_service_cases ${whereClause} GROUP BY status`;
    const statusStats = await db.query(statusStatsQuery, params);

    // Get available cases count (unassigned cases for service providers, excluding declined)
    let availableCount = 0;
    if (providerId) {
      const availableQuery = `
        SELECT COUNT(*) as count FROM marketplace_service_cases 
        WHERE provider_id IS NULL 
        AND status = 'pending'
        AND id NOT IN (SELECT case_id FROM marketplace_case_declines WHERE provider_id = $1)
      `;
      const availableResult = await db.query(availableQuery, [providerId]);
      availableCount = availableResult[0]?.count || 0;
    }

    // Get declined cases count for this provider
    let declinedCount = 0;
    if (providerId) {
      const declinedQuery = `SELECT COUNT(*) as count FROM marketplace_case_declines WHERE provider_id = $1`;
      const declinedResult = await db.query(declinedQuery, [providerId]);
      declinedCount = declinedResult[0]?.count || 0;
    }

    // Get category distribution
    const categoryStatsQuery = `SELECT category, COUNT(*) as count FROM marketplace_service_cases ${whereClause} GROUP BY category`;
    const categoryStats = await db.query(categoryStatsQuery, params);

    // Transform statusStats array into object with counts
    const stats: any = {
      available: availableCount,
      pending: 0,
      accepted: 0,
      wip: 0,
      completed: 0,
      declined: declinedCount // Use the count from case_declines table
    };

    // Ensure statusStats is an array
    const statusStatsArray = Array.isArray(statusStats) ? statusStats : [];
    statusStatsArray.forEach((stat: any) => {
      if (stat.status === 'pending') stats.pending = parseInt(stat.count);
      else if (stat.status === 'accepted') stats.accepted = parseInt(stat.count);
      else if (stat.status === 'wip') stats.wip = parseInt(stat.count);
      else if (stat.status === 'completed') stats.completed = parseInt(stat.count);
    });

    res.json({
      success: true,
      data: {
        ...stats,
        statusStats: statusStatsArray,
        categoryStats: Array.isArray(categoryStats) ? categoryStats : []
      }
    });

  } catch (error) {
    logger.error('❌ Error fetching case stats:', error);
    console.error('❌ DETAILED STATS ERROR:', error);
    console.error('❌ STATS ERROR STACK:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('❌ STATS ERROR MESSAGE:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch case statistics',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
};

/**
 * Get smart-matched providers for a case
 */
export const getSmartMatches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { limit = 10 } = req.query;

    if (!caseId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Case ID is required'
        }
      });
      return;
    }

    // Get case details
    const caseDataResult = await db.query(
      'SELECT * FROM marketplace_service_cases WHERE id = $1',
      [caseId]
    );
    const caseData = caseDataResult[0];

    if (!caseData) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Case not found'
        }
      });
      return;
    }

    // Use smart matching service
    const smartMatching = new SmartMatchingService();
    const matches = await smartMatching.findBestProviders(caseData, Number(limit));

    logger.info('✅ Smart matches found for case', { caseId, matchCount: matches.length });

    res.json({
      success: true,
      data: {
        caseId,
        matches: matches.map(match => ({
          provider: {
            id: match.provider.id,
            businessName: match.provider.business_name,
            firstName: match.provider.first_name,
            lastName: match.provider.last_name,
            serviceCategory: match.provider.service_category,
            city: match.provider.city,
            neighborhood: match.provider.neighborhood,
            rating: match.provider.rating,
            totalReviews: match.provider.total_reviews,
            experienceYears: match.provider.experience_years,
            hourlyRate: match.provider.hourly_rate,
            isAvailable: match.provider.is_available
          },
          score: match.score,
          matchFactors: match.factors
        }))
      }
    });

  } catch (error) {
    logger.error('❌ Error getting smart matches:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get smart matches'
      }
    });
  }
};

/**
 * Auto-assign case to best provider
 */
export const autoAssignCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseId } = req.params;

    if (!caseId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Case ID is required'
        }
      });
      return;
    }

    const smartMatching = new SmartMatchingService();
    const assignedProviderId = await smartMatching.autoAssignCase(caseId);

    if (!assignedProviderId) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NO_PROVIDERS',
          message: 'No suitable providers found for auto-assignment'
        }
      });
      return;
    }

    logger.info('✅ Case auto-assigned successfully', { caseId, assignedProviderId });

    res.json({
      success: true,
      data: {
        message: 'Case auto-assigned successfully',
        assignedProviderId
      }
    });

  } catch (error) {
    logger.error('❌ Error auto-assigning case:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to auto-assign case'
      }
    });
  }
};

/**
 * Get income statistics for a provider
 */
export const getIncomeStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    const { startDate, endDate, period = 'month' } = req.query;

    if (!providerId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Provider ID is required'
        }
      });
      return;
    }

    let whereClause = 'WHERE provider_id = $1';
    const params: any[] = [providerId];

    // Add date filters if provided
    let paramIndex = 2;
    if (startDate) {
      whereClause += ` AND recorded_at >= $${paramIndex++}`;
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ` AND recorded_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    // Get total income
    const totalIncomeResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM case_income ${whereClause}`,
      params
    );
    const totalIncome = parseFloat(totalIncomeResult[0]?.total || '0');

    // Get income count
    const incomeCountResult = await db.query(
      `SELECT COUNT(*) as count FROM case_income ${whereClause}`,
      params
    );
    const incomeCount = parseInt(incomeCountResult[0]?.count || '0');

    // Get average income per case
    const avgIncome = incomeCount > 0 ? totalIncome / incomeCount : 0;

    // Get monthly breakdown
    const monthlyIncome = await db.query(
      `SELECT 
        TO_CHAR(recorded_at, 'YYYY-MM') as month,
        SUM(amount) as total,
        COUNT(*) as count,
        AVG(amount) as average
       FROM case_income 
       ${whereClause}
       GROUP BY TO_CHAR(recorded_at, 'YYYY-MM')
       ORDER BY month DESC
       LIMIT 12`,
      params
    );

    // Get payment method breakdown
    const paymentMethods = await db.query(
      `SELECT 
        COALESCE(payment_method, 'Неуточнен') as method,
        SUM(amount) as total,
        COUNT(*) as count
       FROM case_income 
       ${whereClause}
       GROUP BY payment_method`,
      params
    );

    logger.info('✅ Income stats retrieved', { providerId, totalIncome, incomeCount });

    res.json({
      success: true,
      data: {
        summary: {
          totalIncome: Math.round(totalIncome * 100) / 100,
          incomeCount,
          averageIncome: Math.round(avgIncome * 100) / 100,
          currency: 'BGN'
        },
        monthlyIncome: monthlyIncome.map(m => ({
          month: m.month,
          total: Math.round(m.total * 100) / 100,
          count: m.count,
          average: Math.round(m.average * 100) / 100
        })),
        paymentMethods: paymentMethods.map(pm => ({
          method: pm.method,
          total: Math.round(pm.total * 100) / 100,
          count: pm.count
        }))
      }
    });

  } catch (error) {
    logger.error('❌ Error fetching income stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch income statistics'
      }
    });
  }
};

/**
 * Get income transactions by payment method
 */
export const getIncomeTransactionsByMethod = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, paymentMethod } = req.params;

    if (!providerId || !paymentMethod) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Provider ID and payment method are required'
        }
      });
      return;
    }

    const transactions = await db.query(
      `SELECT 
        ci.*,
        c.description as case_description,
        c.service_type
       FROM case_income ci
       LEFT JOIN marketplace_service_cases c ON ci.case_id = c.id
       WHERE ci.provider_id = $1 AND COALESCE(ci.payment_method, 'Неуточнен') = $2
       ORDER BY ci.recorded_at DESC`,
      [providerId, paymentMethod]
    );

    res.json({
      success: true,
      data: transactions
    });

  } catch (error) {
    logger.error('❌ Error fetching income transactions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch income transactions'
      }
    });
  }
};

/**
 * Get income transactions by month
 */
export const getIncomeTransactionsByMonth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, month } = req.params;

    if (!providerId || !month) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Provider ID and month are required'
        }
      });
      return;
    }

    const transactions = await db.query(
      `SELECT 
        ci.*,
        c.description as case_description,
        c.service_type
       FROM case_income ci
       LEFT JOIN marketplace_service_cases c ON ci.case_id = c.id
       WHERE ci.provider_id = $1 AND TO_CHAR(ci.recorded_at, 'YYYY-MM') = $2
       ORDER BY ci.recorded_at DESC`,
      [providerId, month]
    );

    res.json({
      success: true,
      data: transactions
    });

  } catch (error) {
    logger.error('❌ Error fetching income transactions by month:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch income transactions'
      }
    });
  }
};

/**
 * Update income transaction
 */
export const updateIncomeTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { incomeId } = req.params;
    const { amount, paymentMethod, notes } = req.body;

    if (!incomeId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Income ID is required'
        }
      });
      return;
    }

    const now = new Date().toISOString();

    await db.query(
      `UPDATE case_income 
       SET amount = $1, payment_method = $2, notes = $3, updated_at = $4
       WHERE id = $5`,
      [amount, paymentMethod, notes, now, incomeId]
    );

    logger.info('✅ Income transaction updated', { incomeId, amount });

    res.json({
      success: true,
      data: {
        message: 'Income transaction updated successfully'
      }
    });

  } catch (error) {
    logger.error('❌ Error updating income transaction:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update income transaction'
      }
    });
  }
};

/**
 * Get available years with income data for a provider
 */
export const getIncomeYears = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;

    if (!providerId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Provider ID is required'
        }
      });
      return;
    }

    const years = await db.query(
      `SELECT DISTINCT TO_CHAR(recorded_at, 'YYYY') as year
       FROM case_income 
       WHERE provider_id = $1 AND recorded_at IS NOT NULL
       ORDER BY year DESC`,
      [providerId]
    );

    const yearList = years.map(row => parseInt(row.year)).filter(year => !isNaN(year));

    logger.info('✅ Income years retrieved', { providerId, years: yearList });

    res.json({
      success: true,
      data: yearList
    });

  } catch (error) {
    logger.error('❌ Error fetching income years:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch income years'
      }
    });
  }
};

/**
 * Update case status
 */
export const updateCaseStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { status, message } = req.body;

    if (!caseId || !status) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Case ID and status are required'
        }
      });
      return;
    }

    // Validate status values
    const validStatuses = ['pending', 'accepted', 'declined', 'completed', 'wip', 'closed'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        }
      });
      return;
    }

    const now = new Date().toISOString();

    await db.query(
      `UPDATE marketplace_service_cases 
       SET status = $1, updated_at = $2, completion_notes = $3
       WHERE id = $4`,
      [status, now, message, caseId]
    );

    // If status is completed, also set completed_at
    if (status === 'completed') {
      await db.query(
        `UPDATE marketplace_service_cases 
         SET completed_at = $1
         WHERE id = $2`,
        [now, caseId]
      );

      // Get case details for notification
      const caseDetailsResult = await db.query(
        'SELECT customer_id, provider_id FROM marketplace_service_cases WHERE id = $1',
        [caseId]
      );
      const caseDetails = caseDetailsResult[0];

      // Send notification to customer and request review
      console.log('🏁 Case completion - Case details for notification:', caseDetails);
      if (caseDetails?.customer_id && caseDetails?.provider_id) {
        console.log('🏁 Case completion - Calling notifyCaseCompleted...');
        await notificationService.notifyCaseCompleted(
          caseId,
          caseDetails.customer_id,
          caseDetails.provider_id
        );
        console.log('🏁 Case completion - Notification service called successfully');
      } else {
        console.log('🏁 Case completion - Missing customer_id or provider_id, skipping notification');
      }
    }

    logger.info('✅ Case status updated successfully', { caseId, status });

    res.json({
      success: true,
      data: {
        message: `Case status updated to ${status}`,
        caseId,
        status
      }
    });

  } catch (error) {
    logger.error('❌ Error updating case status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update case status'
      }
    });
  }
};