export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Cases: undefined;
  MyBids: undefined;
  Points: undefined;
  IncomeDashboard: undefined;
  Notifications: undefined;
  Chat: undefined;
  ChatDetail: {
    conversationId: string;
    providerId: string;
    providerName: string;
  };
  PlaceBid: {
    caseId: string;
  };
  SMS: undefined;
  ReferralDashboard: undefined;
  Settings: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  Subscription: undefined;
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
