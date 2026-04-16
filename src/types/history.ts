export interface EpisodeProgress {
  ep_last_time: number;
  ep_duration: number;
  ep_is_finished: boolean;
  ep_updated_at: string;
}

export interface HistoryItem {
  id?: string;
  user_id?: string;
  device_id?: string;
  movie_slug: string;
  movie_name: string;
  movie_poster: string;
  last_episode_slug: string;
  last_episode_of_movie_slug: string;
  episodes_progress: Record<string, EpisodeProgress>;
  is_finished: boolean;
  updated_at: string;
}

export interface HistoryUpdatePayload {
  user_id?: string;
  device_id?: string;
  movie_slug: string;
  movie_name?: string;
  movie_poster?: string;
  last_episode_slug: string;
  last_episode_of_movie_slug: string;
  current_time: number;
  duration: number;
}
