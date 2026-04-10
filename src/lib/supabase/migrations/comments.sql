-- ====================================================================================
-- 1. TẠO BẢNG PHỤ TRỢ (LƯU LƯỢT THÍCH)
-- ====================================================================================
CREATE TABLE IF NOT EXISTS public.comment_likes (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment_id uuid NOT NULL, -- Sẽ nối FK sau khi tạo bảng comments
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id, comment_id)
);

-- ====================================================================================
-- 2. TẠO BẢNG CHÍNH (COMMENTS)
-- ====================================================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  movie_slug text NOT NULL,
  user_id uuid NOT NULL,
  parent_id uuid NULL, -- ID của cha trực tiếp (để fetch theo nhánh)
  reply_to_id uuid NULL, -- ID của người bị phản hồi trực tiếp (để tag tên)
  content text NOT NULL,
  likes_count integer DEFAULT 0,
  replies_count integer DEFAULT 0, -- Cache để hiện nút "Xem X phản hồi" cực nhanh
  is_edited boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  path text[] DEFAULT '{}'::text[], -- Mảng [ID_Root, ID_Parent]
  
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments (id) ON DELETE CASCADE,
  CONSTRAINT comments_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.comments (id) ON DELETE SET NULL,
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT comments_user_id_fkey_profiles FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE
);

-- Bây giờ mới add FK cho bảng likes để không bị lỗi thứ tự tạo bảng
ALTER TABLE public.comment_likes 
ADD CONSTRAINT comment_likes_comment_id_fkey 
FOREIGN KEY (comment_id) REFERENCES public.comments (id) ON DELETE CASCADE;

-- ====================================================================================
-- 3. TỐI ƯU HÓA TRUY VẤN (INDEX)
-- ====================================================================================
CREATE INDEX IF NOT EXISTS idx_comments_movie_slug ON public.comments (movie_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_path ON public.comments USING GIN (path);

-- ====================================================================================
-- 4. BẢO MẬT DỮ LIỆU (RLS)
-- ====================================================================================
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Policies cho Comments
CREATE POLICY "Public Select" ON comments FOR SELECT USING (true);
CREATE POLICY "Auth Insert" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner Update" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner Delete" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Policies cho Likes
CREATE POLICY "Public Select Likes" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "User Manage Likes" ON comment_likes FOR ALL USING (auth.uid() = user_id);

-- ====================================================================================
-- 5. TỰ ĐỘNG HÓA (TRIGGERS)
-- ====================================================================================

-- 5.1 Trigger cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_comments_updated_at 
BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5.2 Trigger cập nhật LIKES_COUNT (Sử dụng SECURITY DEFINER để bypass RLS)
CREATE OR REPLACE FUNCTION public.handle_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_likes_count
AFTER INSERT OR DELETE ON public.comment_likes
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_likes_count();

-- 5.3 Trigger cập nhật REPLIES_COUNT (Cho mọi cấp độ)
CREATE OR REPLACE FUNCTION public.handle_replies_count()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL) THEN
    UPDATE public.comments SET replies_count = replies_count + 1 WHERE id = NEW.parent_id;
  ELSIF (TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL) THEN
    UPDATE public.comments SET replies_count = GREATEST(0, replies_count - 1) WHERE id = OLD.parent_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_handle_replies_count
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.handle_replies_count();