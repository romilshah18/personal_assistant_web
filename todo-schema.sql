-- =====================================================
-- TODO LIST FEATURE - DATABASE SCHEMA
-- =====================================================
-- Run this SQL in your Supabase SQL Editor
-- This adds todo list functionality to the Personal Assistant
-- =====================================================

-- =====================================================
-- 1. TODO CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.todo_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1', -- Hex color code for UI
  icon TEXT DEFAULT '📝', -- Emoji icon
  is_default BOOLEAN DEFAULT false, -- System default categories
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- =====================================================
-- 2. TODOS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.todo_categories(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.realtime_sessions(id) ON DELETE SET NULL, -- Track which session created it
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_from_conversation BOOLEAN DEFAULT false, -- Flag if auto-created
  metadata JSONB DEFAULT '{}', -- Store conversation context, extracted info, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON public.todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_category_id ON public.todos(category_id);
CREATE INDEX IF NOT EXISTS idx_todos_status ON public.todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON public.todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON public.todos(created_at);
CREATE INDEX IF NOT EXISTS idx_todos_session_id ON public.todos(session_id);
CREATE INDEX IF NOT EXISTS idx_todo_categories_user_id ON public.todo_categories(user_id);

-- =====================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on todo_categories
ALTER TABLE public.todo_categories ENABLE ROW LEVEL SECURITY;

-- Todo Categories Policies
CREATE POLICY "Users can view own categories" ON public.todo_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" ON public.todo_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON public.todo_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON public.todo_categories
  FOR DELETE USING (auth.uid() = user_id AND is_default = false);

-- Enable RLS on todos
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Todos Policies
CREATE POLICY "Users can view own todos" ON public.todos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own todos" ON public.todos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own todos" ON public.todos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own todos" ON public.todos
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 5. TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE TRIGGER handle_todo_categories_updated_at
  BEFORE UPDATE ON public.todo_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 6. FUNCTION TO CREATE DEFAULT CATEGORIES
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_default_todo_categories(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.todo_categories (user_id, name, color, icon, is_default) VALUES
    (user_uuid, 'Work', '#3b82f6', '💼', true),
    (user_uuid, 'Personal', '#10b981', '🏠', true),
    (user_uuid, 'Grocery', '#f59e0b', '🛒', true),
    (user_uuid, 'Learning', '#8b5cf6', '📚', true),
    (user_uuid, 'Others', '#6b7280', '📋', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. UPDATE USER CREATION TRIGGER TO CREATE DEFAULT CATEGORIES
-- =====================================================
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
  
  -- Create default todo categories for new user
  PERFORM public.create_default_todo_categories(NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. CREATE DEFAULT CATEGORIES FOR EXISTING USERS
-- =====================================================
-- Run this to create default categories for existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM public.user_profiles LOOP
    -- Check if user already has categories
    IF NOT EXISTS (SELECT 1 FROM public.todo_categories WHERE user_id = user_record.id) THEN
      PERFORM public.create_default_todo_categories(user_record.id);
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 9. HELPER FUNCTION TO AUTO-COMPLETE TODOS
-- =====================================================
-- Trigger to set completed_at when status changes to 'done'
CREATE OR REPLACE FUNCTION public.set_todo_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'done' AND OLD.status = 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_todo_completion
  BEFORE UPDATE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.set_todo_completed_at();

-- =====================================================
-- 10. GRANT PERMISSIONS
-- =====================================================
GRANT ALL ON public.todo_categories TO authenticated;
GRANT ALL ON public.todos TO authenticated;

-- =====================================================
-- SCHEMA CREATION COMPLETE
-- =====================================================
-- You can now use the todo list feature!
-- The backend API will handle all CRUD operations.
-- =====================================================

