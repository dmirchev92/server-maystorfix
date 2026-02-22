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

• Лични данни (име, имейл, телефон) при регистрация
• Бизнес информация (ЕИК, ДДС, категории услуги, сертификати)
• Профилна информация (снимки, описание, град)
• Данни за пропуснати обаждания и SMS съобщения
• Чат съобщения между майстори и клиенти
• Статистики за приходи и заявки
• Технически данни (IP адрес, тип устройство)

Всички данни се събират в съответствие с GDPR и само за целите на услугата.`,
      expanded: false,
    },
    {
      id: 'data_usage',
      title: 'Как използваме данните',
      content: `Вашите данни се използват за:

• Свързване на майстори с клиенти чрез платформата
• Изпращане на SMS известия при пропуснати обаждания
• Чат комуникация между майстори и клиенти
• Push известия за нови заявки и съобщения
• Система за случаи (cases) и наддаване (bidding)
• Бизнес аналитика и статистики
• Реферална програма и точкова система
• Спазване на правни изисквания

Не продаваме и не споделяме данните ви с трети страни за маркетинг цели.`,
      expanded: false,
    },
    {
      id: 'sms_communication',
      title: 'SMS комуникация',
      content: `Когато пропуснете обаждане, SnapFix може автоматично:

• Да изпрати SMS на клиента с вашия шаблон за отговор
• Да включи линк за чат, за да продължите разговора
• Да запише информацията за пропуснатото обаждане

SMS съобщенията се изпращат чрез Mobica SMS API. Вие контролирате шаблона и настройките за автоматични SMS от екрана за SMS настройки.`,
      expanded: false,
    },
    {
      id: 'data_storage',
      title: 'Съхранение и сигурност',
      content: `Вашите данни се съхраняват:

• На сигурни сървъри в Европейския съюз
• С криптирана връзка (HTTPS/TLS)
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

• Достъп до всички данни, които съхраняваме (чл. 15)
• Корекция на неточни данни (чл. 16)
• Изтриване на данните — право на забвене (чл. 17)
• Ограничаване на обработката (чл. 18)
• Пренос на данните в машиночетим формат (чл. 20)
• Възражение срещу обработката (чл. 21)
• Оттегляне на съгласие по всяко време

Упражнете правата си от екран "Права на данните" или пишете на admin@snapfix.bg.`,
      expanded: false,
    },
    {
      id: 'data_retention',
      title: 'Период на съхранение',
      content: `Данните се съхраняват за следните периоди:

• Бизнес данни и профил: 60 месеца (5 години)
• Чат разговори: 24 месеца (2 години)
• Аналитика и статистики: 12 месеца (1 година)
• Одитни записи: 84 месеца (7 години)
• Данни за фактуриране: 84 месеца (7 години — законово изискване)

След изтичането на периода, данните се изтриват или анонимизират автоматично.`,
      expanded: false,
    },
    {
      id: 'third_party',
      title: 'Трети страни и партньори',
      content: `Споделяме данни със следните доставчици:

• Mobica SMS API — за изпращане на SMS съобщения
• Firebase Cloud Messaging (Google) — за push известия
• Облачен хостинг доставчик — за съхранение на данни в ЕС

Всички партньори са GDPR съвместими и имат подписани договори за обработка на данни (DPA).`,
      expanded: false,
    },
    {
      id: 'contact_info',
      title: 'Контактна информация',
      content: `За въпроси относно поверителността:

• Имейл: admin@snapfix.bg
• Телефон: +359 88 462 9498
• Уебсайт: snapfix.bg

Надзорен орган: Комисия за защита на личните данни (КЗЛД) — https://cpdp.bg/

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
          onPress={openFullPrivacyPolicy}
        >
          <Text style={styles.actionButtonText}>🌐 Пълна политика на уебсайта</Text>
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




