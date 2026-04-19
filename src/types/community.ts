export interface SubscriptionItem {
  user_id?: string;
  movie_slug: string;
  movie_name: string;
  movie_poster: string;
  movie_status: string;
  last_known_episode_slug: string;
  has_new_episode: boolean;
  created_at?: string;
  updated_at?: string;
}

export type NotificationType =
  | "new_episode"
  | "comment_reply"
  | "comment_like"
  | "system";

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  movie_slug?: string;
  movie_name?: string;
  actor_name?: string;
  content: string;
  is_read: boolean;
  metadata?: {
    episode?: string;
    comment_id?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface CommentItem {
  id: string;
  movie_slug: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  likes_count: number;
  replies_count: number;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
  };
  is_liked_by_me?: boolean;
  isOptimistic?: boolean;
}

export interface AddCommentPayload {
  movieSlug: string;
  movieName?: string;
  content: string;
  parentId?: string | null;
  replyToId?: string | null;
  rootId?: string | null;
}

export interface SupabaseRawComment extends Omit<
  CommentItem,
  "replies_count" | "is_liked_by_me"
> {
  replies_count: { count: number }[];
}
