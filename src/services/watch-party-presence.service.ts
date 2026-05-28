import "server-only";

import { redis } from "@/lib/redis";
import type { UserPresence } from "@/types";

export const WATCH_PARTY_PRESENCE_TTL_SECONDS = 45;
export const WATCH_PARTY_PRESENCE_STALE_MS = 30_000;

export interface WatchPartyPresenceLease {
  room_id: string;
  user_id: string;
  session_id: string;
  status: UserPresence["status"];
  source: "data-channel" | "history-track" | "video-sync";
  last_seen_at: number;
}

const leaseKey = (roomId: string, userId: string, sessionId: string) =>
  `wp:presence:${roomId}:${userId}:${sessionId}`;

const roomIndexKey = (roomId: string) => `wp:presence_idx:${roomId}`;

const roomUserKey = (roomId: string, userId: string) =>
  `wp:presence_user:${roomId}:${userId}`;

const memberValue = (userId: string, sessionId: string) => `${userId}:${sessionId}`;

const parseMember = (member: string) => {
  const separatorIndex = member.indexOf(":");
  if (separatorIndex === -1) return null;

  return {
    userId: member.slice(0, separatorIndex),
    sessionId: member.slice(separatorIndex + 1),
  };
};

export const WatchPartyPresenceService = {
  touch: async ({
    roomId,
    userId,
    sessionId,
    status,
    source,
  }: {
    roomId: string;
    userId: string;
    sessionId: string;
    status: UserPresence["status"];
    source: WatchPartyPresenceLease["source"];
  }) => {
    if (!redis) return null;

    const now = Date.now();
    const lease: WatchPartyPresenceLease = {
      room_id: roomId,
      user_id: userId,
      session_id: sessionId,
      status,
      source,
      last_seen_at: now,
    };
    const leaseRedisKey = leaseKey(roomId, userId, sessionId);
    const roomUserRedisKey = roomUserKey(roomId, userId);
    const member = memberValue(userId, sessionId);
    const pipeline = redis.pipeline();

    pipeline.set(leaseRedisKey, JSON.stringify(lease), {
      ex: WATCH_PARTY_PRESENCE_TTL_SECONDS,
    });
    pipeline.zadd(roomIndexKey(roomId), { score: now, member });
    pipeline.sadd(roomUserRedisKey, sessionId);
    pipeline.expire(roomUserRedisKey, WATCH_PARTY_PRESENCE_TTL_SECONDS);
    await pipeline.exec();

    return lease;
  },

  leave: async ({
    roomId,
    userId,
    sessionId,
  }: {
    roomId: string;
    userId: string;
    sessionId: string;
  }) => {
    if (!redis) return;

    const pipeline = redis.pipeline();
    pipeline.del(leaseKey(roomId, userId, sessionId));
    pipeline.zrem(roomIndexKey(roomId), memberValue(userId, sessionId));
    pipeline.srem(roomUserKey(roomId, userId), sessionId);
    await pipeline.exec();
  },

  hasActiveLease: async (roomId: string, userId: string) => {
    if (!redis) return false;

    const sessionIds = await redis.smembers<string[]>(roomUserKey(roomId, userId));
    if (!sessionIds.length) return false;

    const keys = sessionIds.map((sessionId) => leaseKey(roomId, userId, sessionId));
    const leases = await redis.mget<(string | WatchPartyPresenceLease | null)[]>(
      ...keys,
    );

    return leases.some(Boolean);
  },

  getActiveLeases: async (roomId: string, now = Date.now()) => {
    if (!redis) return [];

    const cutoff = now - WATCH_PARTY_PRESENCE_STALE_MS;
    const members = await redis.zrange<string[]>(roomIndexKey(roomId), cutoff, now, {
      byScore: true,
    });
    if (!members.length) return [];

    const parsedMembers = members
      .map(parseMember)
      .filter((member): member is { userId: string; sessionId: string } => !!member);
    if (!parsedMembers.length) return [];

    const leases = await redis.mget<(WatchPartyPresenceLease | string | null)[]>(
      ...parsedMembers.map((member) =>
        leaseKey(roomId, member.userId, member.sessionId),
      ),
    );
    const activeLeases = new Map<string, WatchPartyPresenceLease>();

    leases.forEach((leaseValue) => {
      if (!leaseValue) return;

      const lease =
        typeof leaseValue === "string"
          ? (JSON.parse(leaseValue) as WatchPartyPresenceLease)
          : leaseValue;
      const current = activeLeases.get(lease.user_id);

      if (!current || lease.last_seen_at > current.last_seen_at) {
        activeLeases.set(lease.user_id, lease);
      }
    });

    return Array.from(activeLeases.values());
  },

  getStaleUserIds: async (roomId: string, now = Date.now()) => {
    if (!redis) return [];

    const cutoff = now - WATCH_PARTY_PRESENCE_STALE_MS;
    const members = await redis.zrange<string[]>(roomIndexKey(roomId), 0, cutoff, {
      byScore: true,
    });
    if (!members.length) return [];

    const staleUserIds = new Set<string>();
    const pipeline = redis.pipeline();
    let hasPipelineCommands = false;

    for (const member of members) {
      const parsed = parseMember(member);
      if (!parsed) continue;

      const activeLease = await redis.get<WatchPartyPresenceLease | string>(
        leaseKey(roomId, parsed.userId, parsed.sessionId),
      );
      if (activeLease) continue;

      const sessionIds = await redis.smembers<string[]>(
        roomUserKey(roomId, parsed.userId),
      );
      const otherSessionIds = sessionIds.filter(
        (sessionId) => sessionId !== parsed.sessionId,
      );
      if (otherSessionIds.length) {
        const activeUserLeases = await redis.mget<
          (WatchPartyPresenceLease | string | null)[]
        >(
          ...otherSessionIds.map((sessionId) =>
            leaseKey(roomId, parsed.userId, sessionId),
          ),
        );
        if (activeUserLeases.some(Boolean)) {
          pipeline.zrem(roomIndexKey(roomId), member);
          pipeline.srem(roomUserKey(roomId, parsed.userId), parsed.sessionId);
          hasPipelineCommands = true;
          continue;
        }
      }

      staleUserIds.add(parsed.userId);
      pipeline.zrem(roomIndexKey(roomId), member);
      pipeline.srem(roomUserKey(roomId, parsed.userId), parsed.sessionId);
      hasPipelineCommands = true;
    }

    if (hasPipelineCommands) await pipeline.exec();

    return Array.from(staleUserIds);
  },
};
