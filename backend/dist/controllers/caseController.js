"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCaseStatus = exports.getIncomeYears = exports.updateIncomeTransaction = exports.getIncomeTransactionsByMonth = exports.getIncomeTransactionsByMethod = exports.getIncomeStats = exports.autoAssignCase = exports.getSmartMatches = exports.getCaseStats = exports.getCasesWithFilters = exports.getCase = exports.completeCase = exports.getAvailableCases = exports.getDeclinedCases = exports.undeclineCase = exports.declineCase = exports.acceptCase = exports.getProviderCases = exports.createCase = void 0;
const DatabaseFactory_1 = require("../models/DatabaseFactory");
const logger_1 = __importDefault(require("../utils/logger"));
const uuid_1 = require("uuid");
const SmartMatchingService_1 = __importDefault(require("../services/SmartMatchingService"));
const NotificationService_1 = __importDefault(require("../services/NotificationService"));
const db = DatabaseFactory_1.DatabaseFactory.getDatabase();
const notificationService = new NotificationService_1.default();
const createCase = async (req, res) => {
    try {
        const { serviceType, description, preferredDate, preferredTime, priority, city, neighborhood, address, phone, additionalDetails, providerId, providerName, isOpenCase, assignmentType, screenshots, customerId, category } = req.body;
        logger_1.default.info('📝 Creating case with data:', {
            customerId,
            providerId,
            assignmentType,
            hasCustomerId: !!customerId
        });
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
        if (customerId && providerId && customerId === providerId) {
            logger_1.default.warn('⚠️ Service Provider attempted to create case for themselves:', {
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
        const caseId = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        if (DatabaseFactory_1.DatabaseFactory.isPostgreSQL()) {
            await db.query(`INSERT INTO marketplace_service_cases (
          id, service_type, description, preferred_date, preferred_time,
          priority, city, neighborhood, phone, additional_details, provider_id,
          provider_name, is_open_case, assignment_type, status,
          customer_id, category, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`, [
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
            ]);
        }
        else {
            await new Promise((resolve, reject) => {
                db.db.run(`INSERT INTO marketplace_service_cases (
            id, service_type, description, preferred_date, preferred_time,
            priority, city, neighborhood, phone, additional_details, provider_id,
            provider_name, is_open_case, assignment_type, status,
            customer_id, category, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
                ], function (err) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            });
        }
        if (screenshots && screenshots.length > 0) {
            for (const screenshot of screenshots) {
                const imageUrl = screenshot.url || screenshot.name || screenshot;
                if (!imageUrl || typeof imageUrl !== 'string') {
                    continue;
                }
                const screenshotId = (0, uuid_1.v4)();
                if (DatabaseFactory_1.DatabaseFactory.isPostgreSQL()) {
                    await db.query(`INSERT INTO case_screenshots (id, case_id, image_url, created_at) VALUES ($1, $2, $3, $4)`, [screenshotId, caseId, imageUrl, now]);
                }
                else {
                    await new Promise((resolve, reject) => {
                        db.db.run(`INSERT INTO case_screenshots (id, case_id, image_url, created_at) VALUES (?, ?, ?, ?)`, [screenshotId, caseId, imageUrl, now], function (err) {
                            if (err) {
                                reject(err);
                            }
                            else {
                                resolve();
                            }
                        });
                    });
                }
            }
        }
        if (assignmentType === 'specific' && providerId) {
            logger_1.default.info('🔔 Creating notification for directly assigned SP', { providerId, caseId });
            try {
                await notificationService.createNotification(providerId, 'case_assigned', 'Нова заявка директно възложена', `Клиент ви възложи нова заявка: ${description.substring(0, 50)}...`, { caseId, action: 'view_case' });
                logger_1.default.info('✅ Notification sent to SP for direct assignment', { providerId, caseId });
            }
            catch (notifError) {
                logger_1.default.error('❌ Error sending notification to SP:', notifError);
            }
        }
        logger_1.default.info('✅ Service case created successfully', { caseId, serviceType, assignmentType });
        res.status(201).json({
            success: true,
            data: {
                caseId,
                message: assignmentType === 'specific'
                    ? `Case assigned to ${providerName}`
                    : 'Case created and available to all providers'
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error creating service case:', error);
        logger_1.default.error('❌ Error details:', {
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
exports.createCase = createCase;
const getProviderCases = async (req, res) => {
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
        const cases = await db.query(`SELECT * FROM marketplace_service_cases 
       WHERE provider_id = $1 OR is_open_case = 1 
       ORDER BY created_at DESC`, [providerId]);
        res.json({
            success: true,
            data: cases
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error fetching provider cases:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch cases'
            }
        });
    }
};
exports.getProviderCases = getProviderCases;
const acceptCase = async (req, res) => {
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
        await db.query(`UPDATE marketplace_service_cases 
       SET status = 'accepted', provider_id = $1, provider_name = $2, updated_at = $3
       WHERE id = $4 AND status = 'pending'`, [providerId, providerName, now, caseId]);
        const caseDetailsResult = await db.query('SELECT customer_id FROM marketplace_service_cases WHERE id = $1', [caseId]);
        const caseDetails = caseDetailsResult[0];
        logger_1.default.info('📧 Checking if should send notification to customer:', {
            hasCustomerId: !!caseDetails?.customer_id,
            customerId: caseDetails?.customer_id,
            caseId,
            providerId
        });
        if (caseDetails?.customer_id) {
            logger_1.default.info('📧 Sending case accepted notification to customer');
            await notificationService.notifyCaseAssigned(caseId, caseDetails.customer_id, providerId, providerName);
            logger_1.default.info('✅ Case accepted notification sent to customer');
        }
        else {
            logger_1.default.warn('⚠️ Cannot send notification - customer_id is missing from case');
        }
        logger_1.default.info('✅ Case accepted successfully', { caseId, providerId });
        res.json({
            success: true,
            data: {
                message: 'Case accepted successfully'
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error accepting case:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to accept case'
            }
        });
    }
};
exports.acceptCase = acceptCase;
const declineCase = async (req, res) => {
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
        const actualProviderId = providerId || req.user?.id;
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
        const existingDeclineResult = await db.query('SELECT * FROM case_declines WHERE case_id = $1 AND provider_id = $2', [caseId, actualProviderId]);
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
        const caseDetailsResult = await db.query('SELECT * FROM marketplace_service_cases WHERE id = $1', [caseId]);
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
        await db.query(`INSERT INTO case_declines (id, case_id, provider_id, reason, declined_at)
       VALUES ($1, $2, $3, $4, $5)`, [declineId, caseId, actualProviderId, reason, now]);
        if (caseDetails.provider_id === actualProviderId) {
            await db.query(`UPDATE marketplace_service_cases 
         SET provider_id = NULL, status = 'pending', updated_at = $1
         WHERE id = $2`, [now, caseId]);
            logger_1.default.info('✅ Case unassigned and returned to queue', { caseId, providerId: actualProviderId });
        }
        if (caseDetails.provider_id === actualProviderId && caseDetails.customer_id) {
            try {
                await notificationService.createNotification(caseDetails.customer_id, 'case_declined', 'Заявката е отказана', `Специалистът отказа вашата заявка${reason ? ': ' + reason : ''}. Заявката е върната в опашката за други специалисти.`, { caseId, providerId: actualProviderId, reason });
                logger_1.default.info('✅ Decline notification sent to customer');
            }
            catch (notifError) {
                logger_1.default.error('❌ Error sending decline notification:', notifError);
            }
        }
        logger_1.default.info('✅ Case declined by provider', { caseId, providerId: actualProviderId, reason });
        res.json({
            success: true,
            data: {
                message: 'Case declined successfully',
                returnedToQueue: caseDetails.provider_id === actualProviderId
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error declining case:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to decline case'
            }
        });
    }
};
exports.declineCase = declineCase;
const undeclineCase = async (req, res) => {
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
        await db.query('DELETE FROM case_declines WHERE case_id = $1 AND provider_id = $2', [caseId, providerId]);
        logger_1.default.info('✅ Case un-declined', { caseId, providerId });
        res.json({
            success: true,
            data: {
                message: 'Case un-declined successfully'
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error un-declining case:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to un-decline case'
            }
        });
    }
};
exports.undeclineCase = undeclineCase;
const getDeclinedCases = async (req, res) => {
    try {
        const { providerId } = req.params;
        const cases = await db.query(`SELECT c.*, cd.declined_at, cd.reason as decline_reason
       FROM marketplace_service_cases c
       INNER JOIN case_declines cd ON c.id = cd.case_id
       WHERE cd.provider_id = $1
       ORDER BY cd.declined_at DESC`, [providerId]);
        res.json({
            success: true,
            data: cases
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error fetching declined cases:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch declined cases'
            }
        });
    }
};
exports.getDeclinedCases = getDeclinedCases;
const getAvailableCases = async (req, res) => {
    try {
        const { providerId } = req.params;
        const cases = await db.query(`SELECT c.* FROM marketplace_service_cases c
       WHERE (
         (c.is_open_case = 1 AND c.status = 'pending') 
         OR (c.provider_id = $1 AND c.status != 'closed')
       )
       AND c.id NOT IN (
         SELECT case_id FROM case_declines WHERE provider_id = $2
       )
       ORDER BY c.created_at DESC`, [providerId, providerId]);
        res.json({
            success: true,
            data: cases
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error fetching available cases:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch available cases'
            }
        });
    }
};
exports.getAvailableCases = getAvailableCases;
const completeCase = async (req, res) => {
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
        await db.query(`UPDATE marketplace_service_cases 
       SET status = 'completed', completion_notes = $1, completed_at = $2, updated_at = $3
       WHERE id = $4 AND status IN ('wip', 'accepted')`, [completionNotes, now, now, caseId]);
        const caseDetailsResult = await db.query('SELECT customer_id, provider_id FROM marketplace_service_cases WHERE id = $1', [caseId]);
        const caseDetails = caseDetailsResult[0];
        if (income && income.amount && caseDetails?.provider_id) {
            const incomeId = (0, uuid_1.v4)();
            try {
                await db.query(`INSERT INTO case_income (
            id, case_id, provider_id, customer_id, amount, 
            currency, payment_method, notes, recorded_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
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
                ]);
                logger_1.default.info('💰 Income recorded successfully', { incomeId, amount: income.amount });
            }
            catch (err) {
                logger_1.default.error('❌ Error recording income:', err);
                throw err;
            }
        }
        if (caseDetails?.customer_id && caseDetails?.provider_id) {
            logger_1.default.info('🔔 Sending completion notification to customer', {
                caseId,
                customerId: caseDetails.customer_id,
                providerId: caseDetails.provider_id
            });
            try {
                await notificationService.notifyCaseCompleted(caseId, caseDetails.customer_id, caseDetails.provider_id);
                logger_1.default.info('✅ Completion notification sent successfully');
            }
            catch (notifError) {
                logger_1.default.error('❌ Error sending completion notification:', notifError);
            }
        }
        else {
            logger_1.default.warn('⚠️ Cannot send notification - missing customer or provider ID', { caseDetails });
        }
        logger_1.default.info('✅ Case completed successfully', { caseId, incomeRecorded: !!income });
        res.json({
            success: true,
            data: {
                message: 'Case completed successfully',
                incomeRecorded: !!income
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error completing case:', error);
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
exports.completeCase = completeCase;
const getCase = async (req, res) => {
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
        const caseDataResult = await db.query('SELECT * FROM marketplace_service_cases WHERE id = $1', [caseId]);
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
    }
    catch (error) {
        logger_1.default.error('❌ Error getting case:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get case'
            }
        });
    }
};
exports.getCase = getCase;
const getCasesWithFilters = async (req, res) => {
    try {
        const { status, category, city, neighborhood, providerId, customerId, createdByUserId, onlyUnassigned, excludeDeclinedBy, page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
        console.log('🔍 Backend - getCasesWithFilters query params:', req.query);
        const conditions = [];
        const params = [];
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
        if (onlyUnassigned === 'true') {
            conditions.push(`c.provider_id IS NULL`);
            console.log('🔍 Backend - Filtering for unassigned cases (provider_id IS NULL)');
        }
        if (createdByUserId) {
            conditions.push(`(c.customer_id = $${paramIndex++} OR c.provider_id = $${paramIndex++})`);
            params.push(createdByUserId, createdByUserId);
        }
        else {
            if (providerId) {
                conditions.push(`c.provider_id = $${paramIndex++}`);
                params.push(providerId);
            }
            if (customerId) {
                conditions.push(`c.customer_id = $${paramIndex++}`);
                params.push(customerId);
            }
        }
        if (excludeDeclinedBy) {
            conditions.push(`c.id NOT IN (SELECT case_id FROM marketplace_case_declines WHERE provider_id = $${paramIndex++})`);
            params.push(excludeDeclinedBy);
            console.log('🚫 Backend - Excluding cases declined by provider:', excludeDeclinedBy);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (Number(page) - 1) * Number(limit);
        console.log('🔍 Backend - SQL WHERE clause:', whereClause);
        console.log('🔍 Backend - SQL params:', params);
        const countResult = await db.query(`SELECT COUNT(*) as count FROM marketplace_service_cases c ${whereClause}`, params);
        const totalCount = parseInt(countResult[0]?.count || '0');
        let orderClause;
        if (!status) {
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
        }
        else {
            orderClause = `ORDER BY c.${sortBy} ${sortOrder}`;
        }
        const cases = await db.query(`SELECT 
         c.*,
         CONCAT(u.first_name, ' ', u.last_name) as customer_name
       FROM marketplace_service_cases c
       LEFT JOIN users u ON c.customer_id = u.id
       ${whereClause}
       ${orderClause}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`, [...params, Number(limit), offset]);
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
    }
    catch (error) {
        logger_1.default.error('❌ Error fetching cases with filters:', error);
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
exports.getCasesWithFilters = getCasesWithFilters;
const getCaseStats = async (req, res) => {
    try {
        const { providerId, customerId } = req.query;
        let whereClause = '';
        const params = [];
        if (providerId) {
            whereClause = 'WHERE provider_id = $1';
            params.push(providerId);
        }
        else if (customerId) {
            whereClause = 'WHERE customer_id = $1';
            params.push(customerId);
        }
        const statusStatsQuery = `SELECT status, COUNT(*) as count FROM marketplace_service_cases ${whereClause} GROUP BY status`;
        const statusStats = await db.query(statusStatsQuery, params);
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
        let declinedCount = 0;
        if (providerId) {
            const declinedQuery = `SELECT COUNT(*) as count FROM marketplace_case_declines WHERE provider_id = $1`;
            const declinedResult = await db.query(declinedQuery, [providerId]);
            declinedCount = declinedResult[0]?.count || 0;
        }
        const categoryStatsQuery = `SELECT category, COUNT(*) as count FROM marketplace_service_cases ${whereClause} GROUP BY category`;
        const categoryStats = await db.query(categoryStatsQuery, params);
        const stats = {
            available: availableCount,
            pending: 0,
            accepted: 0,
            wip: 0,
            completed: 0,
            declined: declinedCount
        };
        const statusStatsArray = Array.isArray(statusStats) ? statusStats : [];
        statusStatsArray.forEach((stat) => {
            if (stat.status === 'pending')
                stats.pending = parseInt(stat.count);
            else if (stat.status === 'accepted')
                stats.accepted = parseInt(stat.count);
            else if (stat.status === 'wip')
                stats.wip = parseInt(stat.count);
            else if (stat.status === 'completed')
                stats.completed = parseInt(stat.count);
        });
        res.json({
            success: true,
            data: {
                ...stats,
                statusStats: statusStatsArray,
                categoryStats: Array.isArray(categoryStats) ? categoryStats : []
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error fetching case stats:', error);
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
exports.getCaseStats = getCaseStats;
const getSmartMatches = async (req, res) => {
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
        const caseDataResult = await db.query('SELECT * FROM marketplace_service_cases WHERE id = $1', [caseId]);
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
        const smartMatching = new SmartMatchingService_1.default();
        const matches = await smartMatching.findBestProviders(caseData, Number(limit));
        logger_1.default.info('✅ Smart matches found for case', { caseId, matchCount: matches.length });
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
    }
    catch (error) {
        logger_1.default.error('❌ Error getting smart matches:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get smart matches'
            }
        });
    }
};
exports.getSmartMatches = getSmartMatches;
const autoAssignCase = async (req, res) => {
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
        const smartMatching = new SmartMatchingService_1.default();
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
        logger_1.default.info('✅ Case auto-assigned successfully', { caseId, assignedProviderId });
        res.json({
            success: true,
            data: {
                message: 'Case auto-assigned successfully',
                assignedProviderId
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error auto-assigning case:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to auto-assign case'
            }
        });
    }
};
exports.autoAssignCase = autoAssignCase;
const getIncomeStats = async (req, res) => {
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
        const params = [providerId];
        let paramIndex = 2;
        if (startDate) {
            whereClause += ` AND recorded_at >= $${paramIndex++}`;
            params.push(startDate);
        }
        if (endDate) {
            whereClause += ` AND recorded_at <= $${paramIndex++}`;
            params.push(endDate);
        }
        const totalIncomeResult = await db.query(`SELECT COALESCE(SUM(amount), 0) as total FROM case_income ${whereClause}`, params);
        const totalIncome = parseFloat(totalIncomeResult[0]?.total || '0');
        const incomeCountResult = await db.query(`SELECT COUNT(*) as count FROM case_income ${whereClause}`, params);
        const incomeCount = parseInt(incomeCountResult[0]?.count || '0');
        const avgIncome = incomeCount > 0 ? totalIncome / incomeCount : 0;
        const monthlyIncome = await db.query(`SELECT 
        TO_CHAR(recorded_at, 'YYYY-MM') as month,
        SUM(amount) as total,
        COUNT(*) as count,
        AVG(amount) as average
       FROM case_income 
       ${whereClause}
       GROUP BY TO_CHAR(recorded_at, 'YYYY-MM')
       ORDER BY month DESC
       LIMIT 12`, params);
        const paymentMethods = await db.query(`SELECT 
        COALESCE(payment_method, 'Неуточнен') as method,
        SUM(amount) as total,
        COUNT(*) as count
       FROM case_income 
       ${whereClause}
       GROUP BY payment_method`, params);
        logger_1.default.info('✅ Income stats retrieved', { providerId, totalIncome, incomeCount });
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
    }
    catch (error) {
        logger_1.default.error('❌ Error fetching income stats:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch income statistics'
            }
        });
    }
};
exports.getIncomeStats = getIncomeStats;
const getIncomeTransactionsByMethod = async (req, res) => {
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
        const transactions = await db.query(`SELECT 
        ci.*,
        c.description as case_description,
        c.service_type
       FROM case_income ci
       LEFT JOIN marketplace_service_cases c ON ci.case_id = c.id
       WHERE ci.provider_id = $1 AND COALESCE(ci.payment_method, 'Неуточнен') = $2
       ORDER BY ci.recorded_at DESC`, [providerId, paymentMethod]);
        res.json({
            success: true,
            data: transactions
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error fetching income transactions:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch income transactions'
            }
        });
    }
};
exports.getIncomeTransactionsByMethod = getIncomeTransactionsByMethod;
const getIncomeTransactionsByMonth = async (req, res) => {
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
        const transactions = await db.query(`SELECT 
        ci.*,
        c.description as case_description,
        c.service_type
       FROM case_income ci
       LEFT JOIN marketplace_service_cases c ON ci.case_id = c.id
       WHERE ci.provider_id = $1 AND TO_CHAR(ci.recorded_at, 'YYYY-MM') = $2
       ORDER BY ci.recorded_at DESC`, [providerId, month]);
        res.json({
            success: true,
            data: transactions
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error fetching income transactions by month:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch income transactions'
            }
        });
    }
};
exports.getIncomeTransactionsByMonth = getIncomeTransactionsByMonth;
const updateIncomeTransaction = async (req, res) => {
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
        await db.query(`UPDATE case_income 
       SET amount = $1, payment_method = $2, notes = $3, updated_at = $4
       WHERE id = $5`, [amount, paymentMethod, notes, now, incomeId]);
        logger_1.default.info('✅ Income transaction updated', { incomeId, amount });
        res.json({
            success: true,
            data: {
                message: 'Income transaction updated successfully'
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error updating income transaction:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update income transaction'
            }
        });
    }
};
exports.updateIncomeTransaction = updateIncomeTransaction;
const getIncomeYears = async (req, res) => {
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
        const years = await db.query(`SELECT DISTINCT TO_CHAR(recorded_at, 'YYYY') as year
       FROM case_income 
       WHERE provider_id = $1 AND recorded_at IS NOT NULL
       ORDER BY year DESC`, [providerId]);
        const yearList = years.map(row => parseInt(row.year)).filter(year => !isNaN(year));
        logger_1.default.info('✅ Income years retrieved', { providerId, years: yearList });
        res.json({
            success: true,
            data: yearList
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error fetching income years:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch income years'
            }
        });
    }
};
exports.getIncomeYears = getIncomeYears;
const updateCaseStatus = async (req, res) => {
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
        await db.query(`UPDATE marketplace_service_cases 
       SET status = $1, updated_at = $2, completion_notes = $3
       WHERE id = $4`, [status, now, message, caseId]);
        if (status === 'completed') {
            await db.query(`UPDATE marketplace_service_cases 
         SET completed_at = $1
         WHERE id = $2`, [now, caseId]);
            const caseDetailsResult = await db.query('SELECT customer_id, provider_id FROM marketplace_service_cases WHERE id = $1', [caseId]);
            const caseDetails = caseDetailsResult[0];
            console.log('🏁 Case completion - Case details for notification:', caseDetails);
            if (caseDetails?.customer_id && caseDetails?.provider_id) {
                console.log('🏁 Case completion - Calling notifyCaseCompleted...');
                await notificationService.notifyCaseCompleted(caseId, caseDetails.customer_id, caseDetails.provider_id);
                console.log('🏁 Case completion - Notification service called successfully');
            }
            else {
                console.log('🏁 Case completion - Missing customer_id or provider_id, skipping notification');
            }
        }
        logger_1.default.info('✅ Case status updated successfully', { caseId, status });
        res.json({
            success: true,
            data: {
                message: `Case status updated to ${status}`,
                caseId,
                status
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error updating case status:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update case status'
            }
        });
    }
};
exports.updateCaseStatus = updateCaseStatus;
//# sourceMappingURL=caseController.js.map