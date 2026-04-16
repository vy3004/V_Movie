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

// Infer type từ schema
export type CreateRoomFormValues = z.infer<typeof createRoomSchema>;
