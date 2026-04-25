"use client";

import React, { useState, useEffect } from "react";
import {
  UserIcon,
  PhotoIcon,
  EnvelopeIcon,
  IdentificationIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import UserAvatar from "@/components/UserAvatar";
import LoadingPage from "@/components/LoadingPage";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useData } from "@/providers/BaseDataContextProvider";

export default function ProfilePage() {
  const { user } = useData();

  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    avatar_url: "",
    bio: "",
    email: "",
  });

  // 1. Lấy dữ liệu Profile hiện tại
  useEffect(() => {
    async function getProfile() {
      try {
        if (!user) return;

        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, bio")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        setProfile({
          full_name: data?.full_name || "",
          avatar_url: data?.avatar_url || "",
          bio: data?.bio || "",
          email: user.email || "",
        });
      } catch (error) {
        console.error("Lỗi fetch profile:", error);
      } finally {
        setLoading(false);
      }
    }
    getProfile();
  }, [supabase,user]);

  // 2. Xử lý cập nhật thông tin
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          bio: profile.bio,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id);

      if (error) throw error;
      toast.success("Cập nhật hồ sơ thành công!");
    } catch {
      toast.error("Có lỗi xảy ra khi cập nhật.");
    } finally {
      setUpdating(false);
    }
  };

  // 3. Xử lý Upload Avatar (Tận dụng Supabase Storage)
  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUpdating(true);
      if (!e.target.files || e.target.files.length === 0) return;

      const file = e.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${user?.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Lấy public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // Cập nhật vào table profiles
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user?.id);

      setProfile({ ...profile, avatar_url: publicUrl });
      toast.success("Đã thay đổi ảnh đại diện!");
    } catch {
      toast.error("Lỗi upload ảnh.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">
          Hồ sơ cá nhân
        </h1>
        <p className="text-zinc-500 mt-2 text-sm sm:text-base">
          Quản lý thông tin và cài đặt tài khoản của bạn.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CỘT TRÁI: AVATAR CARD */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] flex flex-col items-center text-center">
            <div className="relative group">
              <UserAvatar
                avatar_url={profile.avatar_url}
                user_name={profile.full_name}
                size={120}
              />
              <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <PhotoIcon className="w-8 h-8 text-white" />
                <input
                  type="file"
                  className="hidden"
                  onChange={uploadAvatar}
                  accept="image/*"
                />
              </label>
            </div>
            <h2 className="text-xl font-bold mt-4 text-white">
              {profile.full_name || "Thành viên"}
            </h2>
            <p className="text-zinc-500 text-sm">{profile.email}</p>
          </div>
        </div>

        {/* CỘT PHẢI: EDIT FORM */}
        <div className="lg:col-span-2">
          <form
            onSubmit={handleUpdate}
            className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] space-y-6"
          >
            <div className="space-y-4">
              {/* Field: Full Name */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">
                  Tên hiển thị
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={(e) =>
                      setProfile({ ...profile, full_name: e.target.value })
                    }
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600 transition"
                    placeholder="Nhập tên của bạn..."
                  />
                </div>
              </div>

              {/* Field: Email (Read Only) */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">
                  Địa chỉ Email
                </label>
                <div className="relative opacity-60">
                  <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="email"
                    value={profile.email}
                    readOnly
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl py-3 pl-12 pr-4 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Field: Bio */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">
                  Giới thiệu ngắn
                </label>
                <div className="relative">
                  <IdentificationIcon className="absolute left-4 top-4 w-5 h-5 text-zinc-500" />
                  <textarea
                    rows={4}
                    value={profile.bio}
                    onChange={(e) =>
                      setProfile({ ...profile, bio: e.target.value })
                    }
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600 transition"
                    placeholder="Chia sẻ đôi chút về bản thân bạn..."
                  />
                </div>
              </div>
            </div>

            <button
              disabled={updating}
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
            >
              {updating ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  LƯU THAY ĐỔI
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
