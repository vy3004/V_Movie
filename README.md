# 🎬 V-Movie: Real-time Streaming & Watch Party Platform

**V-Movie** is a full-stack movie streaming platform focused on low-latency real-time collaboration, scalable watch-session orchestration, and production-ready user experience.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-orange?style=for-the-badge&logo=react)](https://zustand-demo.pmnd.rs/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-DB_&_Realtime-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Upstash-Redis-FF4D4D?style=for-the-badge&logo=redis)](https://upstash.com/)
[![LiveKit](https://img.shields.io/badge/LiveKit-WebRTC-white?style=for-the-badge&logo=livekit)](https://livekit.io/)

---

## ✨ High-Value Features (through latest commit)

### 1) Real-time Watch Party Engine

- **Hybrid video sync (Hard + Soft):** combines seek correction with dynamic playback-rate adjustment (`0.85x → 1.15x`) to keep participants aligned with smooth playback.
- **Role-based room governance:** Host/Moderator/Guest permissions with controlled actions for sync, settings, and member management.
- **Live room interaction stack:** room chat, playlist collaboration, room settings, participant permissions, and voice controls.
- **LiveKit voice integration:** in-room voice chat with participant-level voice state controls.

### 2) Reliable Presence & Room Lifecycle

- **Lease-based presence tracking:** active-session lease model prevents stale participants from being treated as online.
- **Automatic stale-session janitor:** scheduled cleanup removes stale leases and reconciles participant presence.
- **Auto cleanup for empty rooms:** periodic server-side cleanup keeps lobby/state consistent and reduces stale room drift.
- **Lobby sorting strategies (latest):** `newest`, `most_viewers`, `most_slots` for better room discovery.

### 3) Scalable Data & Caching Strategy

- **Redis-backed hot path:** watch-party presence, lobby caching, and rate-limited flows run on Upstash Redis.
- **Cache invalidation for lobby data:** targeted invalidation strategy for room list consistency.
- **Server-driven pagination + infinite loading:** efficient large-lobby browsing on client and API.

### 4) AI Recommendations Pipeline

- **AI-based recommendation flow:** user/guest recommendation paths with queue-based async scheduling.
- **QStash-backed orchestration:** recommendation jobs use QStash instead of direct cron-only flow for better delivery reliability.
- **Failure-aware batch processing:** improved atomic claim and partial-failure handling in recommendation workers.

### 5) Product Experience Surface

- **Custom player UX:** `video.js` + hotkeys, progress tracking, and episode-flow support.
- **Community features:** threaded comments, likes, notification flows, profile/subscription/dashboard surfaces.
- **PWA support + web push stack:** installable app behavior and browser push pipeline.

---

## 🗺️ Platform Surface

### Main user flows

- Home, movie listing/filtering, movie detail/watch pages
- Watch Party lobby and room experience
- Profile, history, subscriptions, notifications dashboard

### Admin flows

- Admin movie operations and indexing surface
- Collection/review/sync-related admin pages
- Merge-log/admin operational pages

### Watch Party API surface

`/api/watch-party/*` includes routes for:

- Room lifecycle (`create/join/leave/close`)
- Lobby discovery
- Sync and presence
- Playlist and messaging
- Settings and participant permissions
- Voice token provisioning

## 📊 Additional Feature Matrix

| Capability | What it provides | Tradeoff |
|---|---|---|
| Admin movie indexer | Multi-source movie indexing and database-backed catalog operations for admin workflows. | Higher operational complexity than single-source ingestion. |
| User dashboard suite | Profile, watch history, subscriptions, and notification management in one surface. | More API/state synchronization across modules. |
| Community layer | Threaded comments, likes, and push-notification interactions to increase retention loops. | More moderation and notification edge cases. |
| Watch Party moderation | Participant permissions, room settings, capacity rules, and enforced leave/kick flows. | More policy handling and role-transition paths. |
| Realtime collaboration | Shared playlist, chat, presence, and playback sync in collaborative rooms. | Tight latency/reliability requirements across services. |
| Broad API surface | Dedicated endpoints for watch-party lifecycle, sync, messaging, and voice-token issuance. | Larger contract surface to test and maintain. |

---

## 🛠 Tech Stack

### Frontend

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **State management:** Zustand (client state), TanStack Query (server state)
- **Styling:** Tailwind CSS
- **Media player:** Video.js

### Backend & Infrastructure

- **Database/Auth/Realtime:** Supabase (PostgreSQL + Realtime)
- **Caching & rate control:** Upstash Redis
- **Voice/WebRTC:** LiveKit
- **Async job transport:** Upstash QStash

### Quality tooling

- **Unit test runner configured:** Vitest (`npm run test:unit`)
- **E2E test runner configured:** Playwright (`npm run test:e2e`)

---

## 📜 Available Scripts

<!-- AUTO-GENERATED:package.json-scripts:start -->
| Command | Description |
|---|---|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run lint` | Run Next.js ESLint checks |
| `npm run test:unit` | Run unit tests with Vitest |
| `npm run test:e2e` | Run end-to-end tests with Playwright |
| `npm run test:e2e:ui` | Run Playwright UI test runner |
| `npm run index:movies` | Run movie indexing script |
<!-- AUTO-GENERATED:package.json-scripts:end -->

---

## 🚀 Local Setup

### Prerequisites

- Node.js 18+ (20+ recommended)
- npm (or compatible package manager)

### 1) Clone repository

```bash
git clone https://github.com/vy3004/v-movie.git
cd v-movie
```

### 2) Install dependencies

```bash
npm install
```

### 3) Configure environment

Create `.env.local` in project root.

> Note: repository currently has no `.env.example`; table below is generated from environment variables referenced in source.

<!-- AUTO-GENERATED:env-vars:start -->
| Variable | Required | Scope | Description | Example |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Web/API | Supabase project URL used by app clients and server helpers. | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Web/API | Public Supabase anon key for browser-authenticated requests. | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | API/Jobs | Service-role key for privileged server operations. | `eyJ...` |
| `UPSTASH_REDIS_REST_URL` | Yes | API/Jobs | Upstash Redis REST endpoint for cache/presence/rate flows. | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | API/Jobs | Upstash Redis REST token. | `A...` |
| `NEXT_PUBLIC_LIVEKIT_URL` | Yes (voice features) | Web/API | LiveKit server URL for room voice sessions. | `wss://xxx.livekit.cloud` |
| `LIVEKIT_API_KEY` | Yes (voice features) | API | LiveKit API key for token issuance. | `API...` |
| `LIVEKIT_API_SECRET` | Yes (voice features) | API | LiveKit API secret for token signing. | `SECRET...` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Yes (push features) | Web/API | Public VAPID key for browser push subscription. | `BEl...` |
| `VAPID_PRIVATE_KEY` | Yes (push features) | API | Private VAPID key for push signing. | `n0...` |
| `VAPID_CONTACT_EMAIL` | Yes (push features) | API | Contact email in VAPID subject. | `ops@example.com` |
| `QSTASH_URL` | Yes (recommendation queue) | API/Jobs | Base URL for Upstash QStash publish endpoints. | `https://qstash.upstash.io` |
| `QSTASH_TOKEN` | Yes (recommendation queue) | API/Jobs | Bearer token for publishing QStash jobs. | `qst_...` |
| `QSTASH_CURRENT_SIGNING_KEY` | Yes (signed callbacks) | API/Jobs | Current QStash signing key used to verify callbacks. | `sig_...` |
| `QSTASH_NEXT_SIGNING_KEY` | Optional | API/Jobs | Next QStash signing key for key rotation windows. | `sig_...` |
| `CRON_SECRET` | Optional | API | Secret guard for cron-triggered API endpoints. | `cron_secret` |
| `CRON_SECRET_SUPABASE` | Yes (Supabase cron routes) | API/Jobs | Secret guard for Supabase-triggered cleanup/scheduled endpoints. | `supabase_cron_secret` |
| `SUPABASE_URL` | Yes (Supabase Edge Function) | Jobs | Supabase project URL used in edge janitor function runtime. | `https://xxx.supabase.co` |
| `APP_BASE_URL` | Yes (Supabase Edge Function) | Jobs | Base app URL for scheduled/server-to-server calls. | `https://your-app.com` |
| `NEXT_PUBLIC_PORT` | Optional (fallback supported) | Web/API | App base URL used by some server/client flows; defaults to localhost in code paths with fallback. | `http://localhost:3000` |
| `NEXT_PUBLIC_MOVIE_API` | Yes (catalog provider) | Web/API | Upstream movie catalog API base URL. | `https://api.example.com` |
| `NEXT_PUBLIC_IMG_API` | Yes (image provider) | Web | Upstream image API/CDN base URL. | `https://img.example.com` |
| `NODE_ENV` | Optional | Web/API | Runtime environment mode. | `development` |
<!-- AUTO-GENERATED:env-vars:end -->

### 4) Run application

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## 👨‍💻 Author

Designed and developed by **Trần Nguyễn Kha Vỹ**.

If this project architecture and real-time system design are useful to you, consider starring the repository.
