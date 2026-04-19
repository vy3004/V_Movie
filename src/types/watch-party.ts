// 1. Định nghĩa Settings cấu hình trong Room (Cột JSONB)
export interface RoomSettings {
  wait_for_all: boolean;
  guest_can_chat: boolean;
  allow_guest_control: boolean;
}

// 2. Định nghĩa chi tiết Phòng Xem Chung (Bảng watch_party_rooms)
export interface WatchPartyRoom {
  id: string;
  room_code: string;
  host_id: string;
  current_movie_slug: string | null;
  current_episode_slug: string | null;
  movie_image: string | null;
  title: string;
  is_private: boolean;
  max_participants: number;
  is_active: boolean;
  settings: RoomSettings;
  created_at: string;
  updated_at: string;
  host?: UserProfile;
  participants?: { count: number }[];
}

// 3. Định nghĩa Quyền hạn chi tiết (Cột JSONB trong bảng participants)
export interface ParticipantPermissions {
  can_manage_users: boolean;
  can_control_media: boolean;
}

// Định nghĩa phụ: Profile của user lấy từ bảng profiles khi JOIN
export interface UserProfile {
  full_name: string | null;
  avatar_url: string | null;
}

// 4. Định nghĩa Thành viên (Bảng watch_party_participants)
export type ParticipantRole = "host" | "guest";
export type ParticipantStatus = "pending" | "approved" | "blocked";

export interface WatchPartyParticipant {
  id: string;
  room_id: string;
  user_id: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  permissions: ParticipantPermissions;
  is_muted: boolean;
  created_at: string;
  profiles?: UserProfile;
}

// 5. Định nghĩa Hàng đợi Phim (Bảng watch_party_playlist)
export interface WatchPartyPlaylist {
  id: string;
  room_id: string;
  movie_slug: string;
  movie_name: string;
  episode_slug: string;
  thumb_url: string | null;
  sort_order: number;
  added_by: string | null;
  created_at: string;
}

// 6. Định nghĩa trạng thái Video trên Redis (Phục vụ Sync Real-time)
export interface WatchPartyVideoState {
  status?: "play" | "pause";
  time: number;
  episode_slug?: string;
  updated_at: number;
}

export interface UserPresence {
  user_id: string;
  status: "online" | "away";
  time?: number;
  is_paused?: boolean;
  updated_at?: string;
}

// Định nghĩa kiểu cho cái Cầu nối (Ref) giữa UI và Video
export interface PlayerSyncRef {
  syncFromRemote: (action: "play" | "pause" | "seek", time: number) => void;
  getCurrentState: () => { time: number; isPaused: boolean } | null;
}

// Định nghĩa kiểu dữ liệu cho lệnh điều khiển mạng
export interface VideoControlPayload {
  action: "play" | "pause" | "seek";
  time: number;
  episodeSlug?: string;
  senderId: string;
}

// Định nghĩa kiểu dữ liệu lưu xuống Database
export interface SyncApiPayload {
  roomId: string;
  status?: "play" | "pause";
  time: number;
  episodeSlug?: string;
}

export interface PlaylistItem {
  id: string;
  movie_name: string;
  movie_slug: string;
  thumb_url: string;
  episode_slug: string;
  user_id: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
  };
}
