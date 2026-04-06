import { useState, useCallback } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { openAuthPopup } from "@/lib/auth-popup";

interface OAuthOptions {
  provider: "google"; // Có thể mở rộng thêm các provider khác trong tương lai
  onSuccess?: () => void;
  onError?: (err: string) => void;
}

export const useOAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createSupabaseClient();

  const login = useCallback(
    async ({ provider, onSuccess, onError }: OAuthOptions) => {
      setIsLoading(true);

      try {
        const origin = window.location.origin;
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${origin}/api/auth/callback?next=popup&origin=${encodeURIComponent(origin)}`,
            skipBrowserRedirect: true,
          },
        });

        if (error || !data.url) throw error || new Error("Không lấy được URL");

        // BƯỚC FIX LỖI:
        const popup = openAuthPopup(data.url);
        // Sau dòng này, TypeScript biết 'popup' là kiểu 'Window' (không null)
        // vì hàm openAuthPopup đã xử lý throw error rồi.

        const checkPopup = setInterval(() => {
          // Kiểm tra an toàn trước khi truy cập closed
          if (!popup || popup.closed) {
            clearInterval(checkPopup);
            setIsLoading(false);
          }
        }, 1000);

        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== origin) return;

          if (event.data?.type === "AUTH_COMPLETE") {
            window.removeEventListener("message", handleMessage);
            clearInterval(checkPopup);

            // Thêm optional chaining (?.) hoặc kiểm tra tồn tại
            popup?.close();

            if (event.data.status === "success") {
              onSuccess?.();
            } else {
              onError?.(event.data.error);
            }
            setIsLoading(false);
          }
        };

        window.addEventListener("message", handleMessage);
      } catch (err: any) {
        onError?.(err.message);
        setIsLoading(false);
      }
    },
    [supabase],
  );

  return { login, isLoading };
};
