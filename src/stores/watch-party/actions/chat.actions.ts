import { getWatchPartyStore } from "../index";
import { toast } from "sonner";

/**
 * Send a system message to the chat
 * This is a helper function that sends a message with type "system"
 */
export async function sendSystemMessage(text: string): Promise<void> {
  const state = getWatchPartyStore();
  const room = state.room;
  const user = state.user;

  if (!room || !user) {
    console.error("[sendSystemMessage] Missing room or user");
    return;
  }

  try {
    const res = await fetch("/api/watch-party/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        roomId: room.id,
        text,
        type: "system",
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to send system message: ${res.status}`);
    }

    // Message will be added via realtime subscription
  } catch (error) {
    console.error("[sendSystemMessage] Error:", error);
  }
}

/**
 * Send a chat message with Optimistic Update + Rollback
 */
export async function sendChatMessage(text: string): Promise<void> {
  const state = getWatchPartyStore();
  const room = state.room;
  const user = state.user;

  if (!room || !user) {
    console.error("[sendChatMessage] Missing room or user");
    return;
  }

  const clientMsgId = crypto.randomUUID();
  const optimisticMsg = {
    id: clientMsgId,
    room_id: room.id,
    user_id: user.id,
    user_name:
      ("full_name" in user ? user.full_name : user.user_metadata?.full_name) ||
      "Guest",
    avatar_url:
      ("avatar_url" in user
        ? user.avatar_url
        : user.user_metadata?.avatar_url) || "",
    text,
    type: "chat" as const,
    created_at: new Date().toISOString(),
  };

  // 1. Optimistic Update: Add message immediately
  console.log("[sendChatMessage] Adding optimistic message:", clientMsgId);
  state.addMessage(optimisticMsg);

  try {
    // 2. Call API
    console.log("[sendChatMessage] Calling API...");
    const res = await fetch("/api/watch-party/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: clientMsgId,
        roomId: room.id,
        text,
        type: "chat",
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    // 3. Success: postgres_changes will update the message with server data
    console.log(
      "[sendChatMessage] Message sent successfully, waiting for postgres_changes",
    );
  } catch (error) {
    // 4. Rollback: Remove optimistic message on error
    console.error("[sendChatMessage] Error, rolling back:", error);
    state.removeMessageById(clientMsgId);

    // 5. Show error toast
    const errorMessage =
      error instanceof Error ? error.message : "Không thể gửi tin nhắn";
    toast.error(`Gửi tin nhắn thất bại: ${errorMessage}`, {
      id: "send-message-error",
      duration: 3000,
    });
  }
}
