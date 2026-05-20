import { beforeEach, describe, expect, it, vi } from "vitest";
import { addMovieToPlaylist } from "@/stores/watch-party/actions/playlist.actions";
import { useWatchPartyStore } from "@/stores/watch-party";
import type { Movie } from "@/types";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const movie = {
  slug: "one-piece",
  name: "One Piece",
  thumb_url: "thumb.jpg",
  poster_url: "poster.jpg",
  type: "series",
  episodes: [
    {
      server_data: [{ slug: "tap-1" }],
    },
  ],
} as Movie;

describe("watch party playlist actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWatchPartyStore.setState({
      playlist: [],
      room: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        current_movie_slug: "naruto",
      } as any,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            setTimeout(() => {
              resolve({ ok: true, json: async () => ({ success: true }) } as Response);
            }, 10);
          }),
      ),
    );
  });

  it("ignores duplicate add clicks while same movie request is pending", async () => {
    await Promise.all([
      addMovieToPlaylist(
        movie,
        "550e8400-e29b-41d4-a716-446655440000",
        "naruto",
      ),
      addMovieToPlaylist(
        movie,
        "550e8400-e29b-41d4-a716-446655440000",
        "naruto",
      ),
    ]);

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
