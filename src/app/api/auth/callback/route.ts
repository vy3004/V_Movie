// app/api/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // Lấy origin từ query param (do client gửi lên)
  // Nếu không có thì mới dùng origin mặc định của request
  const clientOrigin =
    searchParams.get("origin") || new URL(request.url).origin;

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && next === "popup") {
      return new NextResponse(
        `<html>
          <body>
            <script>
              // clientOrigin lúc này sẽ là https://potential-spoon-...app.github.dev
              window.opener.postMessage(
                { type: "AUTH_COMPLETE", status: "success" }, 
                "${clientOrigin}" 
              );
              window.close();
            </script>
          </body>
        </html>`,
        {
          headers: {
            "Content-Type": "text/html",
            "Cross-Origin-Opener-Policy": "unsafe-none",
          },
        },
      );
    }
  }

  return NextResponse.redirect(`${clientOrigin}/?auth=error`);
}
