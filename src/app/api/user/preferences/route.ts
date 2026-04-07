import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";

export const runtime = "edge";

const PREFERENCES_CACHE_KEY = "user:preferences:";
const PREFERENCES_CACHE_TTL = 60 * 60 * 24 * 7; // 7 days

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Try Redis cache first
    const cacheKey = `${PREFERENCES_CACHE_KEY}${user.id}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    // Fallback to Supabase
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Supabase error:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 }
      );
    }

    // Default preferences if not found
    const preferences = data || {
      user_id: user.id,
      auto_next_episode: true,
      genres: [],
      actors: [],
      directors: [],
      watched_movies: [],
      updated_at: new Date().toISOString(),
    };

    // Cache in Redis
    if (redis) {
      await redis.set(cacheKey, JSON.stringify(preferences), {
        ex: PREFERENCES_CACHE_TTL,
      });
    }

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { auto_next_episode, genres, actors, directors } = body;

    const cacheKey = `${PREFERENCES_CACHE_KEY}${user.id}`;

    // Upsert preferences
    const { data, error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          auto_next_episode: auto_next_episode ?? true,
          genres: genres ?? [],
          actors: actors ?? [],
          directors: directors ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error.message);
      return NextResponse.json(
        { error: "Failed to update preferences" },
        { status: 500 }
      );
    }

    // Update Redis cache
    if (redis) {
      await redis.set(cacheKey, JSON.stringify(data), {
        ex: PREFERENCES_CACHE_TTL,
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating preferences:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // POST is an alias for PUT (for compatibility)
  return PUT(request);
}