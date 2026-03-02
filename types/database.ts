export type Plan = "free" | "family" | "pro" | "premium";
export type VoiceStatus = "processing" | "ready" | "failed";
export type ClipStatus = "queued" | "processing" | "ready" | "failed";
export type ContentType = "video" | "story";

export type UserRole = "user" | "admin";

export interface User {
  id: string;
  name: string | null;
  plan: Plan;
  role: UserRole;
  voice_slots_used: number;
  videos_used: number;
  stories_used: number;
  clips_used_this_month: number;
  clips_reset_at: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyVoice {
  id: string;
  user_id: string;
  name: string;
  elevenlabs_voice_id: string | null;
  sample_audio_url: string | null;
  status: VoiceStatus;
  created_at: string;
  updated_at: string;
}

export interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  content_type: ContentType;
  series: string | null;
  episode_number: number | null;
  original_video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  age_range: string | null;
  tags: string[];
  is_premium: boolean;
  created_at: string;
}

export interface GeneratedClip {
  id: string;
  user_id: string;
  content_id: string;
  voice_id: string;
  output_audio_url: string | null;
  output_video_url: string | null;
  status: ClipStatus;
  cached: boolean;
  created_at: string;
  updated_at: string;
}
