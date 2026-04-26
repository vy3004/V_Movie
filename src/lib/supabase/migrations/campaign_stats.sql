CREATE TABLE campaign_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_name TEXT NOT NULL, -- Ví dụ: 'Thông báo Arcane Tập 5'
    target_slug TEXT,            -- Ví dụ: 'arcane' (Để sau này filter)
    total_targeted INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    failed_deliveries INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Bật bảo mật RLS
ALTER TABLE campaign_stats ENABLE ROW LEVEL SECURITY;

-- Bảng này chủ yếu được cập nhật ngầm bởi Server (Backend dùng Service Role Key sẽ tự vượt rào RLS).
-- Ở đây ta chỉ mở quyền SELECT để trang Admin có thể query dữ liệu lên biểu đồ.
CREATE POLICY "Admins can read campaign stats"
ON public.campaign_stats FOR SELECT
USING ( true );