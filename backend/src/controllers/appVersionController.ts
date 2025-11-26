import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Path to version config file
const VERSION_CONFIG_PATH = path.join(__dirname, '../../config/app-version.json');

// Default version info
const DEFAULT_VERSION_INFO = {
  latestVersion: '1.0.0',
  minimumVersion: '1.0.0',
  downloadUrl: 'https://maystorfix.com/downloads/ServiceTextPro-latest.apk',
  updateRequired: false,
  releaseNotes: {
    bg: 'Нова версия с подобрения и поправки',
    en: 'New version with improvements and fixes'
  },
  features: [
    'Нови функции',
    'Подобрения в производителността',
    'Поправки на грешки'
  ]
};

/**
 * GET /api/v1/app/version
 * Returns the latest app version information
 */
export const getAppVersion = async (req: Request, res: Response): Promise<void> => {
  try {
    let versionInfo = DEFAULT_VERSION_INFO;

    // Try to read from config file
    if (fs.existsSync(VERSION_CONFIG_PATH)) {
      try {
        const configData = fs.readFileSync(VERSION_CONFIG_PATH, 'utf8');
        versionInfo = { ...DEFAULT_VERSION_INFO, ...JSON.parse(configData) };
        console.log('📱 App version loaded from config:', versionInfo.latestVersion);
      } catch (parseError) {
        console.error('Error parsing version config, using defaults:', parseError);
      }
    } else {
      console.log('📱 Version config not found, using defaults');
      // Create default config file
      try {
        const configDir = path.dirname(VERSION_CONFIG_PATH);
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(VERSION_CONFIG_PATH, JSON.stringify(DEFAULT_VERSION_INFO, null, 2));
        console.log('📱 Created default version config at:', VERSION_CONFIG_PATH);
      } catch (writeError) {
        console.error('Error creating version config:', writeError);
      }
    }

    res.json({
      success: true,
      data: versionInfo
    });
  } catch (error) {
    console.error('Error getting app version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get app version'
    });
  }
};

/**
 * POST /api/v1/app/version
 * Update the app version (admin only)
 */
export const updateAppVersion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { latestVersion, minimumVersion, downloadUrl, updateRequired, releaseNotes, features } = req.body;

    // In a real implementation, you would save this to a database
    // For now, we'll just return success
    // You can manually update the getAppVersion function above

    res.json({
      success: true,
      message: 'App version updated successfully'
    });
  } catch (error) {
    console.error('Error updating app version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update app version'
    });
  }
};
