export interface WatchPartyState {
  status: "playing" | "paused";
  time: number;
  episode_slug: string;
  updated_at: number;
}
