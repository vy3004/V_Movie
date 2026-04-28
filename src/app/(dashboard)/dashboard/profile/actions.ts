"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  profileInfoSchema,
  updatePasswordSchema,
} from "@/lib/validations/profile.validation";

// 1. Cập nhật thông tin (Name, Bio)
export async function updateProfileInfo(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Phiên đăng nhập không hợp lệ!" };

  const validatedFields = profileInfoSchema.safeParse({
    full_name: formData.get("full_name"),
    bio: formData.get("bio"),
  });

  if (!validatedFields.success) {
    const flatErrors = validatedFields.error.flatten();
    return {
      error:
        flatErrors.fieldErrors.full_name?.[0] ||
        flatErrors.fieldErrors.bio?.[0] ||
        "Dữ liệu không hợp lệ!",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: validatedFields.data.full_name,
      bio: validatedFields.data.bio,
    })
    .eq("id", user.id);

  if (error) return { error: "Lỗi cập nhật database!" };

  revalidatePath("/dashboard/profile");
  return { success: true };
}

// 2. Cập nhật URL Avatar vào DB
export async function updateAvatarUrl(avatarUrl: string) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Không tìm thấy user!" };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (error) return { error: "Lỗi cập nhật ảnh đại diện!" };

  revalidatePath("/dashboard/profile");
  return { success: true };
}

// 3. Đổi mật khẩu (Supabase tự động hash)
export async function updatePassword(formData: FormData) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Phiên đăng nhập không hợp lệ!" };

  const validatedFields = updatePasswordSchema.safeParse({
    new_password: formData.get("new_password"),
    confirm_password: formData.get("confirm_password"),
  });

  if (!validatedFields.success) {
    const flatErrors = validatedFields.error.flatten();
    return {
      error:
        flatErrors.fieldErrors.confirm_password?.[0] ||
        flatErrors.fieldErrors.new_password?.[0] ||
        "Mật khẩu không hợp lệ!",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: validatedFields.data.new_password,
  });

  if (error) return { error: error.message };
  return { success: true };
}
