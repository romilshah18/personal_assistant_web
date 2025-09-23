-- Session Storage Schema Updates
-- Run these SQL commands in your Supabase SQL editor

-- Realtime sessions table
CREATE TABLE IF NOT EXISTS public.realtime_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  openai_session_id TEXT, -- OpenAI's session ID from their API
  session_token TEXT, -- OpenAI ephemeral token (will be null after expiry)
  model TEXT NOT NULL DEFAULT 'gpt-4o-realtime-preview',
  voice TEXT NOT NULL DEFAULT 'verse',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'expired')),
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
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_user_id ON public.realtime_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_openai_session_id ON public.realtime_sessions(openai_session_id);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_status ON public.realtime_sessions(status);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_started_at ON public.realtime_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_id ON public.conversation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_timestamp ON public.conversation_messages(timestamp_ms);

-- Row Level Security
ALTER TABLE public.realtime_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

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

-- Function to increment message count (optional, for atomic updates)
CREATE OR REPLACE FUNCTION public.increment_session_message_count(session_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.realtime_sessions 
  SET total_messages = total_messages + 1,
      updated_at = NOW()
  WHERE id = session_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

