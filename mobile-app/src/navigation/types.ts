export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  Main: undefined;
  CustomerMain: undefined;
  MapSearch: undefined;
  CreateCase: undefined;
  ChatDetail: {
    conversationId: string;
    providerId: string;
    providerName: string;
  };
  CaseBids: {
    caseId: string;
    caseDescription?: string;
  };
};

export type CustomerTabParamList = {
  Dashboard: undefined;
  Search: undefined;
  MyCases: undefined;
  Chat: undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  MapSearch: undefined;
  Cases: undefined;
  MyBids: undefined;
  Points: undefined;
  IncomeDashboard: undefined;
  Notifications: undefined;
  Chat: undefined;
  PlaceBid: {
    caseId: string;
  };
  SMS: undefined;
  ReferralDashboard: undefined;
  Settings: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  Subscription: undefined;
  Consent: undefined;
  LocationSchedule: undefined;
  Statistics: undefined;
  NotificationSettings: undefined;
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  Consent: undefined;
  Privacy: undefined;
  DataRights: undefined;
  ProviderProfile: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
