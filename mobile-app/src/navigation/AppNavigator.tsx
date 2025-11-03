import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import FCMService from '../services/FCMService';

// Import all screens
import ModernDashboardScreen from '../screens/ModernDashboardScreen';
import ConsentScreen from '../screens/ConsentScreen';
import ProviderProfileScreen from '../screens/ProviderProfileScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import DataRightsScreen from '../screens/DataRightsScreen';
import ChatScreen from '../screens/ChatScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import SMSScreen from '../screens/SMSScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ReferralDashboardScreen from '../screens/ReferralDashboardScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import CasesScreen from '../screens/CasesScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';


// Import components
import ConsentBanner from '../components/ConsentBanner';
import GDPRStatus from '../components/GDPRStatus';
import QuickActions from '../components/QuickActions';

// Import types
import { RootStackParamList, MainTabParamList, SettingsStackParamList } from './types';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const SettingsStack = createStackNavigator<SettingsStackParamList>();

// Main tab navigator for authenticated users
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          paddingBottom: 8,
          paddingTop: 8,
          height: 65,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={ModernDashboardScreen}
        options={{
          tabBarLabel: 'Табло',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Cases"
        component={CasesScreen}
        options={{
          tabBarLabel: 'Заявки',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>📋</Text>
          ),
        }}
      />
      <Tab.Screen
        name="IncomeDashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Табло',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>📊</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: 'Чат',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>💬</Text>
          ),
        }}
      />
      <Tab.Screen
        name="SMS"
        component={SMSScreen}
        options={{
          tabBarLabel: 'SMS',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>📱</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ChatDetail"
        component={ChatDetailScreen}
        options={{
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="ReferralDashboard"
        component={ReferralDashboardScreen}
        options={{
          tabBarLabel: 'Препоръки',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>🎯</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Настройки',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ fontSize: size, color }}>⚙️</Text>
          ),
        }}
      />
      <Tab.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          tabBarButton: () => null, // Hide from tab bar
          headerShown: true,
          headerTitle: 'Абонаментни Планове',
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
        }}
      />
    </Tab.Navigator>
  );
}
// Settings stack navigator
function SettingsStackNavigator() {
  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#007AFF',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <SettingsStack.Screen
        name="SettingsMain"
        component={SettingsMainScreen}
        options={{ title: 'Настройки' }}
      />
      <SettingsStack.Screen
        name="Consent"
        component={ConsentScreen}
        options={{ title: 'Съгласие за данни' }}
      />
      <SettingsStack.Screen
        name="Privacy"
        component={PrivacyScreen}
        options={{ title: 'Политика за поверителност' }}
      />
      <SettingsStack.Screen
        name="DataRights"
        component={DataRightsScreen}
        options={{ title: 'Права за данни' }}
      />
      <SettingsStack.Screen
        name="ProviderProfile"
        component={ProviderProfileScreen}
        options={{ title: 'Профил на доставчик' }}
      />
    </SettingsStack.Navigator>
  );
}

// Settings main screen
function SettingsMainScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <GDPRStatus 
          onNavigateToConsent={() => navigation.navigate('Consent')}
          onNavigateToPrivacy={() => navigation.navigate('Privacy')}
          onNavigateToDataRights={() => navigation.navigate('DataRights')}
        />
        <QuickActions 
          onNavigateToChat={() => navigation.navigate('Chat')}
          onNavigateToContacts={() => navigation.navigate('Dashboard')}
          onNavigateToSettings={() => navigation.navigate('Settings')}
        />
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GDPR & Поверителност</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Consent')}
          >
            <Text style={styles.menuItemText}>Управление на съгласието</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Privacy')}
          >
            <Text style={styles.menuItemText}>Политика за поверителност</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('DataRights')}
          >
            <Text style={styles.menuItemText}>Права за данни</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Профил</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('ProviderProfile')}
          >
            <Text style={styles.menuItemText}>Профил на доставчик</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <ConsentBanner 
        visible={true}
        onAccept={() => console.log('Consent accepted')}
        onDecline={() => console.log('Consent declined')}
        onCustomize={() => navigation.navigate('Consent')}
      />
    </View>
  );
}

// Main app navigator
export default function AppNavigator() {
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // Set navigation reference for FCM deep linking
    if (navigationRef.current) {
      FCMService.getInstance().setNavigationRef(navigationRef.current);
    }
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Main" component={MainTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  menuItemArrow: {
    fontSize: 18,
    color: '#007AFF',
  },
});

