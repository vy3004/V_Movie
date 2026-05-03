export const WATCH_PARTY_CONFIG = {
  // Sync & Debounce
  SYNC_DEBOUNCE_MS: 400,
  TIME_SYNC_THRESHOLD_SEC: 1.5,
  HEARTBEAT_INTERVAL_MS: 10000, // 10s

  // Messages
  MAX_MESSAGES_IN_MEMORY: 150,
  MESSAGE_HISTORY_LIMIT: 50,
  MESSAGE_MAX_LENGTH: 500,

  // Room
  DEFAULT_MAX_PARTICIPANTS: 20,
  ROOM_CODE_LENGTH: 6,
  ROOM_CODE_RETRY_ATTEMPTS: 3,

  // Redis
  REDIS_STATE_TTL_SEC: 86400, // 24h
  REDIS_ROOM_INFO_TTL_SEC: 300, // 5 min

  // Realtime
  PRESENCE_TIMEOUT_MS: 30000, // 30s
  RECONNECT_DELAY_MS: 2000,
  SYNC_REQUEST_DELAYS: [1500, 3500, 6000], // ms
  RECOVERY_REQUEST_DELAYS: [2000, 4000], // ms

  // Video
  VIDEO_BUFFER_THRESHOLD_SEC: 2,
  AUTO_NEXT_COOLDOWN_MS: 3000,

  // Playlist
  MAX_PLAYLIST_ITEMS: 50,
  PLAYLIST_SORT_ORDER_INCREMENT: 1,

  // Permissions
  DEFAULT_GUEST_PERMISSIONS: {
    can_manage_users: false,
    can_control_media: false,
  },

  DEFAULT_ROOM_SETTINGS: {
    wait_for_all: false,
    guest_can_chat: true,
    allow_guest_control: false,
  },
} as const;

export const WATCH_PARTY_EVENTS = {
  // Broadcast events
  VIDEO_CONTROL: "video_control",
  CHANGE_EPISODE_SYNC: "change_episode_sync",
  REQUEST_SYNC_FROM_HOST: "request_sync_from_host",
  REQUEST_SYNC_FROM_ROOM: "request_sync_from_room",
  ROOM_SYNC_RESPONSE: "room_sync_response",
  HEARTBEAT_SYNC: "heartbeat_sync",
} as const;

export const WATCH_PARTY_ERRORS = {
  UNAUTHORIZED: "Unauthorized",
  MISSING_ROOM_ID: "Missing roomId",
  ROOM_NOT_FOUND: "Phòng không tồn tại hoặc đã đóng",
  ROOM_FULL: "Phòng đã đầy, không thể tham gia",
  ROOM_CLOSED: "Phòng này đã kết thúc",
  BLOCKED: "Bạn đã bị chặn khỏi phòng này",
  NO_PERMISSION: "Bạn không có quyền thực hiện hành động này",
  NO_CONTROL_PERMISSION: "Bạn không có quyền điều khiển video",
  NO_CHANGE_MOVIE_PERMISSION: "Bạn không có quyền đổi phim/tập",
  INVALID_EPISODE: "Tập phim không hợp lệ",
  SYSTEM_OVERLOAD: "Hệ thống quá tải, không thể tạo phòng",
} as const;

export const WATCH_PARTY_REDIS_KEYS = {
  roomState: (roomId: string) => `wp:room:${roomId}:state`,
  roomInfo: (roomId: string) => `wp:room:${roomId}:info`,
  roomLock: (roomId: string) => `wp:room:${roomId}:lock`,
} as const;

export const WATCH_PARTY_QUERY_KEYS = {
  room: (roomId: string) => ["watch-party", roomId] as const,
  participants: (roomId: string) => ["wp-participants", roomId] as const,
  playlist: (roomId: string) => ["wp-playlist", roomId] as const,
  messages: (roomId: string) => ["wp-messages", roomId] as const,
  movie: (slug: string) => ["wp-movie", slug] as const,
} as const;
