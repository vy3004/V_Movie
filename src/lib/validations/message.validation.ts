import * as z from "zod";

export const messageSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().min(1, "Thiếu Room ID"),
  text: z
    .string()
    .min(1, "Tin nhắn trống")
    .max(200, "Tin nhắn không được vượt quá 200 ký tự"),
  type: z.enum(["chat", "system", "reaction"]).default("chat"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type MessageFormData = z.infer<typeof messageSchema>;
