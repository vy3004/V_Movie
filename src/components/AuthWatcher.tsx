"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthModal } from "@/providers/AuthModalProvider";
import { createSupabaseClient } from "@/lib/supabase/client";

interface GoogleCredentialResponse {
  credential: string;
}

export default function AuthWatcher() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { onOpen } = useAuthModal();
  const supabase = createSupabaseClient();
  const isInitialized = useRef(false);

  useEffect(() => {
    const init = async () => {
      // Khởi tạo Google One Tap khi component mount
      if (window.google && !isInitialized.current) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
          callback: async (res: GoogleCredentialResponse) => {
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: res.credential,
            });

            if (!error) {
              await queryClient.invalidateQueries({ queryKey: ["auth-user"] });
              router.refresh();
            }
          },
          use_fedcm_for_prompt: true,
        });
        isInitialized.current = true;
      }

      // Nếu URL yêu cầu auth
      if (searchParams.get("auth") === "required") {
        onOpen();
        const params = new URLSearchParams(searchParams.toString());
        params.delete("auth");
        router.replace(
          `${pathname}${params.toString() ? `?${params.toString()}` : ""}`,
        );
      }
    };
    init();
  }, [searchParams, onOpen, pathname, router, supabase, queryClient]);

  return null;
}
