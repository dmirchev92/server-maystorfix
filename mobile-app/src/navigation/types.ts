export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Cases: undefined;
  IncomeDashboard: undefined;
  Chat: undefined;
  ChatDetail: {
    conversationId: string;
    providerId: string;
    providerName: string;
  };
  SMS: undefined;
  ReferralDashboard: undefined;
  Settings: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
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
