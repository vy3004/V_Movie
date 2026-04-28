"use client";

import { useState } from "react";
import { UserIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import PersonalInfoTab from "./PersonalInfoTab";
import SecurityTab from "./SecurityTab";
import { User } from "@supabase/supabase-js";
import { UserProfile } from "@/types";

export default function ProfileTabs({
  user,
  profile,
}: {
  user: User;
  profile: UserProfile;
}) {
  const [activeTab, setActiveTab] = useState<"personal" | "security">(
    "personal",
  );

  return (
    <div className="space-y-8">
      {/* Tab Container - Glassmorphism */}
      <div
        role="tablist"
        className="flex gap-2 p-1.5 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-[1.25rem] w-fit shadow-2xl"
      >
        <button
          onClick={() => setActiveTab("personal")}
          role="tab"
          aria-selected={activeTab === "personal"}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
            activeTab === "personal"
              ? "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)] scale-100"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800/50 scale-95 hover:scale-100"
          }`}
        >
          <UserIcon className="w-4 h-4" /> THÔNG TIN
        </button>
        <button
          onClick={() => setActiveTab("security")}
          role="tab"
          aria-selected={activeTab === "security"}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
            activeTab === "security"
              ? "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)] scale-100"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800/50 scale-95 hover:scale-100"
          }`}
        >
          <ShieldCheckIcon className="w-4 h-4" /> BẢO MẬT
        </button>
      </div>
      <div
        key={activeTab}
        className="animate-in fade-in zoom-in-95 duration-500"
      >
        {activeTab === "personal" && (
          <PersonalInfoTab user={user} profile={profile} />
        )}
        {activeTab === "security" && <SecurityTab />}
      </div>
    </div>
  );
}
