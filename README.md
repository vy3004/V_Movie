# 🎬 V-Movie: Streaming & Real-time Watch Party Platform

**V-Movie** is a modern movie streaming platform built with a **Performance & Scalability First** mindset. Beyond providing a high-quality streaming experience, it solves complex real-time synchronization challenges through a built-in **Watch Party** system with integrated Voice Chat.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-orange?style=for-the-badge&logo=react)](https://zustand-demo.pmnd.rs/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-DB_&_Realtime-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Upstash-Redis-FF4D4D?style=for-the-badge&logo=redis)](https://upstash.com/)
[![LiveKit](https://img.shields.io/badge/LiveKit-WebRTC-white?style=for-the-badge&logo=livekit)](https://livekit.io/)

---

## ✨ Core Features

### 🌐 1. Real-time Watch Party

The Watch Party system utilizes an event-driven architecture, optimized for concurrent viewing experiences for dozens of users in the same room.

- **Hybrid Sync Algorithm:** Combines **Hard Sync** (forces a time jump if the drift is > 1.5s) and **Soft Sync** (dynamically adjusts `playbackRate` between 0.85x - 1.15x for a seamless catch-up without video buffering).
- **High-Performance Messaging:** Real-time chat using an _Optimistic Update with Rollback_ pattern. Implements strict rate limiting (5 msgs/10s) and memory capping (< 150 messages) to prevent memory leaks (DOM thrashing).
- **LiveKit Voice Chat & Auto Ducking:** WebRTC integration for live voice chat. An _Auto Ducking_ algorithm uses `requestAnimationFrame` to smoothly lower the movie volume to 70% when someone speaks, and smoothly restores it during silence.
- **Host Succession & Grace Period:** Strict Role-Based Access Control (Host > Mod > Guest). Automatic host succession if the owner disconnects for > 30s. A 15-second Grace Period prevents users from being kicked during page refreshes (F5) or minor network blips.

### ⚡ 2. High Scalability Architecture

- **Anti-Thundering Herd:** Applies **Jitter** (randomized delays) when tracking watch history, eliminating local DDoS spikes when dozens of users in a room trigger DB writes simultaneously.
- **Zero-DB Mutation:** Utilizes **Lua Scripts** directly on Redis RAM to store watch progress and track lobby user counts, pushing API latency under < 5ms.
- **State Management:** Fully migrated to **Zustand**, isolating components using a context-free pattern, reducing wasteful React re-renders by 80% compared to the legacy Context API approach.

### 🤖 3. AI-Powered Recommendations

- Powered by **Google Gemini 2.5 Flash** to analyze user viewing habits (History, Watch Time, Genres).
- **Batch Processing:** Groups users for nightly AI processing via Cron Jobs (QStash) to heavily optimize API costs.
- **Guest Pool Fallback:** Caches AI-generated recommendations in Redis to cross-share with unauthenticated (guest) users.

### 🍿 4. User Experience & Community

- **Custom Video Player:** Integrates `video.js` with `videojs-hotkeys` and advanced playlist management (Drag-and-Drop reordering optimized via SQL Bulk Updates).
- **Threaded Comments:** Multi-level nested replies system.
- **PWA & Web Push:** Installable as a standalone app with automated push notifications for new episodes or comment mentions.

---

## 🗄️ Database Schema

- `profiles`: User information (Avatar, Bio, Preferences).
- `watch_history`: Movie progress tracking.
- `user_subscriptions`: Movie follow lists & notification settings.
- `comments` & `comment_likes`: Multi-level nested comment trees.
- `notifications` & `push_subscriptions`: In-app and Web Push (P256DH & Auth keys) management.
- `watch_party_rooms`: Watch party metadata (Host, Capacity, Video state).
- `watch_party_participants`: Room membership status (Permissions, Mic/Chat mute state).
- `watch_party_playlist`: Shared movie queue.
- `watch_party_messages`: Chat history and system interactions.

---

## 🌐 API Routes

The system provides RESTful APIs for independent business logic:

- **/api/auth/**: OAuth callbacks.
- **/api/movies/**: Fetches movie lists, details, and SEO metadata.
- **/api/history/**: Progress tracking, statistics, and cross-device sync.
- **/api/comments/**: CRUD for comments, thread lineage, Like/Unlike.
- **/api/subscriptions/ & /api/notifications/**: Follow management and push triggers.
- **/api/recommend/**: Generative AI endpoints (User & Guest modes).
- **/api/watch-party/**: Full room lifecycle management, Video Sync, LiveKit Voice Tokens, and RBAC Permissions.

---

## 🛠 Tech Stack

### Frontend

- **Core:** Next.js 14.2 (App Router)
- **Language:** TypeScript 5.0
- **State Management:** Zustand (Client State), TanStack React Query (Server State)
- **Styling:** Tailwind CSS, Tailwind Animate
- **Video Player:** Video.js (Custom hotkeys, Next episode overlays)

### Backend & Infrastructure

- **Database / Auth:** Supabase PostgreSQL & Supabase Auth
- **Realtime Engine:** Supabase Broadcast & Postgres Changes
- **Cache & Rate Limit:** Upstash Redis (Serverless)
- **WebRTC:** LiveKit Server SDK
- **Cron Jobs:** Upstash QStash

---

## 🛠 Local Setup

### Prerequisites

- Node.js (v18+ or v20+)
- Package Manager: npm / yarn / pnpm

### 1. Clone the Repository

```bash
git clone https://github.com/vy3004/v-movie.git
cd v-movie
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a .env.local file in the root directory and add the following keys:

```bash
# Environment
NODE_ENV=development
NEXT_PUBLIC_PORT=http://localhost:3000

# Feature Flags
NEXT_PUBLIC_USE_ZUSTAND=true

# Supabase Keys (Database, Auth, Realtime)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Upstash Redis Keys (Caching, Rate Limit)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# LiveKit Keys (WebRTC Voice Chat)
NEXT_PUBLIC_LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# VAPID Keys (Web Push Notifications)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_CONTACT_EMAIL=

# Google AI & QStash (Cron jobs)
GOOGLE_GENERATIVE_AI_API_KEY=
QSTASH_URL=
QSTASH_TOKEN=
```

### 4. Run the Application

```bash
npm run dev
```

---

## 👨‍💻 Author

Designed and developed by Trần Nguyễn Kha Vỹ  
_If you find the system architecture or the problem-solving approaches in this project interesting, please consider giving the repository a ⭐!_
