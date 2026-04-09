# 🎬 Kế Hoạch Triển Khai Tính Năng "Theo Dõi Phim" (Tích hợp Redis)

## 📌 1. Tầm Nhìn & Mục Tiêu (Business Logic)

1. **Lưu trữ:** Dễ dàng tìm lại phim yêu thích.
2. **Hiệu năng Cực Đại (O(1) Complexity):** Dùng Redis để kiểm tra trạng thái "Đã theo dõi" ngay lập tức mà không cần chạm vào Supabase.
3. **Engagement:** Thông báo khi có tập mới (has_new_episode).
4. **Seamless UX:** Guest dùng LocalStorage, khi Login sẽ gộp (Merge) tự động vào DB và Redis.

---

## 🛠 2. Thiết Kế Cơ Sở Dữ Liệu & Cache (Schema & Redis)

### A. Supabase (Database Chính - Nguồn sự thật)

Tạo bảng `user_subscriptions`:

```sql
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_slug text NOT NULL,
  movie_name text NOT NULL,
  movie_poster text,
  last_known_episode_slug text,
  has_new_episode boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id, movie_slug)
);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own subscriptions" ON user_subscriptions FOR ALL USING (auth.uid() = user_id);
B. Redis (Cache Layer - Bộ nhớ đệm tốc độ cao)
Sử dụng cấu trúc Redis Hash để lưu danh sách theo dõi của từng user.
Key: favorites:user:{user_id}
Field: movie_slug
Value: JSON string chứa { movie_name, movie_poster, last_known_episode_slug, has_new_episode }
Lợi ích:
Kiểm tra 1 phim: HEXISTS favorites:user:123 phim-a (Nhanh như chớp, không tốn quota DB).
Lấy danh sách: HGETALL favorites:user:123.
⚙️ 3. Kiến Trúc API (Next.js Route Handlers + Redis)
Method	Endpoint	Luồng xử lý (Redis + DB)
GET	/api/favorites/check?slug=...	1. Kiểm tra HEXISTS trong Redis.<br>2. Cache Miss: Tìm trong DB, lưu ngược vào Redis (HSET).<br>3. Trả về True/False.
GET	/api/favorites	1. HGETALL từ Redis.<br>2. Cache Miss: Lấy từ DB, backfill vào Redis.<br>3. Trả về mảng JSON.
POST	/api/favorites	1. Thêm vào Supabase (UPSERT).<br>2. Cập nhật Redis (HSET).
DELETE	/api/favorites?slug=...	1. Xóa khỏi Supabase (DELETE).<br>2. Xóa khỏi Redis (HDEL).
POST	/api/favorites/sync	1. Merge LocalStorage vào Supabase.<br>2. Đồng bộ lại toàn bộ Redis Hash của User đó.
💻 4. Frontend (Trải Nghiệm Người Dùng & React Query)
Sử dụng Optimistic UI Updates để người dùng bấm nút là trái tim đỏ ngay lập tức, không cần chờ API.
Hook useFavorite.ts:
Guest: Thêm/Xóa khỏi localStorage.getItem('v_movie_guest_favorites').
User:
Bấm theo dõi -> Đổi màu trái tim ngay (Cập nhật React Query Cache).
Gọi API POST ngầm phía sau.
Nếu API lỗi -> Trả lại màu trái tim cũ (Rollback) & Báo lỗi.
🔄 5. Luồng Chuyển Đổi Guest -> User (Login Sync)
Guest chọn theo dõi 3 phim (lưu LocalStorage).
Khi Guest đăng nhập thành công.
Ở BaseDataContextProvider gọi API POST /api/favorites/sync.
API thực hiện UPSERT 3 phim vào Supabase.
API xóa cache Redis cũ (nếu có) và tải lại Hash mới từ DB lên Redis.
Xóa LocalStorage, làm mới giao diện.
🚀 6. Hệ Thống Thông Báo "Có Tập Mới" (Background Cron Job)
Cron Job (chạy mỗi 4 tiếng) sẽ đánh giá và tự động báo tập mới:
Edge Function check-new-episodes:
Query Supabase: Lấy danh sách các movie_slug đang được theo dõi.
Lấy cấu trúc phim mới nhất từ API nguồn (OPhim).
So sánh API_Latest_Slug với last_known_episode_slug trong DB.
Cập Nhật:
Nếu có tập mới: UPDATE user_subscriptions SET has_new_episode = true, last_known_episode_slug = '...'.
Cập nhật Redis: Xóa key favorites:user:... của các user liên quan để họ lấy lại dữ liệu mới (có cờ has_new_episode = true) ở lần truy cập tới.
(Optional) Bắn Web Push Notification / Email.
📈 7. Các Bước Code Thực Hiện (Roadmap)

Step 1: Chạy SQL tạo bảng user_subscriptions trong Supabase.

Step 2: Thêm helper functions trong lib/utils.ts (VD: getFavoriteCache, updateFavoriteCache).

Step 3: Viết các file API Routes kết hợp Redis (GET, POST, DELETE, SYNC).

Step 4: Tạo Custom Hook useFavorite.ts (Xử lý LocalStorage, React Query Optimistic UI).

Step 5: Cập nhật Nút Theo Dõi ở VideoPlayer và MovieDetail sử dụng hook trên.

Step 6: Tạo trang UI /ca-nhan/phim-theo-doi hiển thị danh sách và nhãn "Tập Mới".
```
