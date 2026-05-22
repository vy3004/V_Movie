import { timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ISR_WARM_PATHS } from "@/lib/public-routes";

function isAuthorized(
  authHeader: string | null,
  cronSecret: string | undefined,
) {
  if (!authHeader || !cronSecret) return false;

  const expected = `Bearer ${cronSecret}`;
  const actualBuffer = Buffer.from(authHeader);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function getBaseUrl(request: Request) {
  if (process.env.NEXT_PUBLIC_PORT) return process.env.NEXT_PUBLIC_PORT;

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host");
  if (!host) return null;
  return `${proto}://${host}`;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET_SUPABASE;

  if (!isAuthorized(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  for (const path of ISR_WARM_PATHS) {
    revalidatePath(path);
  }

  const baseUrl = getBaseUrl(request);
  const warmed: string[] = [];
  const failed: { path: string; status?: number; error?: string }[] = [];

  if (baseUrl) {
    for (const path of ISR_WARM_PATHS) {
      try {
        const response = await fetch(new URL(path, baseUrl), {
          headers: { "x-internal-warmup": "1" },
          cache: "no-store",
        });

        if (response.ok) {
          warmed.push(path);
        } else {
          failed.push({ path, status: response.status });
        }
      } catch (error) {
        failed.push({
          path,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    revalidated: ISR_WARM_PATHS,
    warmed,
    failed,
    skippedWarmup: !baseUrl,
  });
}
