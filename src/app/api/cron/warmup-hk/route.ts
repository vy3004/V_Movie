import { NextResponse } from "next/server";
import { ISR_WARM_PATHS } from "@/lib/public-routes";

export const runtime = 'edge';
export const preferredRegion = 'hkg1';
export const dynamic = 'force-dynamic';

/**
 * Edge-compatible timing-safe string comparison.
  */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let res = 0;
    for (let i = 0; i < a.length; i++) {
        res |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return res === 0;
}

type WarmStatus = {
    cacheStatus: string;
    duration: number;
    ok: boolean;
};

async function hitWarmTarget(url: string): Promise<WarmStatus> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "text/html",
                "User-Agent": "Mozilla/5.0 V-Movie-Warmup-Bot-HK",
                "x-internal-warmup": "1",
            },
            cache: "default",
            signal: controller.signal,
        });

        return {
            ok: response.ok,
            cacheStatus: response.headers.get("x-vercel-cache") || "UNKNOWN",
            duration: Date.now() - startTime,
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

async function smartWarmup(url: string): Promise<{
    path: string;
    success: boolean;
    attempts: number;
    finalStatus?: string;
}> {
    const MAX_ATTEMPTS = 1;
    const RETRY_DELAY_MS = 3000;
    const CONFIRM_DELAY_MS = 1200;
    const path = new URL(url).pathname;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const first = await hitWarmTarget(url);
            const firstFresh = first.ok && first.cacheStatus === "REVALIDATED";

            await new Promise((resolve) => setTimeout(resolve, CONFIRM_DELAY_MS));
            const second = await hitWarmTarget(url);
            const secondWarmed = second.ok && second.cacheStatus === "HIT";
            const warmed = firstFresh && secondWarmed;

            if (warmed) {
                return {
                    path,
                    success: true,
                    attempts: attempt,
                    finalStatus: `first=${first.cacheStatus} (${first.duration}ms), confirm=${second.cacheStatus} (${second.duration}ms)`,
                };
            }

            if (attempt === MAX_ATTEMPTS) {
                return {
                    path,
                    success: false,
                    attempts: attempt,
                    finalStatus: `first=${first.cacheStatus} (${first.duration}ms), confirm=${second.cacheStatus} (${second.duration}ms)`,
                };
            }

            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        } catch {
            if (attempt === MAX_ATTEMPTS) return { path, success: false, attempts: attempt };
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }

    return { path, success: false, attempts: MAX_ATTEMPTS };
}

export async function POST(request: Request) {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET_SUPABASE;

    if (!cronSecret) {
        return NextResponse.json({ error: "Missing CRON_SECRET_SUPABASE" }, { status: 500 });
    }

    if (!authHeader || !timingSafeEqual(authHeader, `Bearer ${cronSecret}`)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const baseUrl = new URL(request.url).origin;

    // Run warmups in parallel across all specified paths
    const warmResults = await Promise.all(
        ISR_WARM_PATHS.map((path) =>
            smartWarmup(new URL(path, baseUrl).toString())
        )
    );

    const succeeded = warmResults.filter((r) => r.success);
    const failed = warmResults.filter((r) => !r.success);

    return NextResponse.json({
        ok: true,
        region: "hkg1",
        warmed: succeeded.map((r) => ({
            path: r.path,
            attempts: r.attempts,
            status: r.finalStatus,
        })),
        failed: failed.map((r) => ({
            path: r.path,
            attempts: r.attempts,
            status: r.finalStatus,
        })),
        timestamp: new Date().toISOString(),
    });
}