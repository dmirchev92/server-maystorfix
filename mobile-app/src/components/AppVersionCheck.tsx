import { Logger } from '../utils/Logger';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
// Import version from package.json
const packageJson = require('../../package.json');

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

const AppVersionCheck: React.FC = () => {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    checkAppVersion();
  }, []);

  const checkAppVersion = async () => {
    try {
      const currentVersion = packageJson.version;
      
      const response = await fetch('https://snapfix.bg/api/v1/app/version');
      const data = await response.json();

      if (data.success && data.data) {
        const versionData: VersionInfo = data.data;
        setVersionInfo(versionData);

        // Compare versions
        const needsUpdate = compareVersions(currentVersion, versionData.latestVersion) < 0;
        const isBelowMinimum = compareVersions(currentVersion, versionData.minimumVersion) < 0;

        if (needsUpdate || versionData.updateRequired || isBelowMinimum) {
          setUpdateRequired(isBelowMinimum || versionData.updateRequired);
          setShowUpdateModal(true);
        }
      }
    } catch (error) {
      Logger.error('Error checking app version:', error);
    }
  };

  const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }

    return 0;
  };

  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Разрешение за изтегляне',
            message: 'Приложението се нуждае от разрешение за изтегляне на обновлението',
            buttonNeutral: 'Попитай по-късно',
            buttonNegative: 'Откажи',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        Logger.warn(err);
        return false;
      }
    }
    return true;
  };

  const handleUpdate = async () => {
    if (!versionInfo?.downloadUrl) return;

    // Simple approach: Just open the download URL in browser
    // User will download from browser and install manually
    Alert.alert(
      'Изтегляне на обновление',
      'Ще бъдете пренасочени към браузъра за изтегляне на обновлението.\n\nСлед изтегляне, отворете файла за инсталиране.',
      [
        {
          text: 'Изтегли',
          onPress: async () => {
            try {
              await Linking.openURL(versionInfo.downloadUrl);
              // Close the modal after opening browser
              setShowUpdateModal(false);
            } catch (error) {
              Logger.error('Error opening download link:', error);
              Alert.alert(
                'Грешка',
                'Не може да се отвори линка. Моля, копирайте го ръчно:\n\n' + versionInfo.downloadUrl
              );
            }
          },
        },
        { text: 'Отказ', style: 'cancel' },
      ]
    );
  };

  const openInBrowser = async () => {
    if (!versionInfo?.downloadUrl) return;
    
    try {
      await Linking.openURL(versionInfo.downloadUrl);
    } catch (error) {
      Alert.alert(
        'Изтегляне',
        'Моля, отворете браузъра и посетете:\n\n' + versionInfo.downloadUrl,
        [
          { text: 'Отвори в браузър', onPress: () => {
            Linking.openURL('https://snapfix.bg/downloads/SnapFix-latest.apk');
          }},
          { text: 'OK' }
        ]
      );
    }
  };

  const handleLater = () => {
    if (!updateRequired) {
      setShowUpdateModal(false);
    } else {
      Alert.alert(
        'Задължително обновяване',
        'Тази версия на приложението вече не се поддържа. Моля, обновете за да продължите.'
      );
    }
  };

  if (!showUpdateModal || !versionInfo) {
    return null;
  }

  return (
    <Modal
      visible={showUpdateModal}
      transparent={true}
      animationType="fade"
      onRequestClose={handleLater}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerIcon}>🚀</Text>
            <Text style={styles.headerTitle}>
              {updateRequired ? 'Задължително обновяване' : 'Налична е нова версия'}
            </Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.versionText}>
              Версия {versionInfo.latestVersion}
            </Text>
            
            <Text style={styles.releaseNotes}>
              {versionInfo.releaseNotes.bg}
            </Text>

            {versionInfo.features && versionInfo.features.length > 0 && (
              <View style={styles.featuresContainer}>
                <Text style={styles.featuresTitle}>Какво е ново:</Text>
                {versionInfo.features.map((feature, index) => (
                  <Text key={index} style={styles.featureItem}>
                    • {feature}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleUpdate}
            >
              <Text style={styles.updateButtonText}>
                📥 Изтегли обновление
              </Text>
            </TouchableOpacity>

            {!updateRequired && (
              <TouchableOpacity
                style={styles.laterButton}
                onPress={handleLater}
              >
                <Text style={styles.laterButtonText}>По-късно</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  versionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 12,
    textAlign: 'center',
  },
  releaseNotes: {
    fontSize: 14,
    color: '#CBD5E1',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  featuresContainer: {
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  featureItem: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
    lineHeight: 18,
  },
  actions: {
    padding: 20,
    gap: 12,
  },
  updateButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  laterButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  laterButtonText: {
    fontSize: 14,
    color: '#94A3B8',
  },
});

export default AppVersionCheck;
