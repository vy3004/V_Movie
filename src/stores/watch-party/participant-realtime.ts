import { WatchPartyParticipant } from "@/types";

type ParticipantDeleteIdentity = {
  id?: string | null;
  user_id?: string | null;
};

function revisionOf(participant: WatchPartyParticipant) {
  if (typeof participant.realtime_revision === "number") {
    return participant.realtime_revision;
  }

  if (participant.updated_at) {
    return Date.parse(participant.updated_at);
  }

  return 0;
}

export function mergeParticipantRealtimeRow(
  participants: WatchPartyParticipant[],
  incoming: WatchPartyParticipant,
) {
  const index = participants.findIndex(
    (participant) =>
      participant.id === incoming.id || participant.user_id === incoming.user_id,
  );

  if (index === -1) return [...participants, incoming];

  const current = participants[index];
  if (revisionOf(incoming) < revisionOf(current)) return participants;

  const next = [...participants];
  next[index] = incoming;
  return next;
}

export function removeParticipantRealtimeRow(
  participants: WatchPartyParticipant[],
  deleted: ParticipantDeleteIdentity,
) {
  return participants.filter((participant) => {
    if (deleted.id && participant.id === deleted.id) return false;
    if (deleted.user_id && participant.user_id === deleted.user_id) return false;
    return true;
  });
}
