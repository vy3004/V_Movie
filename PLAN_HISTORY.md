## Kế hoạch triển khai tính năng Watch History và Gợi ý phim

### 1. Phân tích và thiết kế cơ sở dữ liệu Supabase

Dựa trên cấu trúc `HistoryItem` và `EpisodeProgress` đã cung cấp, và bổ sung các nghiệp vụ:

- **Bảng `watch_history`**:
  - `id`: UUID (Primary Key)
  - `user_id`: UUID (Foreign Key to `auth.users`, có thể NULL nếu là lịch sử xem chưa đăng nhập)
  - `device_id`: string (UUID hoặc hash của user agent + IP, để theo dõi lịch sử xem khi chưa đăng nhập, kết hợp với `user_id` nếu người dùng đăng nhập sau)
  - `movie_slug`: string (từ `HistoryItem`)
  - `movie_name`: string (từ `HistoryItem`)
  - `movie_poster`: string (từ `HistoryItem`)
  - `last_episode_slug`: string (từ `HistoryItem`)
  - `episodes_progress`: JSONB (Lưu trữ `Record<string, EpisodeProgress>` từ `HistoryItem`)
  - `is_finished`: boolean (từ `HistoryItem`)
  - `updated_at`: timestamp (từ `HistoryItem`)
  - `created_at`: timestamp (thời điểm tạo bản ghi)

- **Bảng `user_preferences` (Mới - cho tính năng gợi ý)**:
  - `user_id`: UUID (Primary Key, Foreign Key to `auth.users`)
  - `genres`: text[] (Danh sách các thể loại phim yêu thích của người dùng)
  - `actors`: text[] (Danh sách diễn viên yêu thích)
  - `directors`: text[] (Danh sách đạo diễn yêu thích)
  - `watched_movies`: text[] (Danh sách các `movie_slug` đã xem, có thể được lấy từ `watch_history` nhưng có thể lưu riêng để tối ưu query cho gợi ý).
  - `auto_next_episode`: boolean (Cài đặt của người dùng cho tính năng tự động chuyển tập, mặc định là `true`)
  - `updated_at`: timestamp

- **RLS (Row Level Security)**: Thiết lập chính sách RLS để đảm bảo người dùng chỉ có thể đọc và cập nhật lịch sử xem của chính họ. Khi `user_id` là NULL, cần có một chính sách riêng để quản lý dữ liệu dựa trên `device_id`.

### 2. Tích hợp Redis

- **Mục đích**: Cache tiến độ xem phim tạm thời và thông tin `HistoryItem` đầy đủ. Hỗ trợ lưu trữ tạm thời cho người dùng chưa đăng nhập.
- **Cấu trúc key Redis**:
  - `user_id:movie_slug` hoặc `device_id:movie_slug`: Lưu trữ toàn bộ đối tượng `HistoryItem` (serialize thành JSON string).
  - `user_id:new_episodes` hoặc `device_id:new_episodes`: Lưu trữ danh sách `movie_slug` của các phim có tập mới ra mắt mà người dùng đã xem hoặc theo dõi.
  - `user_id:preferences`: Cache cài đặt `user_preferences` cho người dùng.
  - TTL (Time To Live): Thiết lập thời gian sống cho key Redis.

### 3. Phát triển API endpoints (Next.js API Routes)

- **`src/app/api/history/route.ts` (Cần chỉnh sửa/triển khai)**:
  - **POST**: Cập nhật tiến độ xem phim.
    - Nhận `user_id` (từ session, có thể là NULL), `device_id` (từ client, nếu chưa đăng nhập), `HistoryUpdatePayload`.
    - **Nghiệp vụ**: Chỉ lưu vào Redis nếu `ep_last_time` > 30 giây.
    - Tính toán `ep_is_finished`: Nếu `ep_last_time` > 90% `ep_duration`, set `ep_is_finished = true`.
    - Cập nhật đối tượng `HistoryItem` vào Redis.
    - Gửi một job vào queue (hoặc thực hiện cập nhật không đồng bộ) để đồng bộ dữ liệu từ Redis vào Supabase.

- **`src/app/api/history/list/route.ts` (Cần chỉnh sửa/triển khai)**:
  - **GET**: Lấy danh sách lịch sử xem phim của người dùng.
    - Lấy `user_id` từ session (nếu có) hoặc `device_id` từ client.
    - **Chiến lược đọc**: Ưu tiên lấy từ Redis trước. Nếu không có hoặc dữ liệu cũ, thì lấy từ Supabase và sau đó cập nhật lại vào Redis.
    - Kết hợp dữ liệu từ Supabase và Redis để trả về lịch sử xem gần nhất.

- **`src/app/api/recommendations/route.ts` (Mới - cho tính năng gợi ý)**:
  - **GET**: Lấy danh sách phim gợi ý cho người dùng.
    - Lấy `user_id` từ session. Tính năng này chỉ hoạt động khi người dùng đã đăng nhập.
    - Truy vấn `user_preferences` và dữ liệu phim để tìm các phim tương tự hoặc phù hợp.
    - Có thể cache kết quả gợi ý trong Redis.

- **`src/app/api/new-episodes/route.ts` (Mới - cho gợi ý phim mới ra)**:
  - **GET**: Lấy danh sách phim đã xem có tập mới ra mắt.
    - Lấy `user_id` từ session (nếu có) hoặc `device_id` từ client.
    - Truy vấn Redis hoặc Supabase/database phim để tìm các phim có tập mới hơn.

- **`src/app/api/history/sync/route.ts` (Mới - đồng bộ lịch sử local sang Supabase)**:
  - **POST**: Đồng bộ lịch sử xem từ LocalStorage lên Supabase khi người dùng đăng nhập.
    - Nhận `user_id` từ session và danh sách `HistoryItem` từ LocalStorage.
    - Hợp nhất dữ liệu lịch sử xem.

- **`src/app/api/user/preferences/route.ts` (Mới - quản lý cài đặt người dùng)**:
  - **GET/POST/PUT**: Lấy/cập nhật cài đặt người dùng (ví dụ: `auto_next_episode`).

### 4. Logic đồng bộ

- **Redis -> Supabase (Background Sync)**: Cron job hoặc hàm background định kỳ quét Redis để đồng bộ `HistoryItem` vào Supabase.
- **LocalStorage -> Supabase (Client-side trigger)**: Client gọi API `/api/history/sync` khi người dùng đăng nhập.

### 5. Cập nhật Frontend

- **`src/hooks/useWatchHistory.ts` (Cần chỉnh sửa)**:
  - Gửi dữ liệu `HistoryUpdatePayload` lên API `/api/history`.
  - **Nghiệp vụ**: Chỉ gửi cập nhật nếu `ep_last_time` > 30 giây.
  - Sử dụng debounce. Lưu vào LocalStorage khi chưa đăng nhập, đồng bộ khi đăng nhập.
- **`src/app/phim/[slug]/page.tsx` (Cần chỉnh sửa)**:
  - Tích hợp `useWatchHistory` vào component trình phát video.
  - **Nghiệp vụ**: Khi click vào xem phim:
    - Kiểm tra tiến độ xem từ Redis/Supabase (hoặc LocalStorage nếu chưa đăng nhập).
    - Nếu `ep_is_finished` là `true` HOẶC `ep_last_time` quá gần `ep_duration` (> 98%), bắt đầu lại từ đầu.
    - Nếu không, bắt đầu từ `ep_last_time`.
  - **Phim được đánh dấu xem xong**: Nếu xem hơn 90% tập cuối hoặc tập mới nhất.
  - **Tính năng tự động chuyển tập**: Kiểm tra cài đặt `auto_next_episode` từ `user_preferences`. Sử dụng component `VideoPlayer.tsx` đã cung cấp, truyền `auto_next_episode` vào props để điều khiển việc hiển thị và kích hoạt nút chuyển tập. Cần tinh chỉnh UI/UX để nút chuyển tập đẹp mắt và trực quan hơn (tham khảo hình ảnh).
- **`src/components/HistorySection.tsx` (Cần chỉnh sửa)**:
  - Hiển thị danh sách lịch sử xem phim và tiến độ xem.
- **Component `NewEpisodesSection.tsx` (Mới - gợi ý phim mới ra)**:
  - Hiển thị các phim có tập mới ra mắt.
- **Component `RecommendationsSection.tsx` (Mới - gợi ý phim tương tự)**:
  - Hiển thị các phim gợi ý dựa trên sở thích người dùng.
- **Component `EpisodeSelector.tsx` (Mới - hiển thị tiến trình cho từng nút chọn tập)**:
  - Trong danh sách chọn tập, hiển thị một thanh tiến trình nhỏ (ví dụ: thanh ngang dưới thumbnail tập phim) hoặc icon đánh dấu `ep_is_finished` để người dùng dễ dàng hình dung trạng thái xem của từng tập. UI cần trực quan và đẹp mắt.
- **Component `UserSettings.tsx` (Mới - cài đặt người dùng)**:
  - Thêm một toggle button để bật/tắt tính năng tự động chuyển tập (`auto_next_episode`). Cần lưu trạng thái này vào `user_preferences` (Supabase và Redis).

### 6. Xử lý lỗi và bảo mật

- **Xử lý lỗi**: Đảm bảo các API routes xử lý lỗi một cách graceful.
- **Bảo mật**: Xác thực người dùng, xử lý `device_id` an toàn.

### Đề xuất cải tiến và cân nhắc:

1.  **Cải tiến `VideoPlayer.tsx`**:
    - Hiện tại, nút chuyển tập chỉ hiện khi `nextEpisodeSlug` tồn tại. Cần truyền thêm props `autoNextEnabled: boolean` từ `user_preferences` để điều khiển hoàn toàn việc hiển thị nút này, không chỉ dựa vào sự tồn tại của tập tiếp theo.
    - Tối ưu hóa UI của nút chuyển tập: Hiện tại nút có vẻ hơi đơn giản. Có thể thêm animation, hiệu ứng hover, và đảm bảo nó không che khuất nội dung quan trọng của video.
2.  **Quản lý `device_id`**: Tiếp tục sử dụng `localStorage` để lưu `device_id` (UUID) cho người dùng chưa đăng nhập. Đảm bảo `device_id` này đủ duy nhất và được truyền an toàn trong các request.
3.  **Hợp nhất lịch sử xem**: Khi đồng bộ từ LocalStorage sang Supabase, cần có logic hợp nhất thông minh. Ví dụ: nếu một phim đã có trong lịch sử Supabase và cũng có trong LocalStorage, nên giữ lại tiến độ xem cao nhất cho từng tập, hoặc tiến độ cập nhật gần nhất.
4.  **Cập nhật `movie_latest_episode`**: Để tính năng gợi ý phim mới ra hoạt động hiệu quả, cần có một cơ chế định kỳ (cron job) để cập nhật `movie_latest_episode` cho tất cả các phim trong database. Thông tin này có thể được lấy từ nguồn dữ liệu phim bên ngoài.
5.  **Tối ưu hóa hiệu suất Frontend**: Với nhiều component mới và logic phức tạp, cần chú ý đến việc tối ưu hóa re-render, sử dụng `React.memo`, `useCallback`, `useMemo` khi cần thiết.

# TECHNICAL BLUEPRINT: WATCH HISTORY & RECOMMENDATIONS (SENIOR OPTIMIZED)

## MỤC TIÊU (OBJECTIVES)

1. Tracking tiến độ xem phim chính xác (giống Netflix).
2. Tối ưu chi phí Server (giảm 90% số lượng request so với setInterval truyền thống).
3. Hỗ trợ cả User đăng nhập và Guest (qua device_id lưu ở localStorage).
4. Đồng bộ mượt mà từ Guest sang User khi đăng nhập (Merge History).

---

## PHASE 1: DATABASE & TYPESCRIPT INTERFACES (CỐT LÕI)

### 1. Supabase Schema (Tạo trên SQL Editor)

Yêu cầu tạo 2 bảng `watch_history` và `user_preferences`.

```sql
-- Bảng Watch History
CREATE TABLE public.watch_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Null cho Guest
    device_id VARCHAR(255),
    movie_slug VARCHAR(255) NOT NULL,
    movie_name VARCHAR(255) NOT NULL,
    movie_poster TEXT,
    last_episode_slug VARCHAR(255) NOT NULL,
    episodes_progress JSONB DEFAULT '{}'::jsonb,
    is_finished BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_history UNIQUE NULLS NOT DISTINCT (user_id, device_id, movie_slug)
);

-- Index tối ưu truy vấn
CREATE INDEX idx_history_user ON public.watch_history (user_id, updated_at DESC);
CREATE INDEX idx_history_device ON public.watch_history (device_id, updated_at DESC);
2. Typescript Interfaces (src/lib/types.ts)
Bắt buộc AI sử dụng chính xác các type này ở mọi nơi để không bị lỗi any.
code
TypeScript
export interface EpisodeProgress {
  ep_last_time: number;
  ep_duration: number;
  ep_is_finished: boolean;
  ep_updated_at: string;
}

export interface HistoryItem {
  id?: string;
  user_id?: string;
  device_id?: string;
  movie_slug: string;
  movie_name: string;
  movie_poster: string;
  last_episode_slug: string;
  episodes_progress: Record<string, EpisodeProgress>;
  is_finished: boolean;
  updated_at: string;
}

PHASE 2: REDIS CACHE STRATEGY & HELPERS (src/lib/utils.ts)
Quy tắc Cache (Redis):
Key Format: history:user:{user_id} hoặc history:device:{device_id}
Data Type: Sử dụng Redis HASH. Trong đó Field là movie_slug, Value là chuỗi JSON của HistoryItem.
Lý do: Dùng HASH giúp lấy/cập nhật 1 phim cực kỳ nhanh (O(1)) mà không cần tải toàn bộ lịch sử của người dùng.
Các hàm cần tạo trong src/lib/utils.ts:
updateHistoryCache(userId/deviceId, payload: HistoryUpdatePayload): Lấy JSON cũ từ Hash, merge episodes_progress mới, update updated_at, và ghi đè lại vào Hash. Set TTL = 7 ngày.
getHistoryCache(userId/deviceId): Dùng HGETALL để lấy toàn bộ lịch sử xem của user.
PHASE 3: API ENDPOINTS (EDGE RUNTIME)
Bắt buộc sử dụng export const runtime = 'edge' cho các API Route để tốc độ khởi động = 0ms.
1. Endpoint: Ghi nhận tiến độ
File: src/app/api/history/track/route.ts
Method: POST
Logic:
Validate Payload. Nếu current_time < 30 giây -> Bỏ qua (không lưu).
Check is_finished = (current_time / duration) > 0.9.
Update thẳng vào Redis Hash qua hàm updateHistoryCache.
Trả về 200 OK ngay lập tức (Không gọi Supabase ở đây).
2. Endpoint: Lấy danh sách lịch sử
File: src/app/api/history/list/route.ts
Method: GET
Logic:
Lấy dữ liệu từ Redis HGETALL.
Nếu Redis rỗng (Cache miss), truy vấn vào Supabase. Lấy xong ghi ngược lại Redis (Backfill).
Sắp xếp danh sách trả về theo updated_at giảm dần.
3. Endpoint: Đồng bộ Guest sang User
File: src/app/api/history/sync/route.ts
Method: POST
Logic: Khi Login thành công, Client gửi device_id lên. API sẽ tìm tất cả bản ghi có device_id này trong DB, cập nhật cột user_id thành ID của user hiện tại, set device_id = null.
PHASE 4: FRONTEND - TRACKING LOGIC (THE BRAIN)
Đây là nơi quan trọng nhất để không "đốt tiền" server. Không dùng setInterval gọi API.
File: src/hooks/useWatchHistory.ts
Logic chi tiết bắt buộc tuân thủ:
Khởi tạo const trackingData = useRef<HistoryUpdatePayload>() để lưu current_time liên tục mà không re-render React.
Sự kiện onTimeUpdate từ Video Player chỉ cập nhật giá trị vào trackingData.current.
Tạo hàm syncToServer(). Hàm này gửi trackingData.current lên /api/history/track. Dùng navigator.sendBeacon(url, Blob(JSON)) thay vì fetch để đảm bảo không bị chặn khi tắt tab.
Khi nào gọi syncToServer()?
Khi Video Player trigger sự kiện onPause.
Thêm Event Listener cho cửa sổ: visibilitychange (khi user chuyển tab, check document.visibilityState === 'hidden').
Thêm Event Listener: beforeunload (khi user đóng trình duyệt).
Hỗ trợ LocalStorage fallback: Nếu API lỗi, lưu queue các bản cập nhật vào LocalStorage để gửi lại sau.
PHASE 5: UI COMPONENTS (THE FACE)
1. Tích hợp vào Video Player (src/app/phim/[slug]/page.tsx hoặc VideoPlayer.tsx)
Truyền useWatchHistory vào Player.
Resume Logic: Khi video ready, gọi /api/history/list (hoặc React Query). Nếu phim này có ep_last_time và ep_is_finished == false, gọi phương thức video.currentTime = ep_last_time.
2. Cấu trúc Component HistorySection.tsx (Trang chủ)
Data Fetching: Dùng React Query (@tanstack/react-query) hoặc Server Component để lấy lịch sử.
```
