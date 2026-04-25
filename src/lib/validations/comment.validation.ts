import * as z from "zod";

export const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Không được để trống")
    .max(200, "Chỉ được phép nhập tối đa 200 ký tự"),
  movieSlug: z
    .string({ message: "Bắt buộc phải có movieSlug" })
    .min(1, "Bắt buộc phải có movieSlug"),
  movieName: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  replyToId: z.string().uuid().optional().nullable(),
  rootId: z.string().uuid().optional().nullable(),
});

export type CommentFormData = z.infer<typeof commentSchema>;
