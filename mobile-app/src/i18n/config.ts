import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import commonBG from '../locales/bg/common.json';
import commonEN from '../locales/en/common.json';
import authBG from '../locales/bg/auth.json';
import authEN from '../locales/en/auth.json';
import dashboardBG from '../locales/bg/dashboard.json';
import dashboardEN from '../locales/en/dashboard.json';
import subscriptionBG from '../locales/bg/subscription.json';
import subscriptionEN from '../locales/en/subscription.json';
import smsBG from '../locales/bg/sms.json';
import smsEN from '../locales/en/sms.json';
import mapBG from '../locales/bg/map.json';
import mapEN from '../locales/en/map.json';
import chatBG from '../locales/bg/chat.json';
import chatEN from '../locales/en/chat.json';
import settingsBG from '../locales/bg/settings.json';
import settingsEN from '../locales/en/settings.json';

const LANGUAGE_KEY = '@app_language';

// Language detector
const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage) {
        callback(savedLanguage);
      } else {
        callback('bg'); // Default to Bulgarian
      }
    } catch (error) {
      callback('bg');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources: {
      bg: {
        common: commonBG,
        auth: authBG,
        dashboard: dashboardBG,
        subscription: subscriptionBG,
        sms: smsBG,
        map: mapBG,
        chat: chatBG,
        settings: settingsBG,
      },
      en: {
        common: commonEN,
        auth: authEN,
        dashboard: dashboardEN,
        subscription: subscriptionEN,
        sms: smsEN,
        map: mapEN,
        chat: chatEN,
        settings: settingsEN,
      },
    },
    fallbackLng: 'bg',
    defaultNS: 'common',
    fallbackNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
