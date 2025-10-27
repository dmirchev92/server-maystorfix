// Simple Authentication Middleware
// Validates JWT tokens and adds user to request

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../utils/config';
import { DatabaseFactory } from '../models/DatabaseFactory';
import { ServiceTextProError, JWTPayload } from '../types';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        businessId?: string;
        firstName: string;
        lastName: string;
        phoneNumber: string;
        status: string;
        createdAt: Date;
        lastLoginAt?: Date;
        isGdprCompliant: boolean;
        dataRetentionUntil: Date;
        gdprConsents: any[];
        updatedAt: Date;
      };
    }
  }
}

const database = DatabaseFactory.getDatabase();

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

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

    // Verify token
    const decoded = jwt.verify(token, config.security.jwt.secret) as JWTPayload;
    
    // Get user from database
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

    // Add user to request
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
  } catch (error) {
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
