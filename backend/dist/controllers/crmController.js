"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCaseStats = exports.getCustomers = exports.getDashboard = void 0;
const DatabaseFactory_1 = require("../models/DatabaseFactory");
const logger_1 = __importDefault(require("../utils/logger"));
const db = DatabaseFactory_1.DatabaseFactory.getDatabase();
const getDashboard = async (req, res) => {
    try {
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
    }
    catch (error) {
        logger_1.default.error('❌ Error fetching CRM dashboard:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch CRM dashboard'
            }
        });
    }
};
exports.getDashboard = getDashboard;
const getCustomers = async (req, res) => {
    try {
        const customers = await new Promise((resolve, reject) => {
            db.db.all(`SELECT DISTINCT customer_name, customer_email, customer_phone, created_at
         FROM marketplace_conversations 
         ORDER BY created_at DESC`, [], (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows || []);
                }
            });
        });
        res.json({
            success: true,
            data: customers
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error fetching customers:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch customers'
            }
        });
    }
};
exports.getCustomers = getCustomers;
const getCaseStats = async (req, res) => {
    try {
        const stats = await new Promise((resolve, reject) => {
            db.db.get(`SELECT 
          COUNT(*) as total_cases,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_cases,
          SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_cases,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_cases,
          SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined_cases
         FROM marketplace_service_cases`, [], (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(row || {});
                }
            });
        });
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error fetching case stats:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch case statistics'
            }
        });
    }
};
exports.getCaseStats = getCaseStats;
//# sourceMappingURL=crmController.js.map