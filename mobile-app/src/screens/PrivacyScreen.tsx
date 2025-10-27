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

interface PrivacySection {
  id: string;
  title: string;
  content: string;
  expanded: boolean;
}

const PrivacyScreen: React.FC = () => {
  const { currentMode } = useSelector((state: RootState) => state.app);
  
  const [sections, setSections] = useState<PrivacySection[]>([
    {
      id: 'data_collection',
      title: 'Какви данни събираме',
      content: `Събираме следните видове данни за предоставяне на нашите услуги:
      
• Име и телефонен номер на клиента
• Информация за пропуснати обаждания
• Съдържание на разговорите (AI и човешки)
• Данни за използване на услугата
• Технически данни (IP адрес, тип устройство)

Всички данни се събират в съответствие с GDPR и само за целите на услугата.`,
      expanded: false,
    },
    {
      id: 'data_usage',
      title: 'Как използваме данните',
      content: `Вашите данни се използват за:
      
• Предоставяне на AI автоматични отговори
• Свързване на пропуснати обаждания с клиенти
• Подобряване на качеството на услугата
• Спазване на правни изисквания
• Комуникация с вас относно услугата

Не продаваме, не споделяме и не използваме данните ви за други цели.`,
      expanded: false,
    },
    {
      id: 'ai_communication',
      title: 'AI комуникация и прозрачност',
      content: `Важно: Когато пропуснете обаждане, нашата AI система автоматично:

• Изпраща първоначален отговор на клиента
• Информира клиента, че това е автоматичен отговор
• Обяснява, че можете да поемете разговора
• Съхранява разговора за вашата референция

Клиентът винаги знае, че първоначалният отговор е от AI, а не от вас лично.`,
      expanded: false,
    },
    {
      id: 'data_storage',
      title: 'Съхранение и сигурност',
      content: `Вашите данни се съхраняват:
      
• В сигурни облачни сървъри в ЕС
• С криптиране в движение и в покой
• С ограничен достъп само за необходимия персонал
• За периода, необходим за услугата
• В съответствие с GDPR изискванията

Прилагаме строги мерки за сигурност и редовно проверяваме защитата.`,
      expanded: false,
    },
    {
      id: 'data_rights',
      title: 'Вашите права според GDPR',
      content: `Според GDPR имате право на:
      
• Достъп до всички данни, които съхраняваме за вас
• Корекция на неточни данни
• Изтриване на данните (право на забвене)
• Пренос на данните в друг формат
• Ограничаване на обработката
• Възражение срещу обработката
• Информация за автоматизирано вземане на решения

За упражняване на правата си, свържете се с нас.`,
      expanded: false,
    },
    {
      id: 'data_retention',
      title: 'Период на съхранение',
      content: `Данните се съхраняват за следните периоди:
      
• Данни за клиенти: 2 години след последна активност
• Разговори: 1 година след приключване
• Логове за сигурност: 6 месеца
• Данни за фактуриране: 7 години (законово изискване)
• GDPR съгласия: 5 години след оттегляне

След изтичането на периода, данните се изтриват автоматично.`,
      expanded: false,
    },
    {
      id: 'third_party',
      title: 'Трети страни и партньори',
      content: `Може да споделяме данни с:
      
• Viber Business API (за изпращане на съобщения)
• WhatsApp Business API (за изпращане на съобщения)
• Облачни доставчици (за съхранение на данни)
• Правни консултанти (при необходимост)

Всички партньори са GDPR съвместими и подписват договори за защита на данните.`,
      expanded: false,
    },
    {
      id: 'contact_info',
      title: 'Контактна информация',
      content: `За въпроси относно поверителността:

• Email: privacy@servicetextpro.com
• Телефон: +359 888 123 456
• Адрес: ул. "Примерна" 123, София 1000
• DPO: dpo@servicetextpro.com

Отговаряме на всички заявки в рамките на 30 дни.`,
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
    Linking.openURL('mailto:privacy@servicetextpro.com');
  };

  const openDPOEmail = () => {
    Linking.openURL('mailto:dpo@servicetextpro.com');
  };

  const downloadPrivacyPolicy = () => {
    // TODO: Implement PDF download
    Alert.alert(
      'Изтегляне на политиката',
      'Функцията за изтегляне ще бъде достъпна скоро.',
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Политика за поверителност</Text>
        <Text style={styles.subtitle}>
          Как защитаваме и използваме вашите данни
        </Text>
        <Text style={styles.lastUpdated}>
          Последна актуализация: {new Date().toLocaleDateString('bg-BG')}
        </Text>
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          🔒 Вашите данни са защитени според GDPR. Този документ обяснява как работим с вашата информация.
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
          <Text style={styles.actionButtonText}>📧 Въпроси за поверителност</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={openDPOEmail}
        >
          <Text style={styles.actionButtonText}>👤 Data Protection Officer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={downloadPrivacyPolicy}
        >
          <Text style={styles.actionButtonText}>📄 Изтегли политиката</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Този документ е в сила от 1 януари 2024 г. и се актуализира при промени в практиките ни.
        </Text>
        <Text style={styles.footerText}>
          За най-новата версия, моля проверете нашия уебсайт.
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




