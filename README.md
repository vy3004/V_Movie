# 🎬 V-Movie

**V-Movie** là một nền tảng xem phim trực tuyến hiện đại, được xây dựng với kiến trúc tối ưu hiệu suất và trải nghiệm người dùng. Dự án không chỉ cung cấp tính năng xem phim cơ bản mà còn tích hợp hệ thống **Watch Party (Xem chung)** theo thời gian thực, quản lý lịch sử xem, bình luận, và hỗ trợ PWA (Progressive Web App).

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database_&_Auth-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Upstash-Redis-FF4D4D?style=for-the-badge&logo=redis)](https://upstash.com/)

---

## ✨ Tính Năng Nổi Bật

### 🌐 1. Real-time Watch Party (Xem Chung)

Đây là tính năng cốt lõi giúp V-Movie trở nên khác biệt, mang lại trải nghiệm xem phim cùng bạn bè dù ở bất cứ đâu.

<!-- ![Watch Party Demo](./docs/watch-party-demo.gif) -->

- **Hệ thống phòng (Room-based):** Tạo phòng nhanh chóng và mời bạn bè tham gia thông qua **mã code gồm 6 ký tự** ngẫu nhiên.
- **Cơ chế Soft Sync thông minh:** Tự động đồng bộ hóa thời gian phát video giữa các thành viên. Tốc độ phát (playback speed) sẽ linh hoạt điều chỉnh trong khoảng **0.85x đến 1.15x** để các luồng video bắt kịp nhau một cách mượt mà mà không gây giật lag (buffering).
- **Mô hình phân quyền Host/User:** Host có toàn quyền kiểm soát video (Play, Pause, Seek). Hỗ trợ cơ chế chuyển giao quyền Host (Host Succession) cho người khác trong phòng.
- **Tương tác trực tiếp:** Khung chat real-time tích hợp cơ chế **rate-limiting 1500ms** cho tính năng thả cảm xúc (emote), ngăn chặn tình trạng spam làm quá tải hệ thống.

### 🍿 2. Trải Nghiệm Xem Phim Tối Ưu

Giao diện người dùng được thiết kế tập trung vào nội dung và sự tiện lợi.

<!-- <img src="./docs/movie-player.png" alt="Video Player Interface" width="800" /> -->

- **Trình phát Video tùy chỉnh:** Sử dụng `video.js` kết hợp `videojs-hotkeys` để người dùng có thể điều khiển bằng bàn phím tiện lợi (Space để dừng/phát, phím mũi tên để tua,...).
- **Quản lý danh sách tự động:** Tự động lưu lại lịch sử xem phim (Watch History) và cho phép thêm phim vào danh sách đăng ký theo dõi (Subscriptions).
- **Khám phá nội dung:** Hệ thống lọc phim đa dạng, tìm kiếm thông minh và danh sách phim thịnh hành.

### 💬 3. Hệ Thống Tương Tác & Cộng Đồng

Không chỉ là xem phim, người dùng còn có thể thảo luận và kết nối.

<!-- <img src="./docs/comment-section.png" alt="Nested Comments" width="800" /> -->

- **Bình luận đa cấp (Threaded Comments):** Hỗ trợ trả lời (reply) theo từng luồng thảo luận riêng biệt.
- **Tương tác thời gian thực:** Thích (Like) bình luận và hệ thống nhận thông báo (Push Notifications) ngay khi có tương tác mới.

### ⚡ 4. PWA & Tối Ưu Hiệu Suất Cao

Dự án được xây dựng với tư duy "Performance First".

- **Progressive Web App (PWA):** Người dùng có thể cài đặt trực tiếp V-Movie lên màn hình điện thoại hoặc máy tính, mang lại trải nghiệm như một ứng dụng Native thực thụ.
- **Lazy Loading & Infinite Scroll:** Tối ưu hóa tải trang, chỉ fetch dữ liệu và hình ảnh khi cuộn đến vùng hiển thị.
- **SEO Tối Ưu:** Hỗ trợ Dynamic Metadata, `sitemap.ts` và `robots.ts` để thân thiện với các công cụ tìm kiếm.

---

## 🛠 Tech Stack

**Frontend Architecture:**

- [Next.js 14](https://nextjs.org/) (App Router, Server Actions)
- [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) & Tailwind Animate
- **State & Data Fetching:** [@tanstack/react-query](https://tanstack.com/query/latest) & Axios
- **Form Handling:** React Hook Form + Zod

**Backend & Infrastructure:**

- **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL, Realtime WebSockets)
- **Caching & Rate Limiting:** [Upstash Redis](https://upstash.com/)

**Testing & QA:**

- **Unit Testing:** Vitest & React Testing Library
- **E2E Testing:** Playwright

---

## 🚀 Hướng Dẫn Cài Đặt (Local Development)

### Yêu cầu

- Node.js (v18+ hoặc v20+)
- npm / yarn / pnpm

### 1. Clone Source Code

```bash
git clone [https://github.com/vy3004/v-movie.git](https://github.com/vy3004/v-movie.git)
cd v-movie
```

### 2. Cài đặt Dependencies

```bash
npm install
```

### 3. Cấu hình Biến Môi Trường (Environment Variables)

Tạo file .env.local ở thư mục gốc và cung cấp các thông tin sau:

```bash
# Môi trường hệ thống
NODE_ENV=development

# Supabase Keys
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Upstash Redis Keys
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# Livekit Keys
NEXT_PUBLIC_LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

### 4. Chạy Ứng Dụng

```bash
npm run dev
```

Trang web sẽ chạy tại: http://localhost:3000

---

## 👨‍💻 Tác giả

Được thiết kế và phát triển bởi **Trần Nguyễn Kha Vỹ**  
_Nếu bạn thấy dự án này thú vị, đừng quên cho mình một ⭐ nhé!_
