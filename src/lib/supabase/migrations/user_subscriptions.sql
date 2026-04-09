-- 1. Xóa bảng cũ nếu bạn muốn tạo lại từ đầu (Bỏ comment dòng dưới nếu cần)
-- DROP TABLE IF EXISTS user_subscriptions;

-- 2. Tạo bảng user_subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  movie_slug text NOT NULL,
  movie_name text NOT NULL,
  movie_poster text,
  last_known_episode_slug text,
  has_new_episode boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  
  -- Khóa chính kép: Đảm bảo 1 user chỉ có 1 bản ghi duy nhất cho 1 bộ phim
  PRIMARY KEY (user_id, movie_slug)
);

-- 3. Bật tính năng bảo mật Row Level Security (BẮT BUỘC)
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Phân quyền: Cho phép người dùng toàn quyền (ALL) trên chính dữ liệu của họ
-- (Họ chỉ có thể Thêm, Sửa, Xóa, Xem các bộ phim do chính user_id của họ tạo ra)
CREATE POLICY "Users can manage their own subscriptions" 
ON user_subscriptions 
FOR ALL 
USING (auth.uid() = user_id);

-- 5. (Tùy chọn - Cực kỳ khuyên dùng) Tạo Trigger tự động cập nhật cột updated_at mỗi khi có thay đổi
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;

CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();