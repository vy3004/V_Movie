import { User } from "@supabase/supabase-js";

export type UserProfile = User & {
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  role?: string;
  notification_settings?: NotificationSettings | null;
};

export interface NotificationSettings {
  web_push: boolean;
  new_episode: boolean;
  watch_party: boolean;
  comment_reply: boolean;
}
