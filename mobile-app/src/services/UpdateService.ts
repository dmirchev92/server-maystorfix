import { Alert, Linking, Platform, PermissionsAndroid } from 'react-native';
import RNFetchBlob from 'rn-fetch-blob';
import DeviceInfo from 'react-native-device-info';

const API_BASE_URL = 'https://maystorfix.com/api/v1';

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
      console.log('📱 Current app version:', currentVersion);

      const response = await fetch(`${API_BASE_URL}/app/version`);
      const result = await response.json();

      if (!result.success || !result.data) {
        console.log('❌ Failed to fetch version info');
        return { hasUpdate: false, currentVersion };
      }

      const versionInfo: VersionInfo = result.data;
      console.log('🌐 Latest version:', versionInfo.latestVersion);

      const comparison = this.compareVersions(currentVersion, versionInfo.latestVersion);
      const hasUpdate = comparison < 0;

      console.log(`📊 Version comparison: ${currentVersion} vs ${versionInfo.latestVersion} = ${hasUpdate ? 'UPDATE AVAILABLE' : 'UP TO DATE'}`);

      return { hasUpdate, versionInfo, currentVersion };
    } catch (error) {
      console.error('❌ Error checking for update:', error);
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
      onPress: () => this.downloadAndInstall(versionInfo.downloadUrl),
    });

    Alert.alert(title, message, buttons, { cancelable: !forceUpdate });
  }

  /**
   * Request storage permission for Android
   */
  private async requestStoragePermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      // For Android 10+ (API 29+), we don't need WRITE_EXTERNAL_STORAGE for app-specific directories
      const androidVersion = Platform.Version;
      if (typeof androidVersion === 'number' && androidVersion >= 29) {
        return true;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Разрешение за съхранение',
          message: 'Приложението се нуждае от достъп за изтегляне на обновлението',
          buttonNeutral: 'Питай ме по-късно',
          buttonNegative: 'Откажи',
          buttonPositive: 'Разреши',
        }
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('Permission error:', err);
      return false;
    }
  }

  /**
   * Download APK and trigger installation
   */
  async downloadAndInstall(downloadUrl: string): Promise<void> {
    if (Platform.OS !== 'android') {
      Alert.alert('Информация', 'Автоматичното обновление е налично само за Android. Моля посетете App Store за обновление.');
      return;
    }

    if (this.isDownloading) {
      Alert.alert('Информация', 'Изтеглянето вече е в процес...');
      return;
    }

    // Request permission
    const hasPermission = await this.requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Грешка', 'Нужно е разрешение за съхранение за да изтеглите обновлението.');
      return;
    }

    this.isDownloading = true;

    try {
      Alert.alert('⬇️ Изтегляне', 'Изтеглянето започна. Ще бъдете известени когато е готово.');

      const { config, fs } = RNFetchBlob;
      const downloadDir = fs.dirs.DownloadDir;
      const fileName = `ServiceTextPro-${Date.now()}.apk`;
      const filePath = `${downloadDir}/${fileName}`;

      console.log('📥 Downloading APK to:', filePath);
      console.log('📥 Download URL:', downloadUrl);

      const res = await config({
        fileCache: true,
        addAndroidDownloads: {
          useDownloadManager: true,
          notification: true,
          title: 'ServiceText Pro Update',
          description: 'Изтегляне на нова версия...',
          path: filePath,
          mime: 'application/vnd.android.package-archive',
        },
      }).fetch('GET', downloadUrl);

      console.log('✅ Download complete:', res.path());

      // Install the APK
      await this.installApk(res.path());

    } catch (error: any) {
      console.error('❌ Download error:', error);
      Alert.alert(
        'Грешка при изтегляне',
        `Не успяхме да изтеглим обновлението: ${error.message}\n\nИскате ли да отворите линка в браузъра?`,
        [
          { text: 'Откажи', style: 'cancel' },
          { text: 'Отвори в браузъра', onPress: () => Linking.openURL(downloadUrl) },
        ]
      );
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * Install APK file
   */
  private async installApk(filePath: string): Promise<void> {
    try {
      console.log('📦 Installing APK from:', filePath);

      // Use Android intent to install APK
      const { android } = RNFetchBlob;
      await android.actionViewIntent(
        filePath,
        'application/vnd.android.package-archive'
      );

      console.log('✅ Installation intent launched');
    } catch (error) {
      console.error('❌ Installation error:', error);
      Alert.alert(
        'Инсталиране',
        'APK файлът е изтеглен. Моля отворете папката Downloads и инсталирайте ръчно.',
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
      console.error('❌ Startup update check failed:', error);
    }
  }
}

export default UpdateService;
