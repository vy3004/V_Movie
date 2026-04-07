import { Redis } from "@upstash/redis";

const isServer = typeof window === 'undefined';

export const redis: Redis | null = isServer
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;