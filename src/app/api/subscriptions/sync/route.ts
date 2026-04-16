import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SubscriptionService } from "@/services/subscription.service";

export const runtime = "edge";

export async function POST(req: Request) {
  const { localSubscriptions } = await req.json();

  if (!Array.isArray(localSubscriptions)) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ success: true });

  try {
    await SubscriptionService.syncLocal(user.id, localSubscriptions);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
