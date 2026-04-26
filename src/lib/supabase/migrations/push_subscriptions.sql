-- ==============================================================================
-- BẢNG PUSH_SUBSCRIPTIONS (Lưu tọa độ thiết bị của User)
-- ==============================================================================
CREATE TABLE push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subscription JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Bật bảo mật RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Cho phép user tự thêm, sửa, xóa, xem thiết bị của chính họ
CREATE POLICY "Users can manage own push subscriptions"
ON public.push_subscriptions FOR ALL
USING ( auth.uid() = user_id )
WITH CHECK ( auth.uid() = user_id );