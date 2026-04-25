import * as z from "zod";

export const messageSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().min(1, "Thiếu Room ID"),
  text: z
    .string()
    .trim()
    .min(1, "Tin nhắn không được để trống")
    .max(150, "Tin nhắn quá dài (tối đa 150 ký tự)"),
  type: z.enum(["chat", "system", "reaction"]).default("chat"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type MessageFormData = z.infer<typeof messageSchema>;
