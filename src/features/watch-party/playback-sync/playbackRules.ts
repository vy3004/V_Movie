import {
  CanonicalPlaybackState,
  PlaybackAction,
  PlaybackStatePayload,
  PlayerState,
  SyncOrigin,
} from "./types";

export const toPlaybackStatePayload = (
  state: CanonicalPlaybackState,
  senderId?: string,
  action?: PlaybackAction,
  requestId?: string,
  origin: SyncOrigin = "user",
): PlaybackStatePayload => ({
  status: state.status ?? "pause",
  action: action ?? state.status ?? "pause",
  time: state.time,
  episodeSlug: state.episode_slug,
  activeControllerId: state.active_controller_id,
  activeControllerName: state.active_controller_name,
  version: state.version ?? 0,
  updatedAt: state.updated_at ?? Date.now(),
  senderId,
  requestId,
  origin,
});

export const canApplyPlaybackState = ({
  incomingVersion,
  lastAppliedVersion,
}: {
  incomingVersion: number;
  lastAppliedVersion: number;
}) => incomingVersion > lastAppliedVersion;

export const shouldSuppressRemoteWhilePendingLocal = ({
  pendingRequestId,
  pendingUntil,
  now,
}: {
  pendingRequestId: string | null;
  pendingUntil: number;
  now: number;
}) => pendingRequestId !== null && now < pendingUntil;

export const canAcceptRequestedSystemSync = ({
  payloadOrigin,
  payloadRequestId,
  pendingRequestId,
  currentActiveControllerId,
  payloadActiveControllerId,
}: {
  payloadOrigin?: SyncOrigin;
  payloadRequestId?: string;
  pendingRequestId: string | null;
  currentActiveControllerId?: string;
  payloadActiveControllerId?: string;
}) => {
  const isRequestedSystemSync =
    payloadOrigin === "system" &&
    !!payloadRequestId &&
    payloadRequestId === pendingRequestId;

  if (!isRequestedSystemSync) return false;

  if (currentActiveControllerId && payloadActiveControllerId !== currentActiveControllerId) {
    return false;
  }

  return true;
};

export const shouldIgnoreNonUserPlaybackPayload = ({
  origin,
  isRequestedSystemSync,
}: {
  origin?: SyncOrigin;
  isRequestedSystemSync: boolean;
}) => !!origin && origin !== "user" && !isRequestedSystemSync;

export const canTrustUserPlaybackPayload = ({
  origin,
  senderId,
  activeControllerId,
}: {
  origin?: SyncOrigin;
  senderId?: string;
  activeControllerId?: string;
}) => origin === "user" && !!senderId && senderId === activeControllerId;

export const canApplyHeartbeat = ({
  senderId,
  localUserId,
  heartbeatVersion,
  lastAppliedVersion,
  heartbeatControllerId,
  activeControllerId,
  localControlUntil,
  now,
  currentPlayerState,
  heartbeatTime,
}: {
  senderId?: string;
  localUserId?: string;
  heartbeatVersion: number;
  lastAppliedVersion: number;
  heartbeatControllerId?: string;
  activeControllerId?: string;
  localControlUntil: number;
  now: number;
  currentPlayerState: PlayerState | null;
  heartbeatTime: number;
}) => {
  if (senderId === localUserId) return false;
  if (heartbeatVersion !== lastAppliedVersion) return false;
  if (heartbeatControllerId !== activeControllerId) return false;
  if (now < localControlUntil) return false;
  if (currentPlayerState && heartbeatTime + 0.5 < currentPlayerState.time) return false;
  return true;
};

export const HEARTBEAT_INTERVAL_MS = 5_000;
export const PAUSED_HEARTBEAT_BURST_MS = 30_000;
export const PAUSED_HEARTBEAT_IDLE_MS = 30_000;
export const LOCAL_SEEK_INTENT_WINDOW_MS = 2500;
export const RECENT_CONTROL_INTENT_MS = 6000;

export const getPausedHeartbeatInterval = (pausedForMs: number) =>
  pausedForMs <= PAUSED_HEARTBEAT_BURST_MS
    ? HEARTBEAT_INTERVAL_MS
    : PAUSED_HEARTBEAT_IDLE_MS;

export const shouldMarkUserIntent = ({ canControl }: { canControl: boolean }) => canControl;

export const canCommitLocalPlaybackIntent = ({
  action,
  now,
  lastUserIntentAt,
  suppressLocalSyncUntil,
  remoteLockUntil,
  visibilityState,
}: {
  action: PlaybackAction;
  now: number;
  lastUserIntentAt: number;
  suppressLocalSyncUntil: number;
  remoteLockUntil: number;
  visibilityState: DocumentVisibilityState;
}) => {
  if (visibilityState !== "visible") return false;
  const hasRecentIntent = now - lastUserIntentAt <= LOCAL_SEEK_INTENT_WINDOW_MS;
  if (now < suppressLocalSyncUntil && !hasRecentIntent) return false;
  if (now < remoteLockUntil && !hasRecentIntent) return false;
  if (action === "seek" && !hasRecentIntent) return false;
  return true;
};

export const canRunFollowerSoftSync = ({
  hasPlayer,
  isHost,
  isHostPaused,
  canControl,
  now,
  lastUserIntentAt,
}: {
  hasPlayer: boolean;
  isHost: boolean;
  isHostPaused: boolean;
  canControl: boolean;
  now: number;
  lastUserIntentAt: number;
}) => {
  const hasRecentControlIntent = canControl && now - lastUserIntentAt <= RECENT_CONTROL_INTENT_MS;
  return hasPlayer && !isHost && !isHostPaused && !hasRecentControlIntent;
};
