-- 1. Bảng chính: Watch Party Rooms
CREATE TABLE watch_party_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT UNIQUE NOT NULL, 
  host_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Thông tin phim (Thêm movie_image)
  current_movie_slug TEXT,
  current_episode_slug TEXT,
  movie_image TEXT, 
  
  -- Cấu hình phòng (Bỏ passcode, thêm max_participants)
  title TEXT DEFAULT 'Phòng xem phim vui vẻ',
  is_private BOOLEAN DEFAULT false,
  max_participants INT DEFAULT 20,
  is_active BOOLEAN DEFAULT true,
  
  -- Cấu hình nâng cao
  settings JSONB DEFAULT '{"allow_guest_control": false, "wait_for_all": false, "guest_can_chat": true}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Bảng Playlist: Lưu danh sách phim chờ
CREATE TABLE watch_party_playlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES watch_party_rooms(id) ON DELETE CASCADE NOT NULL,
  movie_slug TEXT NOT NULL,
  movie_name TEXT NOT NULL,
  episode_slug TEXT NOT NULL,
  thumb_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Bảng Participants: Quản lý thành viên & Quyền hạn chi tiết
CREATE TABLE watch_party_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES watch_party_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Bỏ role moderator, chỉ giữ host và guest
  role TEXT DEFAULT 'guest' CHECK (role IN ('host', 'guest')),
  status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'blocked')),
  
  -- Quyền hạn chi tiết (JSONB)
  permissions JSONB DEFAULT '{"can_control_video": false, "can_change_movie": false, "can_manage_users": false}'::jsonb,
  
  is_muted BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(room_id, user_id)
);

-- Index tối ưu hóa truy vấn
CREATE INDEX idx_wp_rooms_code ON watch_party_rooms(room_code);
CREATE INDEX idx_wp_participants_room_user ON watch_party_participants(room_id, user_id);
CREATE INDEX idx_wp_playlist_room ON watch_party_playlist(room_id, sort_order);

-- Kích hoạt Row Level Security (RLS)
ALTER TABLE watch_party_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_party_playlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_party_participants ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- POLICIES (Đã fix lỗi 500 Insert & Phân quyền JSONB)
-- ==========================================

-- POLICY CHO ROOMS
CREATE POLICY "Public can view active rooms metadata" ON watch_party_rooms FOR SELECT USING (is_active = true);

-- [FIX LỖI 500]: Cấp quyền tạo phòng
CREATE POLICY "Users can create rooms" ON watch_party_rooms FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Host VÀ Guest có quyền 'can_change_movie' được phép sửa trạng thái phòng
CREATE POLICY "Authorized users can update room" ON watch_party_rooms FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM watch_party_participants p 
    WHERE p.room_id = watch_party_rooms.id AND p.user_id = auth.uid() 
    AND (p.role = 'host' OR (p.permissions->>'can_change_movie')::boolean = true)
  )
);

-- POLICY CHO PARTICIPANTS
CREATE POLICY "Users can see participants of their joined room" ON watch_party_participants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM watch_party_participants p 
    WHERE p.room_id = watch_party_participants.room_id AND p.user_id = auth.uid() AND p.status = 'approved'
  )
);

-- Cho phép User tự join vào phòng (status mặc định là pending hoặc approved)
CREATE POLICY "Users can join rooms" ON watch_party_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Host VÀ Guest có quyền 'can_manage_users' được duyệt/kick thành viên
CREATE POLICY "Authorized users can update participants" ON watch_party_participants FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM watch_party_participants p 
    WHERE p.room_id = watch_party_participants.room_id AND p.user_id = auth.uid() 
    AND (p.role = 'host' OR (p.permissions->>'can_manage_users')::boolean = true)
  )
);

-- POLICY CHO PLAYLIST
CREATE POLICY "Participants can view playlist" ON watch_party_playlist FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM watch_party_participants p 
    WHERE p.room_id = watch_party_playlist.room_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Authorized users can add to playlist" ON watch_party_playlist FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM watch_party_participants p 
    WHERE p.room_id = watch_party_playlist.room_id AND p.user_id = auth.uid() 
    AND (p.role = 'host' OR (p.permissions->>'can_change_movie')::boolean = true)
  )
);

-- 1. Tạo bảng lưu trữ tin nhắn
CREATE TABLE IF NOT EXISTS watch_party_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES watch_party_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_name TEXT NOT NULL,
    text TEXT NOT NULL,
    type TEXT DEFAULT 'chat', -- 'chat', 'system', 'reaction'
    metadata JSONB DEFAULT '{}'::jsonb, -- Lưu emoji hoặc thông tin phụ
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Thêm cột is_muted vào bảng participants để quản lý việc cấm chat
-- Giả sử bảng của bạn tên là watch_party_participants
ALTER TABLE watch_party_participants 
ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE;

-- 3. Tạo Index để khi vào phòng fetch tin nhắn cũ cho nhanh
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON watch_party_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON watch_party_messages(created_at);

-- 4. Bật Row Level Security (RLS) để bảo mật
ALTER TABLE watch_party_messages ENABLE ROW LEVEL SECURITY;

-- 5. Tạo chính sách: Ai trong phòng cũng được đọc tin nhắn
CREATE POLICY "Users can view messages in their room" 
ON watch_party_messages FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM watch_party_participants 
        WHERE room_id = watch_party_messages.room_id 
        AND user_id = auth.uid()
    )
);

-- 6. Tạo chính sách: Chỉ người không bị muted mới được gửi tin nhắn
CREATE POLICY "Non-muted users can insert messages" 
ON watch_party_messages FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM watch_party_participants 
        WHERE room_id = watch_party_messages.room_id 
        AND user_id = auth.uid()
        AND is_muted = FALSE
    )
);