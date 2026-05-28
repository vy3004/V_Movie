"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Player from "video.js/dist/types/player";
import { toast } from "sonner";
import {
  canCommitLocalPlaybackIntent,
  canRunFollowerSoftSync,
  getPausedHeartbeatInterval,
  HEARTBEAT_INTERVAL_MS,
  PlaybackAction,
  PlayerState,
  shouldMarkUserIntent,
} from "./index";

type ExtendedPlayer = Player & {
  scrubbing?: () => boolean;
  tech_?: unknown;
};

type PlaybackPlayerBridgeProps = {
  isWatchParty: boolean;
  canControl: boolean;
  isHost: boolean;
  getPlayer: () => ExtendedPlayer | null;
  isComponentUnmounted?: () => boolean;
  onPlaySync?: (time: number) => void;
  onPauseSync?: (time: number) => void;
  onSeekSync?: (time: number) => void;
  onHeartbeatSync?: (time: number, isPaused: boolean) => void;
};

const getPlayerTime = (p: ExtendedPlayer) =>
  typeof p.currentTime === "function" ? (p.currentTime() as number) : 0;

const setPlayerTime = (p: ExtendedPlayer, t: number) => {
  if (typeof p.currentTime === "function") p.currentTime(t);
};

export function usePlaybackPlayerBridge({
  isWatchParty,
  canControl,
  isHost,
  getPlayer,
  isComponentUnmounted = () => false,
  onPlaySync,
  onPauseSync,
  onSeekSync,
  onHeartbeatSync,
}: PlaybackPlayerBridgeProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const targetHostTime = useRef(0);
  const isHostPaused = useRef(true);
  const lastSyncReceivedAt = useRef(0);
  const pendingInitialSync = useRef<{ action: PlaybackAction; time: number } | null>(null);
  const remoteLockUntil = useRef(0);
  const suppressLocalSyncUntil = useRef(0);
  const lastUserIntentAt = useRef(0);
  const pendingAction = useRef<PlaybackAction | null>(null);
  const networkTimer = useRef<NodeJS.Timeout | null>(null);
  const pausedSince = useRef<number | null>(null);
  const heartbeatTimer = useRef<number | null>(null);

  const getSyncedTargetTime = useCallback(() => {
    if (isHostPaused.current) return targetHostTime.current;
    return targetHostTime.current + (Date.now() - lastSyncReceivedAt.current) / 1000;
  }, []);

  const runSoftSync = useCallback(() => {
    const player = getPlayer();
    if (isComponentUnmounted()) return;
    if (!canRunFollowerSoftSync({
      hasPlayer: !!player,
      isHost,
      isHostPaused: isHostPaused.current,
      canControl,
      now: Date.now(),
      lastUserIntentAt: lastUserIntentAt.current,
    })) return;
    if (!player) return;

    const isPlayerBusy =
      player.seeking() ||
      (typeof player.readyState === "function" && player.readyState() < 2);
    if (isPlayerBusy) return;

    const actualHostTime = getSyncedTargetTime();
    const myTime = getPlayerTime(player);
    const gap = actualHostTime - myTime;

    if (Math.abs(gap) > 3.0) {
      setPlayerTime(player, actualHostTime);
    } else if (Math.abs(gap) > 0.1) {
      const newRate = Math.max(0.9, Math.min(1.1, 1.0 + gap * 0.1));
      if (typeof player.playbackRate === "function") player.playbackRate(newRate);
    } else {
      if (typeof player.playbackRate === "function") player.playbackRate(1.0);
    }
  }, [canControl, getPlayer, getSyncedTargetTime, isComponentUnmounted, isHost]);

  const syncFromRemote = useCallback((action: PlaybackAction, time: number) => {
    const player = getPlayer();
    if (!player) return;

    if (typeof player.readyState === "function" && player.readyState() < 1) {
      pendingInitialSync.current = { action, time };
      return;
    }

    const isCurrentlyPlaying = typeof player.paused === "function" ? !player.paused() : false;
    const diff = Math.abs(getPlayerTime(player) - time);
    const isSameAction =
      (action === "play" && isCurrentlyPlaying) ||
      (action === "pause" && !isCurrentlyPlaying);

    suppressLocalSyncUntil.current = Date.now() + 2000;
    remoteLockUntil.current = Date.now() + 2000;
    targetHostTime.current = time;
    lastSyncReceivedAt.current = Date.now();

    if (action === "play") {
      isHostPaused.current = false;
      if (isSameAction && diff <= 1.5) return;
      if (diff > 1.5) {
        setIsSyncing(true);
        setPlayerTime(player, time);
        setTimeout(() => {
          if (!isComponentUnmounted()) setIsSyncing(false);
        }, 1500);
      }

      if (typeof player.paused === "function" && player.paused()) {
        const playPromise = player.play();
        if (playPromise !== undefined && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            if (!getPlayer() || player.isDisposed()) return;
            player.muted(true);
            player.play()?.catch(() => {});
            toast.info("Tự động phát (đã tắt tiếng)");
          });
        }
      }
    } else if (action === "pause") {
      isHostPaused.current = true;
      if (typeof player.playbackRate === "function") player.playbackRate(1.0);

      if (typeof player.paused === "function" && !player.paused()) {
        suppressLocalSyncUntil.current = Date.now() + 1500;
        remoteLockUntil.current = Date.now() + 1500;
        player.pause();
      }
      if (isSameAction && diff <= 1.5) return;
      if (diff > 0.5) {
        setIsSyncing(true);
        setPlayerTime(player, time);
        setTimeout(() => {
          if (!isComponentUnmounted()) setIsSyncing(false);
        }, 1000);
      }
    } else if (action === "seek") {
      if (diff > 1.0) {
        setIsSyncing(true);
        setTimeout(() => {
          if (!isComponentUnmounted()) setIsSyncing(false);
        }, 1000);
      }

      setPlayerTime(player, time);

      if (!isHostPaused.current) {
        player.play()?.catch(() => {});
      }
    }
  }, [getPlayer, isComponentUnmounted]);

  const syncHeartbeat = useCallback((time: number, isPaused: boolean) => {
    const player = getPlayer();
    if (!player) return;

    if (typeof player.readyState === "function" && player.readyState() < 1) {
      pendingInitialSync.current = { action: isPaused ? "pause" : "play", time };
      return;
    }

    targetHostTime.current = time;
    isHostPaused.current = isPaused;
    lastSyncReceivedAt.current = Date.now();
    const diff = Math.abs(getPlayerTime(player) - time);

    if (isPaused) {
      if (typeof player.playbackRate === "function") player.playbackRate(1.0);
      if (typeof player.paused === "function" && !player.paused()) {
        suppressLocalSyncUntil.current = Date.now() + 1500;
        remoteLockUntil.current = Date.now() + 1500;
        player.pause();
      }
      if (diff > 0.5) setPlayerTime(player, time);
      return;
    }

    if (typeof player.paused === "function" && player.paused()) {
      suppressLocalSyncUntil.current = Date.now() + 1500;
      remoteLockUntil.current = Date.now() + 1500;
      player.play()?.catch(() => {});
    }

    if (diff > 3.0) {
      remoteLockUntil.current = Date.now() + 1000;
      setPlayerTime(player, getSyncedTargetTime());
    }
  }, [getPlayer, getSyncedTargetTime]);

  const commitNetworkSync = useCallback((action: PlaybackAction) => {
    if (!canCommitLocalPlaybackIntent({
      action,
      now: Date.now(),
      lastUserIntentAt: lastUserIntentAt.current,
      suppressLocalSyncUntil: suppressLocalSyncUntil.current,
      remoteLockUntil: remoteLockUntil.current,
      visibilityState: document.visibilityState,
    })) return;

    const player = getPlayer();
    if (!player) return;

    targetHostTime.current = getPlayerTime(player);
    isHostPaused.current = typeof player.paused === "function" ? player.paused() : false;
    lastSyncReceivedAt.current = Date.now();

    pendingAction.current = action;
    if (networkTimer.current) clearTimeout(networkTimer.current);

    networkTimer.current = setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() < suppressLocalSyncUntil.current) return;
      if (!pendingAction.current) return;
      const player = getPlayer();
      if (!player) return;

      if (pendingAction.current === "seek") {
        if (!canCommitLocalPlaybackIntent({
          action: "seek",
          now: Date.now(),
          lastUserIntentAt: lastUserIntentAt.current,
          suppressLocalSyncUntil: 0,
          remoteLockUntil: 0,
          visibilityState: document.visibilityState,
        })) return;
      }

      const time = getPlayerTime(player);
      if (pendingAction.current === "play") onPlaySync?.(time);
      if (pendingAction.current === "pause") onPauseSync?.(time);
      if (pendingAction.current === "seek") onSeekSync?.(time);
      pendingAction.current = null;
    }, 300);
  }, [getPlayer, onPauseSync, onPlaySync, onSeekSync]);

  const markUserIntent = useCallback(() => {
    if (!shouldMarkUserIntent({ canControl })) return;
    lastUserIntentAt.current = Date.now();
    remoteLockUntil.current = 0;
    suppressLocalSyncUntil.current = 0;
  }, [canControl]);

  const applyPendingInitialSync = useCallback(() => {
    if (!pendingInitialSync.current) return false;
    const { action, time } = pendingInitialSync.current;
    syncFromRemote(action, time);
    pendingInitialSync.current = null;
    return true;
  }, [syncFromRemote]);

  const suppressLifecycleSync = useCallback(() => {
    if (canControl) return;
    suppressLocalSyncUntil.current = Date.now() + 3000;
  }, [canControl]);

  const getCurrentState = useCallback((): PlayerState | null => {
    const player = getPlayer();
    if (!player) return null;
    return {
      time: getPlayerTime(player),
      isPaused: typeof player.paused === "function" ? player.paused() : false,
    };
  }, [getPlayer]);

  useEffect(() => {
    if (!isWatchParty || !canControl) return;

    const sendHeartbeat = () => {
      const player = getPlayer();
      if (!player || player.isDisposed?.()) {
        heartbeatTimer.current = window.setTimeout(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
        return;
      }
      if (typeof player.readyState === "function" && player.readyState() < 2) {
        heartbeatTimer.current = window.setTimeout(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
        return;
      }

      const isPaused = typeof player.paused === "function" ? player.paused() : true;
      if (isPaused) pausedSince.current ??= Date.now();
      else pausedSince.current = null;

      onHeartbeatSync?.(getPlayerTime(player), isPaused);

      const nextInterval = isPaused
        ? getPausedHeartbeatInterval(Date.now() - (pausedSince.current ?? Date.now()))
        : HEARTBEAT_INTERVAL_MS;
      heartbeatTimer.current = window.setTimeout(sendHeartbeat, nextInterval);
    };

    heartbeatTimer.current = window.setTimeout(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => {
      if (heartbeatTimer.current !== null) window.clearTimeout(heartbeatTimer.current);
    };
  }, [canControl, getPlayer, isWatchParty, onHeartbeatSync]);

  useEffect(() => {
    return () => {
      if (networkTimer.current) clearTimeout(networkTimer.current);
    };
  }, []);

  return {
    applyPendingInitialSync,
    commitNetworkSync,
    getCurrentState,
    getSyncedTargetTime,
    isSyncing,
    markUserIntent,
    runSoftSync,
    suppressLifecycleSync,
    syncFromRemote,
    syncHeartbeat,
  };
}
