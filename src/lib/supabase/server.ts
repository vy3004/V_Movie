import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export const createSupabaseServer = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            if (
              error instanceof Error &&
              !error.message.includes("Server Action")
            ) {
              console.warn("[Supabase Cookie Set Error]:", error.message);
            }
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            if (
              error instanceof Error &&
              !error.message.includes("Server Action")
            ) {
              console.warn("[Supabase Cookie Remove Error]:", error.message);
            }
          }
        },
      },
    },
  );
};
