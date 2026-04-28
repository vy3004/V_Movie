import { z } from "zod";

// 1. Schema cho Tab Thông tin cá nhân
export const profileInfoSchema = z.object({
  full_name: z
    .string()
    .min(2, "Tên hiển thị phải từ 2 ký tự trở lên")
    .max(50, "Tên không được vượt quá 50 ký tự"),
  bio: z.string().max(200, "Giới thiệu tối đa 200 ký tự").optional(),
});

export type ProfileInfoFormValues = z.infer<typeof profileInfoSchema>;

// 2. Schema cho Tab Bảo mật (Đổi mật khẩu)
export const updatePasswordSchema = z
  .object({
    new_password: z
      .string()
      .min(6, "Mật khẩu phải từ 6 ký tự trở lên")
      .max(50, "Mật khẩu quá dài"),
    confirm_password: z
      .string()
      .min(6, "Vui lòng xác nhận lại mật khẩu")
      .max(50, "Mật khẩu quá dài"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Mật khẩu xác nhận không khớp!",
    path: ["confirm_password"], // Gắn lỗi vào field confirm_password
  });

export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;
