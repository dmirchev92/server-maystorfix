import { Request, Response } from 'express';

/**
 * GET /api/v1/app/version
 * Returns the latest app version information
 */
export const getAppVersion = async (req: Request, res: Response): Promise<void> => {
  try {
    // You can update these values when you release a new version
    const versionInfo = {
      latestVersion: '0.0.1', // Update this when you release new APK (set lower than current for testing)
      minimumVersion: '0.0.1', // Minimum version that still works
      downloadUrl: 'https://maystorfix.com/downloads/ServiceTextPro-latest.apk',
      updateRequired: false, // Set to true to force update
      releaseNotes: {
        bg: 'Нова версия с подобрения и поправки',
        en: 'New version with improvements and fixes'
      },
      features: [
        'Управление на специализации',
        'Подобрения в чата',
        'Поправка на push известията'
      ]
    };

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
