"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../utils/config"));
const DatabaseFactory_1 = require("../models/DatabaseFactory");
const database = DatabaseFactory_1.DatabaseFactory.getDatabase();
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'NO_TOKEN',
                    message: 'Access token required'
                }
            });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.security.jwt.secret);
        const user = await database.findUserById(decoded.userId);
        if (!user) {
            res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'User not found'
                }
            });
            return;
        }
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            businessId: user.businessId,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            status: user.status,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
            isGdprCompliant: user.isGdprCompliant,
            dataRetentionUntil: user.dataRetentionUntil,
            gdprConsents: user.gdprConsents,
            updatedAt: user.updatedAt
        };
        next();
        return;
    }
    catch (error) {
        res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_TOKEN',
                message: 'Invalid or expired token'
            }
        });
        return;
    }
};
exports.authenticateToken = authenticateToken;
//# sourceMappingURL=auth.js.map