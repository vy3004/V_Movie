import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  getSubscriptionCache,
  updateSubscriptionCache,
  getSubscriptionCacheKey,
} from "@/lib/utils";
import { SubscriptionItem } from "@/lib/types";
import { redis } from "@/lib/redis";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = parseInt(searchParams.get("limit") || "12", 10);
  const limit =
    Number.isNaN(limitParam) || limitParam <= 0 ? 12 : Math.min(limitParam, 60);

  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let subsList: SubscriptionItem[] = [];
    const cachedData = await getSubscriptionCache(user.id);

    if (cachedData) {
      subsList = Object.values(cachedData);
    } else {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("has_new_episode", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      if (data) {
        subsList = data as SubscriptionItem[];
        const key = getSubscriptionCacheKey(user.id);
        if (redis && key && subsList.length > 0) {
          const redisMap = subsList.reduce(
            (acc, item) => {
              acc[item.movie_slug] = JSON.stringify(item);
              return acc;
            },
            {} as Record<string, string>,
          );
          await redis.hset(key, redisMap);
          await redis.expire(key, 60 * 60 * 24 * 30);
        }
      }
    }

    subsList.sort((a, b) => {
      if (a.has_new_episode !== b.has_new_episode)
        return a.has_new_episode ? -1 : 1;
      return (
        new Date(b.updated_at || 0).getTime() -
        new Date(a.updated_at || 0).getTime()
      );
    });

    return NextResponse.json(subsList);
  } catch (error) {
    console.error("[GET_SUBSCRIPTIONS_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: SubscriptionItem = await request.json();
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!body.movie_slug || !body.movie_name || !body.movie_poster)
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );

    const newItem: SubscriptionItem = {
      user_id: user.id,
      movie_slug: body.movie_slug,
      movie_name: body.movie_name,
      movie_poster: body.movie_poster,
      movie_status: body.movie_status || "ongoing",
      last_known_episode_slug: body.last_known_episode_slug,
      has_new_episode: false,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("user_subscriptions")
      .upsert(newItem, { onConflict: "user_id,movie_slug" });

    if (error) throw error;

    await updateSubscriptionCache(user.id, "add", newItem);

    return NextResponse.json({ success: true, item: newItem });
  } catch (error) {
    console.error("[POST_SUBSCRIPTIONS_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const movieSlug = searchParams.get("movieSlug");
    if (!movieSlug) {
      return NextResponse.json({ error: "Missing movieSlug" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("user_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("movie_slug", movieSlug);

    if (error) throw error;

    await updateSubscriptionCache(user.id, "remove", { movie_slug: movieSlug });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE_SUBSCRIPTIONS_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
