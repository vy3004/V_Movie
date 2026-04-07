-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- Bảng Watch History
-- =============================================
CREATE TABLE IF NOT EXISTS public.watch_history (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Constraint UNIQUE NULLS NOT DISTINCT cho phép upsert khi user_id hoặc device_id là NULL
    CONSTRAINT unique_history UNIQUE NULLS NOT DISTINCT (user_id, device_id, movie_slug)
);

-- Index tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_history_user ON public.watch_history (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_device ON public.watch_history (device_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_movie_slug ON public.watch_history (movie_slug);

-- Row Level Security (RLS)
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own history
CREATE POLICY "Users can view their own history"
    ON public.watch_history
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR (user_id IS NULL AND device_id IS NOT NULL)
    );

-- Policy: Users can insert their own history
CREATE POLICY "Users can insert their own history"
    ON public.watch_history
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        OR (user_id IS NULL AND device_id IS NOT NULL)
    );

-- Policy: Users can update their own history
CREATE POLICY "Users can update their own history"
    ON public.watch_history
    FOR UPDATE
    USING (
        auth.uid() = user_id
        OR (user_id IS NULL AND device_id IS NOT NULL)
    );

-- Policy: Users can delete their own history
CREATE POLICY "Users can delete their own history"
    ON public.watch_history
    FOR DELETE
    USING (
        auth.uid() = user_id
        OR (user_id IS NULL AND device_id IS NOT NULL)
    );

-- =============================================
-- Bảng User Preferences
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    genres TEXT[] DEFAULT '{}',
    actors TEXT[] DEFAULT '{}',
    directors TEXT[] DEFAULT '{}',
    watched_movies TEXT[] DEFAULT '{}',
    auto_next_episode BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_preferences_user ON public.user_preferences (user_id);

-- Row Level Security (RLS)
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own preferences
CREATE POLICY "Users can view their own preferences"
    ON public.user_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own preferences
CREATE POLICY "Users can insert their own preferences"
    ON public.user_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own preferences
CREATE POLICY "Users can update their own preferences"
    ON public.user_preferences
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own preferences
CREATE POLICY "Users can delete their own preferences"
    ON public.user_preferences
    FOR DELETE
    USING (auth.uid() = user_id);