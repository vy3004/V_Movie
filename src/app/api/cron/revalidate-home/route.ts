import { timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET_SUPABASE;

  if (!isAuthorized(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidatePath("/");

  return NextResponse.json({ ok: true, revalidated: ["/"] });
}
