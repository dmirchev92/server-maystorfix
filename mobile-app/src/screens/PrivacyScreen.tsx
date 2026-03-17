import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useTranslation } from 'react-i18next';

interface PrivacySection {
  id: string;
  title: string;
  content: string;
  expanded: boolean;
}

const PrivacyScreen: React.FC = () => {
  const { currentMode } = useSelector((state: RootState) => state.app);
  const { t } = useTranslation('common');
  
  const [sections, setSections] = useState<PrivacySection[]>([
    {
      id: 'data_collection',
      title: t('data_collection_title'),
      content: t('data_collection_content'),
      expanded: false,
    },
    {
      id: 'data_usage',
      title: t('data_usage_title'),
      content: t('data_usage_content'),
      expanded: false,
    },
    {
      id: 'sms_communication',
      title: t('sms_communication_title'),
      content: t('sms_communication_content'),
      expanded: false,
    },
    {
      id: 'data_storage',
      title: t('data_storage_title'),
      content: t('data_storage_content'),
      expanded: false,
    },
    {
      id: 'data_rights',
      title: t('data_rights_title'),
      content: t('data_rights_content'),
      expanded: false,
    },
    {
      id: 'data_retention',
      title: t('data_retention_title'),
      content: t('data_retention_content'),
      expanded: false,
    },
    {
      id: 'third_party',
      title: t('third_party_title'),
      content: t('third_party_content'),
      expanded: false,
    },
    {
      id: 'contact_info',
      title: t('contact_info_title'),
      content: t('contact_info_content'),
      expanded: false,
    },
  ]);

  const toggleSection = (sectionId: string) => {
    setSections(prev => 
      prev.map(section => 
        section.id === sectionId 
          ? { ...section, expanded: !section.expanded }
          : section
      )
    );
  };

  const openPrivacyEmail = () => {
    Linking.openURL('mailto:admin@snapfix.bg');
  };

  const openDPOEmail = () => {
    Linking.openURL('mailto:admin@snapfix.bg');
  };

  const openFullPrivacyPolicy = () => {
    Linking.openURL('https://snapfix.bg/privacy-policy');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('title')}</Text>
        <Text style={styles.subtitle}>
          {t('subtitle')}
        </Text>
        <Text style={styles.lastUpdated}>
          {t('last_updated')} {new Date().toLocaleDateString('bg-BG')}
        </Text>
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          🔒 {t('info_banner_text')}
        </Text>
      </View>

      <View style={styles.sectionsContainer}>
        {sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(section.id)}
            >
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.expandIcon}>
                {section.expanded ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
            
            {section.expanded && (
              <View style={styles.sectionContent}>
                <Text style={styles.sectionText}>{section.content}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={openPrivacyEmail}
        >
          <Text style={styles.actionButtonText}>{t('action_button_1')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={openDPOEmail}
        >
          <Text style={styles.actionButtonText}>{t('action_button_2')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={openFullPrivacyPolicy}
        >
          <Text style={styles.actionButtonText}>{t('action_button_3')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {t('footer_text_1')}
        </Text>
        <Text style={styles.footerText}>
          {t('footer_text_2')}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    lineHeight: 22,
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#95a5a6',
    fontStyle: 'italic',
  },
  infoBanner: {
    backgroundColor: '#e8f4fd',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  infoBannerText: {
    fontSize: 14,
    color: '#2980b9',
    lineHeight: 20,
    textAlign: 'center',
  },
  sectionsContainer: {
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  expandIcon: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: 'bold',
  },
  sectionContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  sectionText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  actionsContainer: {
    padding: 20,
  },
  actionButton: {
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
});

export default PrivacyScreen;
