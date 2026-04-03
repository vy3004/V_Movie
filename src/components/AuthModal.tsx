"use client";

import { createSupabaseClient } from "@/lib/supabase/client";

import { useAuthModal } from "@/providers/AuthModalProvider";

export default function AuthModal() {
  const { isOpen, onClose } = useAuthModal(); // Lấy từ Context
  const supabase = createSupabaseClient();

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-zinc-900 p-8 border border-zinc-800 shadow-2xl animate-in fade-in zoom-in duration-300">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-500 hover:text-white"
        >
          X
        </button>

        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          Đăng nhập
        </h2>

        <button
          onClick={handleGoogleLogin}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-white py-3 text-black font-bold hover:bg-zinc-200 transition"
        >
          Tiếp tục với Google
        </button>
      </div>
    </div>
  );
}
