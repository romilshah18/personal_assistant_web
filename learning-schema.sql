-- =====================================================
-- LEARNING FEATURE - DATABASE SCHEMA
-- =====================================================
-- Run this SQL in your Supabase SQL Editor
-- This adds learning functionality to the Personal Assistant
-- =====================================================

-- =====================================================
-- 1. LEARNING TOPICS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.learning_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'paused')),
  difficulty_level TEXT DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  estimated_duration TEXT,
  category TEXT DEFAULT 'General',
  
  -- Progress tracking
  current_section TEXT,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  total_sessions INTEGER DEFAULT 0,
  total_duration_minutes INTEGER DEFAULT 0,
  
  -- Resume context
  last_session_summary TEXT,
  next_steps TEXT,
  key_concepts_learned JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 2. LEARNING SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.learning_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID REFERENCES public.learning_topics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  realtime_session_id UUID REFERENCES public.realtime_sessions(id) ON DELETE SET NULL,
  
  session_number INTEGER NOT NULL,
  title TEXT,
  duration_minutes INTEGER DEFAULT 0,
  
  -- Content
  concepts_covered TEXT[] DEFAULT ARRAY[]::TEXT[],
  exercises_completed TEXT[] DEFAULT ARRAY[]::TEXT[],
  questions_asked TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Session data
  conversation_summary TEXT,
  user_understanding_level TEXT CHECK (user_understanding_level IN ('struggling', 'okay', 'confident', 'excellent')),
  
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. LEARNING PROGRESS POINTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.learning_progress_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.learning_sessions(id) ON DELETE CASCADE NOT NULL,
  topic_id UUID REFERENCES public.learning_topics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  
  point_type TEXT NOT NULL CHECK (point_type IN ('concept', 'example', 'exercise', 'question', 'milestone')),
  content TEXT NOT NULL,
  timestamp_in_session INTEGER, -- Milliseconds from session start
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. LEARNING RESOURCES TABLE (Optional)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.learning_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID REFERENCES public.learning_topics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  
  resource_type TEXT CHECK (resource_type IN ('article', 'video', 'documentation', 'book', 'other')),
  title TEXT NOT NULL,
  url TEXT,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_learning_topics_user_id ON public.learning_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_topics_status ON public.learning_topics(status);
CREATE INDEX IF NOT EXISTS idx_learning_topics_category ON public.learning_topics(category);
CREATE INDEX IF NOT EXISTS idx_learning_topics_last_accessed ON public.learning_topics(last_accessed_at);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_topic_id ON public.learning_sessions(topic_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id ON public.learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_realtime_session_id ON public.learning_sessions(realtime_session_id);

CREATE INDEX IF NOT EXISTS idx_learning_progress_points_session_id ON public.learning_progress_points(session_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_points_topic_id ON public.learning_progress_points(topic_id);

CREATE INDEX IF NOT EXISTS idx_learning_resources_topic_id ON public.learning_resources(topic_id);

-- =====================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Learning Topics Policies
ALTER TABLE public.learning_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning topics" ON public.learning_topics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning topics" ON public.learning_topics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning topics" ON public.learning_topics
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own learning topics" ON public.learning_topics
  FOR DELETE USING (auth.uid() = user_id);

-- Learning Sessions Policies
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning sessions" ON public.learning_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning sessions" ON public.learning_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning sessions" ON public.learning_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own learning sessions" ON public.learning_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Learning Progress Points Policies
ALTER TABLE public.learning_progress_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress points" ON public.learning_progress_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress points" ON public.learning_progress_points
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress points" ON public.learning_progress_points
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress points" ON public.learning_progress_points
  FOR DELETE USING (auth.uid() = user_id);

-- Learning Resources Policies
ALTER TABLE public.learning_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning resources" ON public.learning_resources
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning resources" ON public.learning_resources
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning resources" ON public.learning_resources
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own learning resources" ON public.learning_resources
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 7. TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE TRIGGER handle_learning_topics_updated_at
  BEFORE UPDATE ON public.learning_topics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to update topic progress when session ends
CREATE OR REPLACE FUNCTION public.update_topic_progress_on_session_end()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if ended_at is being set for the first time
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    UPDATE public.learning_topics
    SET 
      total_sessions = total_sessions + 1,
      total_duration_minutes = total_duration_minutes + NEW.duration_minutes,
      last_accessed_at = NEW.ended_at,
      updated_at = NOW()
    WHERE id = NEW.topic_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_topic_progress
  AFTER UPDATE ON public.learning_sessions
  FOR EACH ROW
  WHEN (NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL)
  EXECUTE FUNCTION public.update_topic_progress_on_session_end();

-- Function to auto-complete topic when progress reaches 100%
CREATE OR REPLACE FUNCTION public.auto_complete_topic()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.progress_percentage = 100 AND (OLD.progress_percentage IS NULL OR OLD.progress_percentage < 100) THEN
    NEW.status = 'completed';
    NEW.completed_at = NOW();
  ELSIF NEW.progress_percentage < 100 AND OLD.status = 'completed' THEN
    NEW.status = 'in_progress';
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_complete_topic
  BEFORE UPDATE ON public.learning_topics
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_complete_topic();

-- =====================================================
-- 9. GRANT PERMISSIONS
-- =====================================================
GRANT ALL ON public.learning_topics TO authenticated;
GRANT ALL ON public.learning_sessions TO authenticated;
GRANT ALL ON public.learning_progress_points TO authenticated;
GRANT ALL ON public.learning_resources TO authenticated;

-- =====================================================
-- SCHEMA CREATION COMPLETE
-- =====================================================
-- You can now use the learning feature!
-- The backend API will handle all CRUD operations.
-- =====================================================

