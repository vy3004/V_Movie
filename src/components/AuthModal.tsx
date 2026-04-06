"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  XMarkIcon,
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useAuthModal } from "@/providers/AuthModalProvider";
import { authSchema, AuthFormData } from "@/lib/validations/auth";
import { openAuthPopup } from "@/lib/auth-popup";
import { GooglePromptNotification } from "@/lib/types";

export default function AuthModal() {
  const { isOpen, onClose } = useAuthModal();
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseClient();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
  });

  useEffect(() => {
    if (isOpen) {
      reset();
      setError(null);
    }
  }, [isOpen, isSignUp, reset]);

  const handleGoogleAuth = useCallback(() => {
    if (!window.google) return;

    window.google.accounts.id.prompt(
      async (notification: GooglePromptNotification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          try {
            const origin = window.location.origin;
            const { data } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: `${origin}/api/auth/callback?next=popup&origin=${encodeURIComponent(origin)}`,
                skipBrowserRedirect: true,
              },
            });

            if (data?.url) {
              openAuthPopup(data.url);

              const handleMsg = (e: MessageEvent) => {
                if (e.origin !== window.location.origin) return;
                if (e.data?.status === "success") {
                  onClose();
                  queryClient.invalidateQueries({ queryKey: ["auth-user"] });
                }
              };
              window.addEventListener("message", handleMsg);
            }
          } catch (err) {
            console.error("Google Auth Error:", err);
            setError("Lỗi mở cửa sổ đăng nhập.");
          }
        }
      },
    );
  }, [onClose, supabase.auth, queryClient]);

  const onSubmit = async (data: AuthFormData) => {
    setError(null);
    try {
      if (isSignUp) {
        const { data: authData, error: signUpError } =
          await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
              data: { full_name: data.username },
            },
          });

        if (signUpError) throw signUpError;

        if (authData.session) {
          onClose();
        } else {
          setIsSignUp(false);
          setError("Đăng ký thành công! Vui lòng kiểm tra email để xác nhận.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (signInError) throw signInError;
        onClose();
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Đã có lỗi xảy ra";
      setError(errorMessage);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md rounded-[2.5rem] bg-zinc-950 border border-zinc-800 p-10 shadow-2xl animate-in zoom-in-95 duration-300 text-white">
        <button
          onClick={onClose}
          className="absolute right-8 top-8 text-zinc-500 hover:text-white"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>

        <h2 className="text-3xl font-black mb-2 italic uppercase tracking-tighter">
          {isSignUp ? "Tham gia" : "Đăng nhập"}
        </h2>
        <p className="text-zinc-500 text-sm mb-8">
          Trải nghiệm điện ảnh đỉnh cao
        </p>

        <button
          type="button"
          onClick={handleGoogleAuth}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 text-sm font-bold text-black hover:bg-zinc-200 transition-all active:scale-95 shadow-xl shadow-white/5"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Tiếp tục với Google
        </button>

        <div className="my-8 flex items-center gap-4 text-zinc-800 text-[10px] uppercase font-bold tracking-widest leading-none">
          <div className="h-px flex-grow bg-zinc-800" />
          <span className="flex-shrink-0">Hoặc Email</span>
          <div className="h-px flex-grow bg-zinc-800" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
              <div className="relative flex items-center rounded-2xl bg-zinc-900 border border-zinc-800 focus-within:border-red-600 transition-all">
                <UserIcon className="ml-4 h-5 w-5 text-zinc-600" />
                <input
                  {...register("username")}
                  placeholder="Tên hiển thị"
                  className="w-full bg-transparent p-4 text-sm outline-none"
                />
              </div>
              {errors.username && (
                <p className="text-[10px] text-red-500 ml-2">
                  {errors.username.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <div className="relative flex items-center rounded-2xl bg-zinc-900 border border-zinc-800 focus-within:border-red-600 transition-all">
              <EnvelopeIcon className="ml-4 h-5 w-5 text-zinc-600" />
              <input
                {...register("email")}
                type="email"
                placeholder="Email"
                className="w-full bg-transparent p-4 text-sm outline-none"
              />
            </div>
            {errors.email && (
              <p className="text-[10px] text-red-500 ml-2">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <div className="relative flex items-center rounded-2xl bg-zinc-900 border border-zinc-800 focus-within:border-red-600 transition-all">
              <LockClosedIcon className="ml-4 h-5 w-5 text-zinc-600" />
              <input
                {...register("password")}
                type="password"
                placeholder="Mật khẩu"
                className="w-full bg-transparent p-4 text-sm outline-none"
              />
            </div>
            {errors.password && (
              <p className="text-[10px] text-red-500 ml-2">
                {errors.password.message}
              </p>
            )}
          </div>

          {error && (
            <p className="text-center text-[11px] text-red-500 bg-red-500/10 py-2.5 rounded-xl border border-red-500/20">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-red-600 py-4 font-bold hover:bg-red-700 disabled:opacity-50 transition-all active:scale-95 shadow-xl shadow-red-600/20 uppercase tracking-widest text-sm"
          >
            {isSubmitting
              ? "Đang xử lý..."
              : isSignUp
                ? "Tạo tài khoản"
                : "Đăng nhập"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-zinc-500">
          {isSignUp ? "Đã có tài khoản?" : "Thành viên mới?"}{" "}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="font-bold text-white hover:text-red-500 underline underline-offset-4 transition-colors"
          >
            {isSignUp ? "Đăng nhập" : "Tham gia ngay"}
          </button>
        </p>
      </div>
    </div>
  );
}
