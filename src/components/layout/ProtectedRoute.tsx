"use client";

import { useEffect } from "react";
import LoadingPage from "@/components/ui/LoadingPage";
import { useData } from "@/providers/BaseDataContextProvider";
import { useAuthModal } from "@/providers/AuthModalProvider";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, authLoading } = useData();
  const { onOpen: openLogin } = useAuthModal();

  useEffect(() => {
    if (!authLoading && !user) {
      openLogin();
    }
  }, [user, authLoading, openLogin]);

  if (authLoading) return <LoadingPage />;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-6">
        <h2 className="text-2xl font-black mb-4">BẠN CẦN ĐĂNG NHẬP</h2>
        <p className="text-zinc-500 mb-8 text-center max-w-xs">
          Vui lòng đăng nhập để sử dụng chức năng này.
        </p>
        <button
          onClick={openLogin}
          className="px-8 py-3 bg-red-600 rounded-full font-bold uppercase tracking-widest text-sm"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
