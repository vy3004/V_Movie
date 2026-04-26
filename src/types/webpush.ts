// Payload mà Deno Worker/QStash sẽ gửi sang
export interface PushPayload {
  title: string;
  body: string;
  icon: string;
  badge: string;
  url?: string;
  image?: string;
  movieSlug?: string;
  episodeSlug?: string;
  cursor?: string;
}

// Cấu trúc của Object Subscription do trình duyệt tạo ra
interface WebPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Cấu trúc bảng push_subscriptions trong Database
export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  subscription: WebPushSubscription;
}
