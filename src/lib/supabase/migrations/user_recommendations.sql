-- 1. Tạo bảng lưu trữ gợi ý phim cho từng user
CREATE TABLE public.user_recommendations (
  user_id uuid NOT NULL,
  recommendations jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  
  -- Khóa chính là user_id (Mỗi user chỉ có 1 dòng duy nhất, cập nhật đè lên nhau)
  CONSTRAINT user_recommendations_pkey PRIMARY KEY (user_id),
  -- Xóa user thì xóa luôn gợi ý của họ
  CONSTRAINT user_recommendations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 2. Đánh index cho updated_at để sau này tiện dọn dẹp các bản ghi quá cũ
CREATE INDEX IF NOT EXISTS idx_user_recommendations_updated_at ON public.user_recommendations USING btree (updated_at DESC) TABLESPACE pg_default;

-- 3. Gắn Trigger tự động cập nhật giờ 
CREATE TRIGGER update_user_recommendations_updated_at 
BEFORE UPDATE ON user_recommendations 
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- BẢO MẬT (ROW LEVEL SECURITY)
-- ==========================================
ALTER TABLE public.user_recommendations ENABLE ROW LEVEL SECURITY;

-- Policy: User chỉ được phép ĐỌC dữ liệu gợi ý của chính mình
CREATE POLICY "Users can view their own recommendations" 
ON public.user_recommendations 
FOR SELECT 
USING (auth.uid() = user_id);

