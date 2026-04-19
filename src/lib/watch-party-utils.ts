import { WatchPartyRoom, WatchPartyParticipant } from "@/types/watch-party";

/**
 * 1. Logic kiểm tra quyền điều khiển Player
 */
export const canUserControlVideo = (
  room: WatchPartyRoom | null,
  participant: WatchPartyParticipant | null,
): boolean => {
  if (!room || !participant) return false;
  if (!room.is_active) return false;

  // Host luôn có quyền
  if (participant.role === "host") return true;

  // Nếu phòng đang mở tự do cho khách
  if (room.settings?.allow_guest_control) return true;

  // Nếu guest đã được cấp quyền riêng biệt
  return !!participant.permissions?.can_control_media;
};

/**
 * 2. Logic quyết định có nên thực hiện Sync (Seek) hay không
 * Tránh việc video bị giật liên tục do sai lệch mili giây giữa các máy
 */
export const shouldSyncTime = (
  hostTime: number,
  guestTime: number,
  threshold: number = 1.5,
): boolean => {
  const diff = Math.abs(hostTime - guestTime);
  return diff > threshold;
};

/**
 * 3. Logic lấy tập phim mặc định (Fallback)
 */
export const getActiveEpisodeSlug = (
  currentSlug: string | null,
  allEpisodes: { server_data: { slug: string }[] }[],
): string | null => {
  if (currentSlug) return currentSlug;

  // Nếu chưa có slug, lấy slug của tập đầu tiên trong server đầu tiên
  if (allEpisodes.length > 0 && allEpisodes[0].server_data.length > 0) {
    return allEpisodes[0].server_data[0].slug;
  }

  return null;
};
