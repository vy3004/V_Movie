import React from "react";
import { PlayerSyncRef } from "@/types";

export const PENDING_LOCAL_CONTROL_FALLBACK_MS = 6000;

export type PlaybackAction = "play" | "pause" | "seek";
export type PlaybackStatus = "play" | "pause";
export type SyncOrigin = "user" | "system" | "heartbeat" | "initial";

export type PlayerState = {
  time: number;
  isPaused: boolean;
};

export type CanonicalPlaybackState = {
  status?: PlaybackStatus;
  time: number;
  episode_slug?: string;
  active_controller_id?: string;
  active_controller_name?: string;
  version?: number;
  updated_at?: number;
  calculated_at?: number;
};

export type InitialPlaybackState = PlayerState & {
  status: PlaybackStatus;
  calculatedAt: number;
};

export interface PlaybackStatePayload {
  status: PlaybackStatus;
  action?: PlaybackAction;
  time: number;
  episodeSlug?: string;
  activeControllerId?: string;
  activeControllerName?: string;
  version: number;
  updatedAt: number;
  senderId?: string;
  requestId?: string;
  origin?: SyncOrigin;
}

export interface HeartbeatPayload {
  controllerId?: string;
  version: number;
  status: PlaybackStatus;
  isPaused: boolean;
  time: number;
  senderId?: string;
}

export interface PlaybackSyncRequestPayload {
  senderId?: string;
  requestId?: string;
}

export type WatchPartyPlayback = {
  playerSyncRef: React.MutableRefObject<PlayerSyncRef | null>;
  sendCommand: (
    action: PlaybackAction,
    time: number,
    episodeSlug?: string,
  ) => void;
  sendHeartbeat: (time: number, isPaused: boolean) => void;
  applyInitialState: () => void;
  activeControllerId?: string;
  activeControllerName?: string;
  initialState: { time?: number; isPaused?: boolean } | null;
  isLoadingRoom: boolean;
};
