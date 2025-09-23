-- Personal Assistant Database Schema for Supabase
-- Note: JWT secret is managed by Supabase automatically

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Google accounts table
CREATE TABLE IF NOT EXISTS public.google_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  google_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, google_user_id)
);

-- Realtime sessions table
CREATE TABLE IF NOT EXISTS public.realtime_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  openai_session_id TEXT, -- OpenAI's session ID from their API
  session_token TEXT, -- OpenAI ephemeral token (will be null after expiry)
  model TEXT NOT NULL DEFAULT 'gpt-4o-realtime-preview',
  voice TEXT NOT NULL DEFAULT 'verse',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'expired')),
  current_mode TEXT CHECK (current_mode IN ('email', 'calendar', 'todo', 'learning', 'relax')), -- Current domain/mode
  selected_account_email TEXT, -- Currently selected Google account email
  active_tools TEXT[] DEFAULT ARRAY[]::TEXT[], -- Currently active tool names
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  total_messages INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation messages table
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.realtime_sessions(id) ON DELETE CASCADE NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('user_audio', 'user_text', 'assistant_text', 'assistant_audio', 'system')),
  content TEXT, -- Transcribed text or system messages
  audio_duration_ms INTEGER, -- For audio messages
  timestamp_ms BIGINT NOT NULL, -- Relative to session start
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_google_accounts_user_id ON public.google_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_google_accounts_email ON public.google_accounts(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_user_id ON public.realtime_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_status ON public.realtime_sessions(status);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_started_at ON public.realtime_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_id ON public.conversation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_timestamp ON public.conversation_messages(timestamp_ms);

-- Row Level Security Policies

-- User profiles: Users can only see and modify their own profile
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Google accounts: Users can only see and modify their own Google accounts
ALTER TABLE public.google_accounts ENABLE ROW LEVEL SECURITY;

-- Realtime sessions: Users can only see and modify their own sessions (or anonymous sessions)
ALTER TABLE public.realtime_sessions ENABLE ROW LEVEL SECURITY;

-- Conversation messages: Users can only see messages from their own sessions
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Google accounts" ON public.google_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Google accounts" ON public.google_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Google accounts" ON public.google_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own Google accounts" ON public.google_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Realtime sessions policies
CREATE POLICY "Users can view own sessions" ON public.realtime_sessions
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own sessions" ON public.realtime_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own sessions" ON public.realtime_sessions
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete own sessions" ON public.realtime_sessions
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- Conversation messages policies
CREATE POLICY "Users can view own conversation messages" ON public.conversation_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.realtime_sessions 
      WHERE realtime_sessions.id = conversation_messages.session_id 
      AND (realtime_sessions.user_id = auth.uid() OR realtime_sessions.user_id IS NULL)
    )
  );

CREATE POLICY "Users can insert own conversation messages" ON public.conversation_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.realtime_sessions 
      WHERE realtime_sessions.id = conversation_messages.session_id 
      AND (realtime_sessions.user_id = auth.uid() OR realtime_sessions.user_id IS NULL)
    )
  );

CREATE POLICY "Users can update own conversation messages" ON public.conversation_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.realtime_sessions 
      WHERE realtime_sessions.id = conversation_messages.session_id 
      AND (realtime_sessions.user_id = auth.uid() OR realtime_sessions.user_id IS NULL)
    )
  );

CREATE POLICY "Users can delete own conversation messages" ON public.conversation_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.realtime_sessions 
      WHERE realtime_sessions.id = conversation_messages.session_id 
      AND (realtime_sessions.user_id = auth.uid() OR realtime_sessions.user_id IS NULL)
    )
  );

-- Functions to automatically handle updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER handle_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_google_accounts_updated_at
  BEFORE UPDATE ON public.google_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to create user profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
