import * as z from "zod";

export const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Không được để trống")
    .max(2000, "Vượt quá giới hạn ký tự hệ thống") // Bảo vệ Database chống spam chuỗi dài
    .refine(
      (val) => {
        // Đếm số "từ" (chữ) dựa trên khoảng trắng
        const words = val.split(/\s+/).filter(Boolean);
        return words.length <= 200;
      },
      { message: "Chỉ được phép nhập tối đa 200 chữ (từ)" },
    ),
});

export type CommentFormData = z.infer<typeof commentSchema>;
