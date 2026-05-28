import * as z from "zod";

export const createRoomSchema = z.object({
  title: z
    .string()
    .min(3, "Tên phòng phải có ít nhất 3 ký tự")
    .max(100, "Tên phòng quá dài"),
  isPrivate: z.boolean(),
  maxParticipants: z.number().min(2).max(20),
  movieSlug: z.string().min(1, "Vui lòng chọn một bộ phim để xem chung"),
  movieName: z.string(),
  movieImage: z.string(),
  episodeSlug: z.string(),
  settings: z.object({
    wait_for_all: z.boolean(),
    guest_can_chat: z.boolean(),
    allow_guest_control: z.boolean(),
  }),
});

export const updateSettingsSchema = z.object({
  roomId: z.string().uuid("Room ID không hợp lệ"),
  title: z
    .string()
    .min(3, "Tiêu đề phải có ít nhất 3 ký tự")
    .max(100, "Tiêu đề tối đa 100 ký tự")
    .optional(),
  isPrivate: z.boolean().optional(),
  maxParticipants: z
    .number()
    .int()
    .min(2, "Tối thiểu 2 người")
    .max(20, "Tối đa 20 người")
    .optional(),
  isActive: z.boolean().optional(),
  settings: z
    .object({
      wait_for_all: z.boolean().optional(),
      guest_can_chat: z.boolean().optional(),
      allow_guest_control: z.boolean().optional(),
    })
    .optional(),
});

export const addToPlaylistSchema = z.object({
  roomId: z.string().uuid("Room ID không hợp lệ"),
  movieSlug: z.string().min(1, "Movie slug không hợp lệ"),
  movieName: z.string().min(1, "Tên phim không hợp lệ"),
  episodeSlug: z.string().min(1, "Episode slug không hợp lệ"),
  thumbUrl: z.string().min(1, "Thumb URL không được để trống"),
});

export const joinRoomSchema = z.object({
  roomId: z.string().uuid("Room ID không hợp lệ"),
});

export const leaveRoomSchema = z.object({
  roomId: z.string().uuid("Room ID không hợp lệ"),
});

export const syncVideoSchema = z.object({
  roomId: z.string().uuid("Room ID không hợp lệ"),
  action: z.enum(["play", "pause", "seek"], {
    message: "Action phải là play, pause hoặc seek",
  }),
  time: z.number().finite("Time không hợp lệ").min(0, "Time phải >= 0"),
  episodeSlug: z
    .string()
    .regex(/^[a-zA-Z0-9-]+$/, "Episode slug không hợp lệ")
    .optional(),
});

export const syncVideoRouteSchema = z.object({
  roomId: z.string().uuid("Room ID không hợp lệ"),
  status: z
    .enum(["play", "pause"], {
      message: "Status phải là play hoặc pause",
    })
    .optional(),
  time: z.number().finite("Time không hợp lệ").min(0, "Time phải >= 0"),
  episodeSlug: z
    .string()
    .regex(/^[a-zA-Z0-9-]+$/, "Episode slug không hợp lệ")
    .optional(),
  requestId: z.string().optional(),
});

export const participantActionSchema = z.object({
  roomId: z.string().uuid("Room ID không hợp lệ"),
  targetUserId: z.string().uuid("User ID không hợp lệ"),
  action: z.enum(["approve", "reject", "kick", "mute", "unmute", "promote"], {
    message: "Action không hợp lệ",
  }),
});

export type CreateRoomFormValues = z.infer<typeof createRoomSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type AddToPlaylistInput = z.infer<typeof addToPlaylistSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type LeaveRoomInput = z.infer<typeof leaveRoomSchema>;
export type SyncVideoInput = z.infer<typeof syncVideoSchema>;
export type SyncVideoRouteInput = z.infer<typeof syncVideoRouteSchema>;
export type ParticipantActionInput = z.infer<typeof participantActionSchema>;
