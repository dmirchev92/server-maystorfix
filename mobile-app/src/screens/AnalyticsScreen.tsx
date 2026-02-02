import { Logger } from '../utils/Logger';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import theme from '../styles/theme';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 32;

const AnalyticsScreen: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState({
    gdprCompliance: 95,
    responseTime: [2.3, 1.8, 2.1, 1.5, 2.7, 1.9, 2.2],
    conversationCount: [12, 19, 8, 15, 22, 18, 25],
    platformUsage: {
      viber: 45,
      whatsapp: 35,
      telegram: 20,
    },
    dataRetention: {
      conversations: 30,
      consents: 24,
      auditLogs: 7,
    },
  });

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(115, 96, 242, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: theme.colors.primary.solid,
    },
  };

  useEffect(() => {
    // Simulate loading analytics data
    const loadAnalytics = () => {
      // In a real app, this would fetch from an API
      Logger.debug('Analytics data loaded');
    };

    loadAnalytics();
  }, []);

  return (
    <View style={theme.commonStyles.container}>
      <ScrollView 
        style={theme.commonStyles.scrollView} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={theme.commonStyles.header}>
          <Text style={theme.commonStyles.headerTitle}>
            Анализ & Статистика
          </Text>
          <Text style={theme.commonStyles.headerSubtitle}>
            GDPR-съвместими данни за вашия бизнес
          </Text>
        </View>

        {/* GDPR Compliance Score */}
        <View style={theme.commonStyles.card}>
          <Text style={theme.commonStyles.cardTitle}>GDPR Съответствие</Text>
          <View style={theme.commonStyles.complianceContainer}>
            <View style={theme.commonStyles.complianceCircle}>
              <Text style={theme.commonStyles.complianceScore}>
                {analyticsData.gdprCompliance}%
              </Text>
            </View>
            <Text style={styles.complianceText}>Съответствие с GDPR</Text>
          </View>
        </View>

        {/* Response Time Chart */}
        <View style={theme.commonStyles.card}>
          <Text style={theme.commonStyles.cardTitle}>Време за отговор</Text>
          <Text style={theme.commonStyles.cardSubtitle}>
            Средно време в секунди за последните 7 дни
          </Text>
          <BarChart
            data={{
              labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
              datasets: [
                {
                  data: analyticsData.responseTime,
                },
              ],
            }}
            width={chartWidth}
            height={220}
            chartConfig={chartConfig}
            yAxisLabel=""
            yAxisSuffix="s"
            style={theme.commonStyles.chart}
          />
        </View>

        {/* Conversation Count Chart */}
        <View style={theme.commonStyles.card}>
          <Text style={theme.commonStyles.cardTitle}>Брой разговори</Text>
          <Text style={theme.commonStyles.cardSubtitle}>
            Дневни разговори за последната седмица
          </Text>
          <LineChart
            data={{
              labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
              datasets: [
                {
                  data: analyticsData.conversationCount,
                },
              ],
            }}
            width={chartWidth}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={theme.commonStyles.chart}
          />
        </View>

        {/* Platform Usage */}
        <View style={theme.commonStyles.card}>
          <Text style={theme.commonStyles.cardTitle}>Използване на платформи</Text>
          <PieChart
            data={[
              {
                name: 'Viber',
                population: analyticsData.platformUsage.viber,
                color: '#7360F2',
                legendFontColor: '#7F7F7F',
                legendFontSize: 12,
              },
              {
                name: 'WhatsApp',
                population: analyticsData.platformUsage.whatsapp,
                color: '#25D366',
                legendFontColor: '#7F7F7F',
                legendFontSize: 12,
              },
              {
                name: 'Telegram',
                population: analyticsData.platformUsage.telegram,
                color: '#0088CC',
                legendFontColor: '#7F7F7F',
                legendFontSize: 12,
              },
            ]}
            width={chartWidth}
            height={220}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>

        {/* Data Retention */}
        <View style={theme.commonStyles.card}>
          <Text style={theme.commonStyles.cardTitle}>Съхранение на данни</Text>
          <View style={styles.dataRetentionContainer}>
            <View style={styles.dataRetentionItem}>
              <Text style={styles.dataRetentionNumber}>
                {analyticsData.dataRetention.conversations}
              </Text>
              <Text style={styles.dataRetentionLabel}>дни разговори</Text>
            </View>
            <View style={styles.dataRetentionItem}>
              <Text style={styles.dataRetentionNumber}>
                {analyticsData.dataRetention.consents}
              </Text>
              <Text style={styles.dataRetentionLabel}>месеца съгласия</Text>
            </View>
            <View style={styles.dataRetentionItem}>
              <Text style={styles.dataRetentionNumber}>
                {analyticsData.dataRetention.auditLogs}
              </Text>
              <Text style={styles.dataRetentionLabel}>години одит логове</Text>
            </View>
          </View>
        </View>

        {/* Privacy Notice */}
        <View style={theme.commonStyles.card}>
          <Text style={styles.privacyNoticeTitle}>🔒 Поверителност</Text>
          <Text style={styles.privacyNoticeText}>
            Всички данни се съхраняват локално на вашето устройство и не се 
            споделят с трети страни. Аналитиката е анонимна и GDPR-съвместима.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  complianceText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  dataRetentionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing.md,
  },
  dataRetentionItem: {
    alignItems: 'center',
  },
  dataRetentionNumber: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: 'bold',
    color: theme.colors.primary.solid,
  },
  dataRetentionLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  privacyNoticeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  privacyNoticeText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
});

export default AnalyticsScreen;
