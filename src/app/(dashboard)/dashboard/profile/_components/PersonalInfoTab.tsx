"use client";

import { useState, useTransition } from "react";
import {
  UserIcon,
  PhotoIcon,
  IdentificationIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { User } from "@supabase/supabase-js";
import UserAvatar from "@/components/shared/UserAvatar";
import { createSupabaseClient } from "@/lib/supabase/client";
import { updateProfileInfo, updateAvatarUrl } from "../actions";
import {
  profileInfoSchema,
  ProfileInfoFormValues,
} from "@/lib/validations/profile.validation";
import { UserProfile } from "@/types";

export default function PersonalInfoTab({
  user,
  profile,
}: {
  user: User;
  profile: UserProfile;
}) {
  const supabase = createSupabaseClient();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [avatar, setAvatar] = useState(profile?.avatar_url || "");

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileInfoFormValues>({
    resolver: zodResolver(profileInfoSchema),
    defaultValues: {
      full_name: profile?.full_name || "",
      bio: profile?.bio || "",
    },
  });

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      if (!e.target.files || e.target.files.length === 0) return;

      const file = e.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const result = await updateAvatarUrl(publicUrl);
      if (result.error) throw new Error(result.error);

      queryClient.setQueryData(
        ["user-profile", user.id],
        (oldData: UserProfile | undefined) => {
          if (!oldData) return oldData;
          return { ...oldData, avatar_url: publicUrl };
        },
      );
      queryClient.invalidateQueries({ queryKey: ["user-profile", user.id] });

      setAvatar(publicUrl);
      toast.success("Cập nhật ảnh đại diện mới thành công!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lỗi upload ảnh.");
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = (data: ProfileInfoFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("full_name", data.full_name);
      formData.append("bio", data.bio || "");

      const result = await updateProfileInfo(formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        queryClient.setQueryData(
          ["user-profile", user.id],
          (oldData: UserProfile | undefined) => {
            if (!oldData) return oldData;
            return { ...oldData, full_name: data.full_name, bio: data.bio };
          },
        );
        queryClient.invalidateQueries({ queryKey: ["user-profile", user.id] });
        toast.success("Hồ sơ đã được lưu giữ!");
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* CỘT AVATAR */}
      <div className="lg:col-span-1">
        <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 p-8 rounded-[2rem] flex flex-col items-center text-center shadow-xl relative overflow-hidden">
          {/* Vòng sáng Gradient phía sau Avatar */}
          <div className="absolute top-10 w-32 h-32 bg-red-600/20 blur-2xl rounded-full"></div>

          <div className="relative group z-10">
            <div className="relative group">
              <UserAvatar
                avatar_url={avatar}
                user_name={profile.full_name || "User"}
                size={120}
              />
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              {isUploading ? (
                <ArrowPathIcon className="w-8 h-8 text-white animate-spin" />
              ) : (
                <PhotoIcon className="w-8 h-8 text-white" />
              )}

              <input
                type="file"
                className="hidden"
                onChange={handleUploadAvatar}
                accept="image/*"
                disabled={isUploading}
              />
            </label>
          </div>
          <h2 className="text-xl font-bold mt-6 text-white uppercase tracking-wider">
            {profile?.full_name || "Thành viên"}
          </h2>
          <p className="text-zinc-500 text-sm font-medium mt-1">{user.email}</p>
        </div>
      </div>

      {/* CỘT FORM */}
      <div className="lg:col-span-2">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 p-8 sm:p-10 rounded-[2rem] space-y-8 shadow-xl"
        >
          <div className="space-y-6">
            <div className="space-y-2 group">
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 group-focus-within:text-red-500 transition-colors ml-1">
                Tên hiển thị
              </label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                <input
                  {...register("full_name")}
                  className={`w-full bg-zinc-950/50 border rounded-2xl py-4 pl-12 pr-4 text-white text-sm outline-none transition-all duration-300 ${
                    errors.full_name
                      ? "border-red-500 focus:ring-4 focus:ring-red-500/10"
                      : "border-zinc-800 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 hover:border-zinc-700"
                  }`}
                  placeholder="Nhập tên của bạn..."
                />
              </div>
              {errors.full_name && (
                <p className="text-red-500 text-xs mt-1 ml-1">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2 group">
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 group-focus-within:text-red-500 transition-colors ml-1">
                Giới thiệu (Bio)
              </label>
              <div className="relative">
                <IdentificationIcon className="absolute left-4 top-4 w-5 h-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
                <textarea
                  {...register("bio")}
                  rows={4}
                  className={`w-full bg-zinc-950/50 border rounded-2xl py-4 pl-12 pr-4 text-white text-sm outline-none transition-all duration-300 resize-none ${
                    errors.bio
                      ? "border-red-500 focus:ring-4 focus:ring-red-500/10"
                      : "border-zinc-800 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 hover:border-zinc-700"
                  }`}
                  placeholder="Kể gì đó về phong cách xem phim của bạn..."
                />
              </div>
              {errors.bio && (
                <p className="text-red-500 text-xs mt-1 ml-1">
                  {errors.bio.message}
                </p>
              )}
            </div>
          </div>

          <button
            // Tối ưu: Nếu đang upload, đang gửi form, HOẶC CHƯA GÕ GÌ THAY ĐỔI -> Chặn bấm nút
            disabled={isPending || isUploading || !isDirty}
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-2xl font-black tracking-widest uppercase transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed shadow-lg shadow-red-600/20"
          >
            {isPending ? (
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
            ) : (
              "LƯU THAY ĐỔI"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
