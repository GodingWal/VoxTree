import type { ContentItem } from "@/types/database";

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type TabsParamList = {
  Home: undefined;
  Browse: undefined;
  Voices: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  Story: { item: ContentItem };
  AddVoice: undefined;
  Pricing: undefined;
};
