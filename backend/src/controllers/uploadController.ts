import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/case-screenshots');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info('📁 Created uploads directory:', uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept images only
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  }
});

/**
 * Upload case screenshots
 * POST /api/v1/upload/case-screenshots
 */
export const uploadCaseScreenshots = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('📸 Upload request received');
    logger.info('📸 Request files:', req.files);
    logger.info('📸 Request body:', req.body);
    
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      logger.warn('📸 No files in upload request');
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILES',
          message: 'No files uploaded'
        }
      });
      return;
    }

    logger.info('📸 Processing files:', { count: files.length, filenames: files.map(f => f.filename) });

    // Generate URLs for uploaded files
    const baseUrl = process.env.BACKEND_URL || 'https://maystorfix.com';
    const screenshots = files.map(file => ({
      url: `${baseUrl}/uploads/case-screenshots/${file.filename}`,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    }));

    logger.info('✅ Uploaded case screenshots:', { count: files.length, files: screenshots.map(s => s.filename) });

    res.json({
      success: true,
      data: {
        screenshots
      }
    });

  } catch (error: any) {
    logger.error('❌ Error uploading screenshots:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: error.message || 'Failed to upload screenshots'
      }
    });
  }
};

/**
 * Delete a screenshot file
 * DELETE /api/v1/upload/case-screenshots/:filename
 */
export const deleteScreenshot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILENAME',
          message: 'Filename is required'
        }
      });
      return;
    }

    const filePath = path.join(uploadsDir, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Screenshot not found'
        }
      });
      return;
    }

    // Delete file
    fs.unlinkSync(filePath);
    logger.info('🗑️ Deleted screenshot:', filename);

    res.json({
      success: true,
      message: 'Screenshot deleted successfully'
    });

  } catch (error: any) {
    logger.error('❌ Error deleting screenshot:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_ERROR',
        message: error.message || 'Failed to delete screenshot'
      }
    });
  }
};
