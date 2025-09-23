-- ALTER queries to add dynamic tool registration fields to existing realtime_sessions table

-- Add current_mode column
ALTER TABLE public.realtime_sessions 
ADD COLUMN current_mode TEXT CHECK (current_mode IN ('email', 'calendar', 'todo', 'learning', 'relax'));

-- Add selected_account_email column
ALTER TABLE public.realtime_sessions 
ADD COLUMN selected_account_email TEXT;

-- Add active_tools column
ALTER TABLE public.realtime_sessions 
ADD COLUMN active_tools TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add comments for documentation
COMMENT ON COLUMN public.realtime_sessions.current_mode IS 'Current domain/mode for dynamic tool loading';
COMMENT ON COLUMN public.realtime_sessions.selected_account_email IS 'Currently selected Google account email for operations';
COMMENT ON COLUMN public.realtime_sessions.active_tools IS 'Array of currently active tool names';

-- Verify the changes (optional - run this to check the table structure)
-- \d public.realtime_sessions;
