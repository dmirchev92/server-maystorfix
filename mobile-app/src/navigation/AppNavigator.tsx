import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import FCMService from '../services/FCMService';

// Import all screens
import ModernDashboardScreen from '../screens/ModernDashboardScreen';
import CustomerDashboardScreen from '../screens/CustomerDashboardScreen';
import CustomerCasesScreen from '../screens/CustomerCasesScreen';
import CreateCaseScreen from '../screens/CreateCaseScreen';
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
import PointsScreen from '../screens/PointsScreen';
import BuyPointsScreen from '../screens/BuyPointsScreen';
import PricingScreen from '../screens/PricingScreen';
import VipVisibilityScreen from '../screens/VipVisibilityScreen';
import MyBidsScreen from '../screens/MyBidsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PlaceBidScreen from '../screens/PlaceBidScreen';
import MapSearchScreen from '../screens/MapSearchScreen';
import SearchScreen from '../screens/SearchScreen';
import CaseBidsScreen from '../screens/CaseBidsScreen';
import LocationScheduleScreen from '../screens/LocationScheduleScreen';
import StatisticsScreen from '../screens/StatisticsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';


// Import components
import ConsentBanner from '../components/ConsentBanner';
import GDPRStatus from '../components/GDPRStatus';
import QuickActions from '../components/QuickActions';
import JobAlertModal from '../components/JobAlertModal';

// Import types
import { RootStackParamList, MainTabParamList, SettingsStackParamList, CustomerTabParamList } from './types';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const CustomerTab = createBottomTabNavigator<CustomerTabParamList>();
const SettingsStack = createStackNavigator<SettingsStackParamList>();

// Provider Tab Navigator (Original)
function ProviderTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          display: 'none',
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
        name="MapSearch" 
        component={MapSearchScreen}
        options={{
          tabBarLabel: 'Карта',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>🗺️</Text>
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
        name="MyBids"
        component={MyBidsScreen}
        options={{
          tabBarLabel: 'Оферти',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>💰</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Points"
        component={PointsScreen}
        options={{
          tabBarLabel: 'Точки',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>💎</Text>
          ),
        }}
      />
      <Tab.Screen
        name="VipVisibility"
        component={VipVisibilityScreen}
        options={{
          tabBarButton: () => null, // Hide from tab bar, accessed from dashboard
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
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Известия',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>🔔</Text>
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
        name="PlaceBid"
        component={PlaceBidScreen}
        options={{
          tabBarButton: () => null, // Hide from tab bar
          headerShown: true,
          headerTitle: 'Направете оферта',
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
        }}
      />
      <Tab.Screen
        name="ReferralDashboard"
        component={ReferralDashboardScreen}
        options={{
          tabBarButton: () => null,
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
      <Tab.Screen
        name="Consent"
        component={ConsentScreen}
        options={{
          tabBarButton: () => null, // Hide from tab bar
          headerShown: true,
          headerTitle: 'Настройки за поверителност',
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
        }}
      />
      <Tab.Screen
        name="LocationSchedule"
        component={LocationScheduleScreen}
        options={{
          tabBarButton: () => null, // Hide from tab bar
          headerShown: true,
          headerTitle: 'График за локация',
          headerStyle: {
            backgroundColor: '#4F46E5',
          },
          headerTintColor: '#fff',
        }}
      />
      <Tab.Screen
        name="Statistics"
        component={StatisticsScreen}
        options={{
          tabBarButton: () => null, // Hide from tab bar
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          tabBarButton: () => null, // Hide from tab bar
          headerShown: true,
          headerTitle: 'Настройки за известия',
          headerStyle: {
            backgroundColor: '#0F172A',
          },
          headerTintColor: '#fff',
        }}
      />
    </Tab.Navigator>
  );
}

// Customer Tab Navigator (New)
function CustomerTabNavigator() {
  return (
    <CustomerTab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          display: 'none',
        },
        headerShown: false,
      }}
    >
      <CustomerTab.Screen 
        name="Dashboard" 
        component={CustomerDashboardScreen}
        options={{
          tabBarLabel: 'Начало',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>🏠</Text>
          ),
        }}
      />
      <CustomerTab.Screen 
        name="Search" 
        component={SearchScreen}
        options={{
          tabBarLabel: 'Търсене',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>🔍</Text>
          ),
        }}
      />
      <CustomerTab.Screen
        name="MyCases"
        component={CustomerCasesScreen}
        options={{
          tabBarLabel: 'Моите заявки',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>📋</Text>
          ),
        }}
      />
      <CustomerTab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: 'Съобщения',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ color, fontSize: size }}>💬</Text>
          ),
        }}
      />
      <CustomerTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Профил',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ fontSize: size, color }}>👤</Text>
          ),
        }}
      />
      <CustomerTab.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
      <CustomerTab.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
      <CustomerTab.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          tabBarButton: () => null,
          headerShown: true,
          headerTitle: 'Настройки за известия',
          headerStyle: {
            backgroundColor: '#0F172A',
          },
          headerTintColor: '#fff',
        }}
      />
      <CustomerTab.Screen
        name="Consent"
        component={ConsentScreen}
        options={{
          tabBarButton: () => null,
          headerShown: true,
          headerTitle: 'Настройки за поверителност',
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
        }}
      />
    </CustomerTab.Navigator>
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
export default function AppNavigator({ userRole }: { userRole?: string }) {
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // Set navigation reference for FCM deep linking
    if (navigationRef.current) {
      FCMService.getInstance().setNavigationRef(navigationRef.current);
    }
  }, []);

  const initialRoute = userRole === 'customer' ? 'CustomerMain' : 'Main';

  return (
    <NavigationContainer ref={navigationRef}>
      <View style={{ flex: 1 }}>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Main" component={ProviderTabNavigator} />
          <Stack.Screen name="CustomerMain" component={CustomerTabNavigator} />
          <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
          <Stack.Screen name="MapSearch" component={MapSearchScreen} />
          <Stack.Screen 
            name="CreateCase" 
            component={CreateCaseScreen}
            options={{
              headerShown: true,
              title: 'Публикуване на заявка',
              presentation: 'modal',
            }}
          />
          <Stack.Screen 
            name="CaseBids" 
            component={CaseBidsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="BuyPoints" 
            component={BuyPointsScreen}
            options={{
              headerShown: true,
              title: 'Закупуване на точки',
            }}
          />
          <Stack.Screen 
            name="Pricing" 
            component={PricingScreen}
            options={{
              headerShown: true,
              title: 'Цени и планове',
            }}
          />
        </Stack.Navigator>
        {/* <JobAlertModal /> */}
      </View>
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

