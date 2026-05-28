import { createClient } from "jsr:@supabase/supabase-js@2";

type UpstashPipelineItem = [string, ...string[]];

type UpstashPipelineResponse<T> = {
  result: T;
  error?: string;
};

type CleanupSummary = {
  rooms_scanned: number;
  lease_members_checked: number;
  index_entries_removed: number;
  stale_users_detected: number;
  stale_participants_deleted: number;
  cleanup_deleted_rooms: number;
  cleanup_synced_rooms: number;
  runtime_ms: number;
};

const MAX_RUNTIME_MS = 20_000;
const MAX_ROOMS_PER_RUN = 200;
const PRESENCE_STALE_MS = 30_000;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const UPSTASH_REDIS_REST_URL = Deno.env.get("UPSTASH_REDIS_REST_URL") ?? "";
const UPSTASH_REDIS_REST_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN") ?? "";

const log = (level: "info" | "warn" | "error", event: string, payload: Record<string, unknown> = {}) => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      event,
      ...payload,
    }),
  );
};

const parseMember = (member: string): { userId: string; sessionId: string } | null => {
  const i = member.indexOf(":");
  if (i <= 0 || i === member.length - 1) return null;
  return { userId: member.slice(0, i), sessionId: member.slice(i + 1) };
};

const leaseKey = (roomId: string, userId: string, sessionId: string) =>
  `wp:presence:${roomId}:${userId}:${sessionId}`;

const roomIndexKey = (roomId: string) => `wp:presence_idx:${roomId}`;

const roomUserKey = (roomId: string, userId: string) => `wp:presence_user:${roomId}:${userId}`;

const extractRoomId = (key: string) => {
  if (!key.startsWith("wp:presence_idx:")) return null;
  const roomId = key.slice("wp:presence_idx:".length);
  return roomId || null;
};

const assertEnv = () => {
  const missing: string[] = [];

  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!UPSTASH_REDIS_REST_URL) missing.push("UPSTASH_REDIS_REST_URL");
  if (!UPSTASH_REDIS_REST_TOKEN) missing.push("UPSTASH_REDIS_REST_TOKEN");

  if (missing.length) {
    throw new Error(`Missing env: ${missing.join(", ")}`);
  }
};

const upstashPipeline = async (commands: UpstashPipelineItem[]) => {
  if (!commands.length) return [] as UpstashPipelineResponse<unknown>[];

  const response = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    throw new Error(`Upstash pipeline failed: ${response.status}`);
  }

  const payload = (await response.json()) as UpstashPipelineResponse<unknown>[];
  const firstError = payload.find((item) => item.error)?.error;
  if (firstError) {
    throw new Error(`Upstash pipeline error: ${firstError}`);
  }

  return payload;
};

const upstash = async <T>(command: UpstashPipelineItem) => {
  const data = await upstashPipeline([command]);
  const first = data[0];
  if (!first) throw new Error("Upstash empty response");
  return first.result as T;
};

const pruneRoomStaleLeases = async (
  roomId: string,
  now: number,
  deadlineMs: number,
): Promise<{
  staleUserIds: string[];
  checkedCount: number;
  removedIndexEntries: number;
}> => {
  const cutoff = now - PRESENCE_STALE_MS;
  const members = (await upstash<string[]>([
    "ZRANGEBYSCORE",
    roomIndexKey(roomId),
    "-inf",
    String(cutoff),
  ])) ?? [];

  if (!members.length) {
    return { staleUserIds: [], checkedCount: 0, removedIndexEntries: 0 };
  }

  const staleUserIds = new Set<string>();
  let checkedCount = 0;
  let removedIndexEntries = 0;

  for (const member of members) {
    if (Date.now() >= deadlineMs) break;

    const parsed = parseMember(member);
    if (!parsed) {
      await upstash(["ZREM", roomIndexKey(roomId), member]);
      removedIndexEntries += 1;
      continue;
    }

    checkedCount += 1;
    const currentLease = await upstash<string | null>([
      "GET",
      leaseKey(roomId, parsed.userId, parsed.sessionId),
    ]);

    if (currentLease) continue;

    const sessions = (await upstash<string[]>([
      "SMEMBERS",
      roomUserKey(roomId, parsed.userId),
    ])) ?? [];

    const otherSessionIds = sessions.filter((id) => id !== parsed.sessionId);

    let hasOtherLease = false;
    if (otherSessionIds.length) {
      const responses = await upstashPipeline(
        otherSessionIds.map((sessionId) => [
          "GET",
          leaseKey(roomId, parsed.userId, sessionId),
        ]),
      );
      hasOtherLease = responses.some((entry) => Boolean(entry?.result));
    }

    await upstashPipeline([
      ["ZREM", roomIndexKey(roomId), member],
      ["SREM", roomUserKey(roomId, parsed.userId), parsed.sessionId],
    ]);
    removedIndexEntries += 1;

    if (!hasOtherLease) {
      staleUserIds.add(parsed.userId);
    }
  }

  return {
    staleUserIds: Array.from(staleUserIds),
    checkedCount,
    removedIndexEntries,
  };
};

Deno.serve(async () => {
  const startedAt = Date.now();
  const runId = crypto.randomUUID();

  const summary: CleanupSummary = {
    rooms_scanned: 0,
    lease_members_checked: 0,
    index_entries_removed: 0,
    stale_users_detected: 0,
    stale_participants_deleted: 0,
    cleanup_deleted_rooms: 0,
    cleanup_synced_rooms: 0,
    runtime_ms: 0,
  };

  try {
    assertEnv();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const deadlineMs = startedAt + MAX_RUNTIME_MS;

    log("info", "janitor.start", {
      run_id: runId,
      max_runtime_ms: MAX_RUNTIME_MS,
      max_rooms_per_run: MAX_ROOMS_PER_RUN,
      stale_ms: PRESENCE_STALE_MS,
    });

    const allRoomKeys = (await upstash<string[]>([
      "KEYS",
      "wp:presence_idx:*",
    ])) ?? [];

    const roomIds = allRoomKeys
      .map(extractRoomId)
      .filter((roomId): roomId is string => Boolean(roomId))
      .slice(0, MAX_ROOMS_PER_RUN);

    for (const roomId of roomIds) {
      if (Date.now() >= deadlineMs) break;

      const roomResult = await pruneRoomStaleLeases(roomId, Date.now(), deadlineMs);

      summary.rooms_scanned += 1;
      summary.lease_members_checked += roomResult.checkedCount;
      summary.index_entries_removed += roomResult.removedIndexEntries;
      summary.stale_users_detected += roomResult.staleUserIds.length;

      if (roomResult.staleUserIds.length) {
        const { data: deletedRows, error: deleteError } = await supabase
          .from("watch_party_participants")
          .delete()
          .eq("room_id", roomId)
          .eq("status", "approved")
          .in("user_id", roomResult.staleUserIds)
          .select("id");

        if (deleteError) throw deleteError;
        summary.stale_participants_deleted += deletedRows?.length ?? 0;
      }

      log("info", "janitor.room", {
        run_id: runId,
        room_id: roomId,
        stale_users: roomResult.staleUserIds.length,
        checked_members: roomResult.checkedCount,
        removed_index_entries: roomResult.removedIndexEntries,
      });
    }

    const { data: cleanupData, error: cleanupError } = await supabase.rpc(
      "cleanup_empty_rooms",
    );

    if (cleanupError) throw cleanupError;

    const cleanupObject =
      cleanupData && typeof cleanupData === "object" && !Array.isArray(cleanupData)
        ? (cleanupData as Record<string, unknown>)
        : {};

    summary.cleanup_deleted_rooms = Number(cleanupObject.deleted_rooms ?? 0);
    summary.cleanup_synced_rooms = Number(cleanupObject.synced_rooms ?? 0);
    summary.runtime_ms = Date.now() - startedAt;

    log("info", "janitor.done", {
      run_id: runId,
      ...summary,
      cleanup_result: cleanupObject,
      runtime_capped: summary.runtime_ms >= MAX_RUNTIME_MS,
    });

    return new Response(
      JSON.stringify({ success: true, run_id: runId, summary, cleanup: cleanupObject }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    summary.runtime_ms = Date.now() - startedAt;

    const message = error instanceof Error ? error.message : String(error);
    log("error", "janitor.error", {
      run_id: runId,
      error: message,
      ...summary,
    });

    return new Response(
      JSON.stringify({ success: false, run_id: runId, error: message, summary }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
