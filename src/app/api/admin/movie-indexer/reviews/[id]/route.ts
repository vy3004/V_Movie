import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/services/admin-movie-indexer/admin.service";
import { ReviewStatus } from "@/types";

type ReviewAction = "merge" | "keep_separate" | "ignore";

type ReviewRouteContext = {
  params: { id: string };
};

function isReviewAction(value: unknown): value is ReviewAction {
  return value === "merge" || value === "keep_separate" || value === "ignore";
}

function statusForAction(action: ReviewAction): Exclude<ReviewStatus, "pending"> {
  if (action === "merge") return "merged";
  if (action === "keep_separate") return "kept_separate";
  return "ignored";
}

export async function POST(req: NextRequest, { params }: ReviewRouteContext) {
  const user = await requireAdminUser();
  const { id } = params;
  const body = (await req.json()) as { action?: unknown };
  const action = isReviewAction(body.action) ? body.action : "ignore";

  const { data: before, error: beforeError } = await supabaseAdmin
    .from("review_queue")
    .select("*")
    .eq("id", id)
    .single();

  if (beforeError) throw beforeError;

  const { data: after, error } = await supabaseAdmin
    .from("review_queue")
    .update({ status: statusForAction(action), resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  const { error: historyError } = await supabaseAdmin.from("merge_history").insert({
    action,
    review_id: id,
    movie_id: before.target_movie_id,
    before,
    after,
    admin_user_id: user.id,
  });

  if (historyError) throw historyError;

  return NextResponse.json({ ok: true });
}
