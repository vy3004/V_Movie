import * as z from "zod";

export const authSchema = z.object({
  username: z.string().min(3, "Tên phải từ 3 ký tự").optional(),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
});

export type AuthFormData = z.infer<typeof authSchema>;
