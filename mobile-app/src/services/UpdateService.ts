import { Logger } from '../utils/Logger';
import { Alert, Linking } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const API_BASE_URL = 'https://snapfix.bg/api/v1';

interface VersionInfo {
  latestVersion: string;
  minimumVersion: string;
  downloadUrl: string;
  updateRequired: boolean;
  releaseNotes: {
    bg: string;
    en: string;
  };
  features: string[];
}

class UpdateService {
  private static instance: UpdateService;
  private isChecking = false;
  private isDownloading = false;

  public static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  /**
   * Compare version strings (e.g., "1.0.0" vs "1.0.1")
   */
  private compareVersions(current: string, latest: string): number {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const latestPart = latestParts[i] || 0;

      if (currentPart < latestPart) return -1;
      if (currentPart > latestPart) return 1;
    }
    return 0;
  }

  /**
   * Check if an update is available
   */
  async checkForUpdate(): Promise<{ hasUpdate: boolean; versionInfo?: VersionInfo; currentVersion: string }> {
    if (this.isChecking) {
      return { hasUpdate: false, currentVersion: '' };
    }

    this.isChecking = true;

    try {
      const currentVersion = DeviceInfo.getVersion();
      Logger.debug('📱 Current app version:', currentVersion);

      const response = await fetch(`${API_BASE_URL}/app/version`);
      const result = await response.json();

      if (!result.success || !result.data) {
        Logger.debug('❌ Failed to fetch version info');
        return { hasUpdate: false, currentVersion };
      }

      const versionInfo: VersionInfo = result.data;
      Logger.debug('🌐 Latest version:', versionInfo.latestVersion);

      const comparison = this.compareVersions(currentVersion, versionInfo.latestVersion);
      const hasUpdate = comparison < 0;

      Logger.debug(`📊 Version comparison: ${currentVersion} vs ${versionInfo.latestVersion} = ${hasUpdate ? 'UPDATE AVAILABLE' : 'UP TO DATE'}`);

      return { hasUpdate, versionInfo, currentVersion };
    } catch (error) {
      Logger.error('❌ Error checking for update:', error);
      return { hasUpdate: false, currentVersion: DeviceInfo.getVersion() };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Show update dialog to user
   */
  async promptUpdate(versionInfo: VersionInfo, currentVersion: string, forceUpdate = false): Promise<void> {
    const title = forceUpdate ? '⚠️ Задължително обновление' : '🎉 Налична е нова версия!';
    const message = `Налична е версия ${versionInfo.latestVersion}\n\nВашата версия: ${currentVersion}\n\n${versionInfo.releaseNotes?.bg || 'Нови подобрения и поправки'}`;

    const buttons: any[] = [];

    if (!forceUpdate) {
      buttons.push({
        text: 'По-късно',
        style: 'cancel',
      });
    }

    buttons.push({
      text: 'Обнови сега',
      onPress: () => this.openPlayStore(),
    });

    Alert.alert(title, message, buttons, { cancelable: !forceUpdate });
  }

  /**
   * Open the app in Google Play Store for updates
   */
  async openPlayStore(): Promise<void> {
    const packageName = 'com.servicetextpro';
    const playStoreUrl = `market://details?id=${packageName}`;
    const browserUrl = `https://play.google.com/store/apps/details?id=${packageName}`;

    try {
      Logger.debug('📱 Opening Google Play Store for update');
      
      // Try to open Play Store app first
      const canOpenPlayStore = await Linking.canOpenURL(playStoreUrl);
      if (canOpenPlayStore) {
        await Linking.openURL(playStoreUrl);
      } else {
        // Fallback to browser if Play Store app not available
        await Linking.openURL(browserUrl);
      }
    } catch (error: any) {
      Logger.error('❌ Error opening Play Store:', error);
      Alert.alert(
        'Грешка',
        'Не може да се отвори Google Play Store. Моля, обновете приложението ръчно.',
        [{ text: 'OK' }]
      );
    }
  }

  /**
   * Check for updates on app startup
   */
  async checkOnStartup(): Promise<void> {
    try {
      const { hasUpdate, versionInfo, currentVersion } = await this.checkForUpdate();

      if (hasUpdate && versionInfo) {
        // Check if update is required (minimum version check)
        const isRequired = this.compareVersions(currentVersion, versionInfo.minimumVersion) < 0 || versionInfo.updateRequired;
        
        // Delay the prompt slightly to let the app load
        setTimeout(() => {
          this.promptUpdate(versionInfo, currentVersion, isRequired);
        }, 2000);
      }
    } catch (error) {
      Logger.error('❌ Startup update check failed:', error);
    }
  }
}

export default UpdateService;
