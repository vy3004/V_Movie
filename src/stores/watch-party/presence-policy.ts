import type { UserPresence, WatchPartyParticipant } from "@/types";

export const GUEST_OFFLINE_KICK_MS = 30_000;
export const HOST_OFFLINE_SUCCESSION_MS = 45_000;
export const GUEST_INITIAL_CONNECTION_GRACE_MS = 5_000;
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 15_000;
export const PRESENCE_LEASE_REFRESH_INTERVAL_MS = 10_000;

interface ShouldStartGuestOfflineTimerArgs {
  participant: WatchPartyParticipant;
  now: number;
  explicitOfflineUserIds: Set<string>;
  staleLeaseUserIds: Set<string>;
  missingSeenPresenceUserIds?: Set<string>;
  firstSeenParticipantAt?: number;
}

interface ShouldKickGuestAfterOfflineTimerArgs {
  participant: WatchPartyParticipant;
  hasPresence: boolean;
}

interface IsPresenceCleanupLeaderArgs {
  currentUserId: string;
  participants: WatchPartyParticipant[];
  presenceData: Record<string, UserPresence>;
}

export function getPresenceAge(presence: UserPresence | undefined, now: number) {
  const updatedAt = new Date(presence?.updated_at ?? 0).getTime();
  return Number.isFinite(updatedAt) ? now - updatedAt : Infinity;
}

function getOnlineApprovedParticipants(
  participants: WatchPartyParticipant[],
  presenceData: Record<string, UserPresence>,
) {
  return participants
    .filter(
      (participant) =>
        participant.status === "approved" &&
        presenceData[participant.user_id]?.status === "online",
    )
    .sort((a, b) => {
      const createdAtDiff =
        new Date(a.created_at || 0).getTime() -
        new Date(b.created_at || 0).getTime();

      if (createdAtDiff !== 0) return createdAtDiff;
      return a.user_id.localeCompare(b.user_id);
    });
}

export function isPresenceCleanupLeader({
  currentUserId,
  participants,
  presenceData,
}: IsPresenceCleanupLeaderArgs) {
  const onlineApproved = getOnlineApprovedParticipants(participants, presenceData);
  const host = onlineApproved.find((participant) => participant.role === "host");
  if (host) return host.user_id === currentUserId;

  const mod = onlineApproved.find(
    (participant) => participant.permissions?.can_manage_users === true,
  );
  if (mod) return mod.user_id === currentUserId;

  return onlineApproved[0]?.user_id === currentUserId;
}

export function isOfflineGuestKickLeader(args: IsPresenceCleanupLeaderArgs) {
  const onlineApproved = getOnlineApprovedParticipants(
    args.participants,
    args.presenceData,
  );
  const host = onlineApproved.find((participant) => participant.role === "host");
  if (host) return host.user_id === args.currentUserId;

  const mod = onlineApproved.find(
    (participant) => participant.permissions?.can_manage_users === true,
  );

  return mod?.user_id === args.currentUserId;
}

export function shouldKickGuestAfterOfflineTimer({
  participant,
  hasPresence,
}: ShouldKickGuestAfterOfflineTimerArgs) {
  return (
    participant.status === "approved" &&
    participant.role !== "host" &&
    !hasPresence
  );
}

export function shouldStartGuestOfflineTimer({
  participant,
  now,
  explicitOfflineUserIds,
  staleLeaseUserIds,
  missingSeenPresenceUserIds,
  firstSeenParticipantAt,
}: ShouldStartGuestOfflineTimerArgs) {
  if (participant.status !== "approved" || participant.role === "host") {
    return false;
  }

  if (explicitOfflineUserIds.has(participant.user_id)) {
    return true;
  }

  if (staleLeaseUserIds.has(participant.user_id)) {
    return true;
  }

  if (missingSeenPresenceUserIds?.has(participant.user_id)) {
    return true;
  }

  return (
    firstSeenParticipantAt !== undefined &&
    now - firstSeenParticipantAt >= GUEST_INITIAL_CONNECTION_GRACE_MS
  );
}
