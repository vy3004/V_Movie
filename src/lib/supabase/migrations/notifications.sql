CREATE TABLE notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Người nhận
  type text NOT NULL, -- 'new_episode' | 'comment_reply' | 'system'
  movie_slug text,
  movie_name text,
  actor_name text, -- Tên người gây ra (VD: "Admin" hoặc tên người reply)
  content text NOT NULL, -- Nội dung hiển thị
  is_read boolean DEFAULT false,
  metadata jsonb, -- Lưu thêm thông tin phụ (VD: { episode: "10", comment_id: "..." })
  created_at timestamp with time zone DEFAULT now()
);

-- Đánh index để lấy thông báo theo user cực nhanh
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE is_read = false;

-- QUAN TRỌNG: Bật Realtime cho bảng này
alter publication supabase_realtime add table notifications;

-- 1. Bật tính năng bảo mật Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. Chính sách XEM: User chỉ được xem thông báo của chính mình
CREATE POLICY "Users can view their own notifications" 
ON notifications FOR SELECT 
USING (auth.uid() = user_id);

-- 3. Chính sách CẬP NHẬT: User chỉ được phép cập nhật thông báo của mình (để đánh dấu đã đọc)
CREATE POLICY "Users can update their own notifications" 
ON notifications FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Chính sách XÓA: User có thể xóa thông báo của chính mình
CREATE POLICY "Users can delete their own notifications" 
ON notifications FOR DELETE 
USING (auth.uid() = user_id);