import { z } from "zod";

export const historyTrackSchema = z
  .object({
    movie_slug: z
      .string()
      .min(1, "Movie slug không được để trống")
      .max(200, "Movie slug quá dài"),

    movie_name: z.string().max(500, "Movie name quá dài").optional(),

    movie_poster: z.string().max(500, "Movie poster URL quá dài").optional(),

    last_episode_slug: z
      .string()
      .min(1, "Episode slug không được để trống")
      .max(200, "Episode slug quá dài"),

    last_episode_of_movie_slug: z
      .string()
      .min(1, "Last episode slug không được để trống")
      .max(200, "Last episode slug quá dài"),

    current_time: z
      .number()
      .min(0, "Current time không được âm")
      .max(86400, "Current time không được vượt quá 24 giờ"), // Max 24h

    duration: z
      .number()
      .min(0, "Duration không được âm")
      .max(86400, "Duration không được vượt quá 24 giờ"),

    user_id: z.string().uuid("User ID không hợp lệ").optional(),

    device_id: z.string().max(100, "Device ID quá dài").optional(),

    movie_metadata: z
      .object({
        genres: z.array(z.string()).optional(),
        directors: z.array(z.string()).optional(),
        actors: z.array(z.string()).optional(),
        country: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .refine((data) => data.user_id || data.device_id, {
    message: "Phải có user_id hoặc device_id",
  })
  .refine((data) => data.current_time <= data.duration, {
    message: "Current time không được vượt quá duration",
    path: ["current_time"],
  });

export type HistoryTrackPayload = z.infer<typeof historyTrackSchema>;
