import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import theme from '../styles/theme';

interface LanguageSwitcherProps {
  showLabel?: boolean;
  compact?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  showLabel = true,
  compact = false 
}) => {
  const { i18n } = useTranslation();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const currentLanguage = i18n.language || 'bg';

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <TouchableOpacity
          style={[
            styles.compactButton,
            currentLanguage === 'bg' && styles.compactButtonActive,
          ]}
          onPress={() => changeLanguage('bg')}
        >
          <Text
            style={[
              styles.compactButtonText,
              currentLanguage === 'bg' && styles.compactButtonTextActive,
            ]}
          >
            БГ
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.compactButton,
            currentLanguage === 'en' && styles.compactButtonActive,
          ]}
          onPress={() => changeLanguage('en')}
        >
          <Text
            style={[
              styles.compactButtonText,
              currentLanguage === 'en' && styles.compactButtonTextActive,
            ]}
          >
            EN
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showLabel && <Text style={styles.label}>🌐 Език / Language</Text>}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.buttonLeft,
            currentLanguage === 'bg' && styles.buttonActive,
          ]}
          onPress={() => changeLanguage('bg')}
        >
          <Text
            style={[
              styles.buttonText,
              currentLanguage === 'bg' && styles.buttonTextActive,
            ]}
          >
            🇧🇬 Български
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            styles.buttonRight,
            currentLanguage === 'en' && styles.buttonActive,
          ]}
          onPress={() => changeLanguage('en')}
        >
          <Text
            style={[
              styles.buttonText,
              currentLanguage === 'en' && styles.buttonTextActive,
            ]}
          >
            🇬🇧 English
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLeft: {
    borderRightWidth: 0.5,
    borderRightColor: theme.colors.border.default,
  },
  buttonRight: {
    borderLeftWidth: 0.5,
    borderLeftColor: theme.colors.border.default,
  },
  buttonActive: {
    backgroundColor: theme.colors.primary.solid,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text.secondary,
  },
  buttonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  compactContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  compactButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  compactButtonActive: {
    backgroundColor: theme.colors.primary.solid,
    borderColor: theme.colors.primary.solid,
  },
  compactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  compactButtonTextActive: {
    color: '#fff',
  },
});

export default LanguageSwitcher;
