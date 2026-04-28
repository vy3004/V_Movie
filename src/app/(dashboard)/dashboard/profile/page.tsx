import { redirect } from "next/navigation";
import { UserIcon } from "@heroicons/react/24/outline";
import { createSupabaseServer } from "@/lib/supabase/server";
import ProfileTabs from "./_components/ProfileTabs";

export default async function ProfilePage() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=required");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <UserIcon className="w-8 h-8 text-red-500" /> Hồ sơ cá nhân
        </h1>
        <p className="text-zinc-500 mt-1">
          Quản lý định danh và bảo vệ không gian điện ảnh của riêng bạn.
        </p>
      </div>

      <ProfileTabs user={user} profile={profile} />
    </div>
  );
}
