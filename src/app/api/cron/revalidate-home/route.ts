import { timingSafeEqual } from "crypto";
import { revalidateTag, revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ISR_WARM_PATHS } from "@/lib/public-routes";

export const runtime = 'nodejs';

function isAuthorized(authHeader: string | null, cronSecret: string | undefined) {
    if (!authHeader || !cronSecret) return false;
    const expected = `Bearer ${cronSecret}`;

    if (authHeader.length !== expected.length) return false;

    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function POST(request: Request) {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET_SUPABASE;

    // 1. Security Check
    if (!isAuthorized(authHeader, cronSecret)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Invalidate central cache at Tokyo
    revalidateTag('home-tag');
    for (const path of ISR_WARM_PATHS) {
        revalidatePath(path);
    }

    // 3. Trigger Regional Warmup in Hong Kong (fire-and-forget)
    const baseUrl = new URL(request.url).origin;

    fetch(`${baseUrl}/api/cron/warmup-hk`, {
        method: "POST",
        headers: { "Authorization": authHeader || "" },
    }).catch((err) => {
        console.error("Regional trigger failed:", err);
    });

    return NextResponse.json({ ok: true });
}