"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  KeyIcon,
  ArrowPathIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updatePassword } from "../actions";
import {
  updatePasswordSchema,
  UpdatePasswordFormValues,
} from "@/lib/validations/profile.validation";

export default function SecurityTab() {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    mode: "onChange",
    defaultValues: { new_password: "", confirm_password: "" },
  });

  const onSubmit = (data: UpdatePasswordFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("new_password", data.new_password);
      formData.append("confirm_password", data.confirm_password);

      const result = await updatePassword(formData);

      if (result.error) toast.error(result.error);
      else {
        toast.success("Chìa khóa không gian của bạn đã được đổi mới!");
        reset();
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 p-8 sm:p-10 rounded-[2rem] space-y-8 max-w-2xl shadow-xl"
    >
      <div className="flex items-center gap-4 mb-2 pb-6 border-b border-zinc-800/50">
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl shadow-[0_0_15px_rgba(220,38,38,0.1)]">
          <LockClosedIcon className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h3 className="text-xl font-black text-white tracking-wide uppercase">
            Mật khẩu hệ thống
          </h3>
          <p className="text-zinc-500 text-sm font-medium mt-1">
            Bảo vệ tài khoản với mật khẩu dài ít nhất 6 ký tự.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2 group">
          <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 group-focus-within:text-red-500 transition-colors ml-1">
            Mật khẩu mới
          </label>
          <div className="relative">
            <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
            <input
              type="password"
              {...register("new_password")}
              className={`w-full bg-zinc-950/50 border rounded-2xl py-4 pl-12 pr-4 text-white text-sm outline-none transition-all duration-300 ${
                errors.new_password
                  ? "border-red-500 focus:ring-4 focus:ring-red-500/10"
                  : "border-zinc-800 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 hover:border-zinc-700"
              }`}
              placeholder="••••••••"
            />
          </div>
          {errors.new_password && (
            <p className="text-red-500 text-xs mt-1 ml-1">
              {errors.new_password.message}
            </p>
          )}
        </div>

        <div className="space-y-2 group">
          <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 group-focus-within:text-red-500 transition-colors ml-1">
            Xác nhận mật khẩu
          </label>
          <div className="relative">
            <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-red-500 transition-colors" />
            <input
              type="password"
              {...register("confirm_password")}
              className={`w-full bg-zinc-950/50 border rounded-2xl py-4 pl-12 pr-4 text-white text-sm outline-none transition-all duration-300 ${
                errors.confirm_password
                  ? "border-red-500 focus:ring-4 focus:ring-red-500/10"
                  : "border-zinc-800 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 hover:border-zinc-700"
              }`}
              placeholder="••••••••"
            />
          </div>
          {errors.confirm_password && (
            <p className="text-red-500 text-xs mt-1 ml-1">
              {errors.confirm_password.message}
            </p>
          )}
        </div>
      </div>

      <button
        disabled={isPending || !isDirty || !isValid}
        type="submit"
        className="w-full py-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-2xl font-black tracking-widest uppercase transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPending ? (
          <ArrowPathIcon className="w-5 h-5 animate-spin" />
        ) : (
          "THIẾT LẬP MẬT KHẨU"
        )}
      </button>
    </form>
  );
}
