const express = require('express');
const cors = require('cors');
const http = require('http');
const fetch = require('node-fetch');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { supabase } = require('./supabase');
const { authenticateUser, optionalAuth } = require('./auth-middleware');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Tool definitions for dynamic registration
const TOOL_DEFINITIONS = {
  // Meta tools - always available at session start
  meta: {
    set_mode: {
      type: "function",
      name: "set_mode",
      description: "Switch between domains (email, calendar, todo, learning, relax). This will load relevant tools for that domain.",
      parameters: {
        type: "object",
        properties: {
          mode: { 
            type: "string", 
            enum: ["email", "calendar", "todo", "learning", "relax"],
            description: "The domain to switch to" 
          }
        },
        required: ["mode"]
      }
    },
    select_account: {
      type: "function",
      name: "select_account",
      description: "Select which Google account to use for operations. Call this when user mentions a specific email or wants to switch accounts.",
      parameters: {
        type: "object",
        properties: {
          email: { 
            type: "string",
            description: "Email address of the account to select" 
          }
        },
        required: ["email"]
      }
    }
  },
  
  // Domain-specific tools
  email: {
    email_actions: {
      type: "function",
      name: "email_actions",
      description: "Comprehensive email management (search, get content, create/update/delete/send drafts, send emails, reply to emails). Use this for all email-related operations including full draft management and smart replies.",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["search", "get", "draft", "send", "reply", "summary", "list_drafts", "update_draft", "delete_draft", "send_draft"],
            description: "The email action to perform"
          },
          args: { 
            type: "object",
            description: "Action-specific arguments"
          }
        },
        required: ["action"]
      }
    }
  },
  
  calendar: {
    calendar_actions: {
      type: "function",
      name: "calendar_actions", 
      description: "Manage calendar events (list, create, update, delete). Use this for all calendar-related operations.",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["list", "create", "update", "delete"],
            description: "The calendar action to perform"
          },
          args: { 
            type: "object",
            description: "Action-specific arguments"
          }
        },
        required: ["action"]
      }
    }
  },
  
  todo: {
    todo_actions: {
      type: "function",
      name: "todo_actions",
      description: `Manage todo items and tasks. Use this when:
- User mentions they need to do something (e.g., "I need to buy milk tomorrow")
- User asks what they need to do today/this week (e.g., "What's on my todo list?")
- User says they completed a task (e.g., "I finished the report")
- User wants to see their tasks or priorities
- Conversation mentions action items that need to be tracked
- User explicitly asks to add something to their todo list

IMPORTANT: Automatically create todos when user mentions future tasks or things they need to do.
Auto-categorize based on context: Work, Personal, Grocery, Learning, or Others.
For due dates: Use ISO 8601 format (e.g., "2025-10-12T14:00:00Z"). Parse natural language dates.`,
      parameters: {
        type: "object", 
        properties: {
          action: { 
            type: "string", 
            enum: ["list", "create", "update", "delete", "complete", "today", "upcoming", "overdue"],
            description: "The todo action to perform"
          },
          args: { 
            type: "object",
            description: `Action-specific arguments:
- list: {status?: "todo"|"in_progress"|"done", category_name?: string, limit?: number}
- create: {title!: string, description?: string, due_date?: ISO8601, category_name?: "Work"|"Personal"|"Grocery"|"Learning"|"Others", priority?: "low"|"medium"|"high", from_conversation?: boolean}
- update: {todo_id!: string, title?: string, description?: string, due_date?: ISO8601, status?: "todo"|"in_progress"|"done", priority?: string}
- complete: {todo_id?: string, title?: string} (can match by title if ID not provided)
- delete: {todo_id!: string}
- today: {} (returns todos due today and overdue items)
- upcoming: {days?: number} (default 7 days)
- overdue: {} (returns all overdue todos)`
          }
        },
        required: ["action"]
      }
    }
  },
  
  learning: {
    learning_actions: {
      type: "function",
      name: "learning_actions",
      description: `Help users learn new topics with continuity across sessions. Track progress and resume from where they left off.

CRITICAL WORKFLOW - ALWAYS FOLLOW THIS:
1. When user says "I want to learn X" or "Teach me X":
   a. FIRST call list_topics to get ALL existing topics
   b. Analyze the list: Does any existing topic semantically match what user wants to learn?
      Examples:
      - User says "Python" → Matches "Python Programming" ✓
      - User says "Python" → Could match BOTH "Python Basics" AND "Python for Data Science" (ask user!)
      - User says "Spanish" → Matches "Spanish Language" ✓
      - User says "JavaScript" → Matches "Advanced JavaScript" (even though user said just "JavaScript")
   
   c. IF MULTIPLE TOPICS MATCH: Ask user "I found these topics: 1) Python Basics (45% complete), 2) Python for Data Science (20% complete). Which one do you want to continue, or start a new one?"
   
   d. IF ONE TOPIC MATCHES: Confirm with user "I see you already have [Topic Name] in progress at X%. Let's continue from there!" Then call continue_topic
   
   e. IF NO MATCH: Create new topic with create_topic

2. When user says "Continue learning X":
   a. Call list_topics to get all topics
   b. Find matching topic
   c. Call continue_topic with that topic_id

3. During learning session: Track what you're teaching

4. At end of session: Call save_progress to save everything

IMPORTANT: YOU must decide if topics match semantically. Don't rely on exact string matching!

Actions:
- list_topics: Get all user's learning topics (ALWAYS use this first to check for existing topics!)
- create_topic: Start learning a new subject (only after confirming no semantic match exists)
- continue_topic: Resume an existing topic with full context
- get_context: Get learning history for a topic
- save_progress: Save current session progress (concepts, summary, next steps)
- complete_topic: Mark topic as completed
- update_topic: Update topic details`,
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["list_topics", "create_topic", "continue_topic", "get_context", "save_progress", "complete_topic", "update_topic"],
            description: "The learning action to perform"
          },
          args: { 
            type: "object",
            description: `Action-specific arguments:
- list_topics: {status?: "not_started"|"in_progress"|"completed"|"paused"} (returns all topics with full details)
- create_topic: {title!: string, description?: string, category?: string, difficulty_level?: "beginner"|"intermediate"|"advanced"}
- continue_topic: {topic_id!: string} (returns last session summary and what to teach next)
- get_context: {topic_id!: string} (returns full learning history)
- save_progress: {topic_id!: string, session_id?: string, concepts_covered?: string[], summary?: string, next_steps?: string, user_understanding?: "struggling"|"okay"|"confident"|"excellent", progress_percentage?: number}
- complete_topic: {topic_id!: string}
- update_topic: {topic_id!: string, progress_percentage?: number, current_section?: string, status?: string}`
          }
        },
        required: ["action"]
      }
    }
  },
  
  relax: {
    relax_actions: {
      type: "function",
      name: "relax_actions",
      description: "Relaxation and entertainment tools (music, meditation, jokes). Use this for relaxation activities.",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["music", "meditation", "joke", "story"],
            description: "The relaxation action to perform"
          },
          args: { 
            type: "object",
            description: "Action-specific arguments"
          }
        },
        required: ["action"]
      }
    }
  }
};

// Helper function to get tools for a specific mode with account context
const getToolsForMode = async (mode, userId = null) => {
  const tools = [];
  
  // Always include meta tools
  tools.push(...Object.values(TOOL_DEFINITIONS.meta));
  
  // Add domain-specific tools if mode is specified
  if (mode && TOOL_DEFINITIONS[mode]) {
    // Check if user has required accounts for this mode
    if ((mode === 'email' || mode === 'calendar') && userId) {
      const { data: accounts } = await supabase
        .from('google_accounts')
        .select('email')
        .eq('user_id', userId);
      
      if (accounts && accounts.length > 0) {
        tools.push(...Object.values(TOOL_DEFINITIONS[mode]));
        
        // Update account selection tool description to include available accounts
        const selectAccountTool = tools.find(t => t.name === 'select_account');
        if (selectAccountTool) {
          selectAccountTool.description += ` Available accounts: ${accounts.map(a => a.email).join(', ')}`;
        }
      }
    } else {
      // For non-account dependent modes, just add the tools
      tools.push(...Object.values(TOOL_DEFINITIONS[mode]));
    }
  }
  
  return tools;
};

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(limiter);
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [
          process.env.FRONTEND_URL || 'https://your-frontend-domain.com',
          'https://personal-assistant-web.vercel.app',
          // Add common production frontend URLs
          'https://personalassistant-frontend.vercel.app',
          'https://personal-assistant-frontend.vercel.app',
          // Add any additional production domains
          ...(process.env.ADDITIONAL_ORIGINS ? process.env.ADDITIONAL_ORIGINS.split(',') : [])
        ]
      : [
          'http://localhost:8080', 
          'https://localhost:8080',
          'http://192.168.1.13:8080', 
          'https://192.168.1.13:8080',
          'http://localhost:3000',
          // Add mobile-friendly origins
          'http://127.0.0.1:8080',
          'https://127.0.0.1:8080'
        ];

    // Check if origin is in allowed list or matches Vercel pattern
    const isAllowed = allowedOrigins.includes(origin) || 
                     (process.env.NODE_ENV === 'production' && /https:\/\/.*\.vercel\.app$/.test(origin));
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.error('🚫 CORS BLOCKED:', {
        origin,
        userAgent: req?.headers?.['user-agent'],
        allowedOrigins,
        environment: process.env.NODE_ENV,
        frontendUrl: process.env.FRONTEND_URL,
        vercelPattern: /https:\/\/.*\.vercel\.app$/.test(origin || ''),
        timestamp: new Date().toISOString()
      });
      
      // For development, be more permissive with localhost and local IPs
      if (process.env.NODE_ENV !== 'production' && origin) {
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)/.test(origin);
        if (isLocalhost) {
          console.log('✅ Allowing localhost/local IP for development:', origin);
          return callback(null, true);
        }
      }
      
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Google OAuth2 Setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Create HTTP server
const server = http.createServer(app);

// Ephemeral token endpoint for OpenAI Realtime API
app.post('/api/realtime/session', optionalAuth, async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured' 
      });
    }

    const { model = 'gpt-4o-realtime-preview', voice = 'verse' } = req.body;
    
    console.log('Creating ephemeral token for OpenAI Realtime API...');
    
    // Get initial tools (meta tools only)
    const initialTools = await getToolsForMode(null, req.user?.id);
    const toolNames = initialTools.map(tool => tool.name);
    
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
        tools: initialTools
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Failed to create OpenAI session',
        details: errorText
      });
    }

    const openaiData = await response.json();
    console.log('Successfully created ephemeral token with initial tools:', toolNames);
    
    // Store session in database
    const { data: sessionData, error: sessionError } = await supabase
      .from('realtime_sessions')
      .insert({
        user_id: req.user?.id || null, // null for anonymous users
        openai_session_id: openaiData.id, // Store OpenAI's session ID
        session_token: openaiData.client_secret?.value || null,
        model,
        voice,
        status: 'active',
        current_mode: null, // No mode selected initially
        selected_account_email: null, // No account selected initially
        active_tools: toolNames, // Store active tool names
        metadata: {
          expires_at: openaiData.client_secret?.expires_at,
          openai_response: openaiData // Store full OpenAI response for reference
        }
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error storing session:', sessionError);
      // Don't fail the request if we can't store the session
      // Just log the error and continue
    }

    // Return OpenAI data plus our session ID
    res.json({
      ...openaiData,
      session_id: sessionData?.id, // Our internal session ID
      active_tools: toolNames // Return active tools for frontend
    });
  } catch (error) {
    console.error('Error creating OpenAI session:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Session Management Endpoints

// Get tools for a specific mode (for frontend to update session via WebRTC)
app.post('/api/realtime/get-tools', optionalAuth, async (req, res) => {
  try {
    const { mode, openai_session_id } = req.body;
    
    if (!mode) {
      return res.status(400).json({ error: 'Mode is required' });
    }

    // Get new tools for the specified mode
    const newTools = await getToolsForMode(mode, req.user?.id);
    const toolNames = newTools.map(tool => tool.name);
    
    console.log(`Getting tools for mode: ${mode}`);
    console.log('Tools:', toolNames);

    // Update our database record if session ID provided
    if (openai_session_id) {
      const updateData = {
        current_mode: mode,
        active_tools: toolNames,
        updated_at: new Date().toISOString()
      };

      // First check if session exists and update user_id if needed
      const { data: existingSession } = await supabase
        .from('realtime_sessions')
        .select('user_id')
        .eq('openai_session_id', openai_session_id)
        .single();

      // If session has no user_id and user is authenticated, set it
      if (existingSession && !existingSession.user_id && req.user?.id) {
        updateData.user_id = req.user.id;
      }

      await supabase
        .from('realtime_sessions')
        .update(updateData)
        .eq('openai_session_id', openai_session_id);
    }
    
    res.json({
      success: true,
      mode,
      tools: newTools,
      active_tools: toolNames
    });
  } catch (error) {
    console.error('Error getting tools for mode:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Update session status (complete, failed, etc.)
app.patch('/api/realtime/session/:sessionId', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status, error_message, duration_seconds, total_messages } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (status) updateData.status = status;
    if (error_message) updateData.error_message = error_message;
    if (duration_seconds !== undefined) updateData.duration_seconds = duration_seconds;
    if (total_messages !== undefined) updateData.total_messages = total_messages;
    
    if (status === 'completed' || status === 'failed' || status === 'expired') {
      updateData.ended_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('realtime_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .eq('user_id', req.user?.id || null) // Ensure user can only update their own sessions
      .select()
      .single();

    if (error) {
      console.error('Error updating session:', error);
      return res.status(500).json({ error: 'Failed to update session' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session: data });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's session history
app.get('/api/realtime/sessions', optionalAuth, async (req, res) => {
  try {
    const { limit = 10, offset = 0, status } = req.query;
    
    let query = supabase
      .from('realtime_sessions')
      .select('*')
      .eq('user_id', req.user?.id || null)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching sessions:', error);
      return res.status(500).json({ error: 'Failed to fetch sessions' });
    }

    res.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session by OpenAI session ID
app.get('/api/realtime/session/openai/:openaiSessionId', optionalAuth, async (req, res) => {
  try {
    const { openaiSessionId } = req.params;
    
    // Get session by OpenAI session ID
    const { data: session, error: sessionError } = await supabase
      .from('realtime_sessions')
      .select('*')
      .eq('openai_session_id', openaiSessionId)
      .eq('user_id', req.user?.id || null)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get conversation messages
    const { data: messages, error: messagesError } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('timestamp_ms', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return res.status(500).json({ error: 'Failed to fetch conversation history' });
    }

    res.json({ 
      session,
      messages: messages || []
    });
  } catch (error) {
    console.error('Error fetching session by OpenAI ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific session with conversation history
app.get('/api/realtime/session/:sessionId', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('realtime_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', req.user?.id || null)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get conversation messages
    const { data: messages, error: messagesError } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp_ms', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return res.status(500).json({ error: 'Failed to fetch conversation history' });
    }

    res.json({ 
      session,
      messages: messages || []
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Store conversation message
app.post('/api/realtime/session/:sessionId/message', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message_type, content, audio_duration_ms, timestamp_ms, metadata } = req.body;
    
    if (!sessionId || !message_type || timestamp_ms === undefined) {
      return res.status(400).json({ 
        error: 'Session ID, message type, and timestamp are required' 
      });
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('realtime_sessions')
      .select('id')
      .eq('id', sessionId)
      // .eq('user_id', req.user?.id || null)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Insert message
    const { data: message, error: messageError } = await supabase
      .from('conversation_messages')
      .insert({
        session_id: sessionId,
        message_type,
        content,
        audio_duration_ms,
        timestamp_ms,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error storing message:', messageError);
      return res.status(500).json({ error: 'Failed to store message' });
    }

    // Update session message count
    await supabase
      .from('realtime_sessions')
      .update({ 
        total_messages: supabase.rpc('increment_total_messages', { session_id: sessionId }),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    res.json({ message });
  } catch (error) {
    console.error('Error storing message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete session and its messages
app.delete('/api/realtime/session/:sessionId', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Delete session (messages will be deleted automatically due to CASCADE)
    const { data, error } = await supabase
      .from('realtime_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', req.user?.id || null)
      .select()
      .single();

    if (error) {
      console.error('Error deleting session:', error);
      return res.status(500).json({ error: 'Failed to delete session' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Tool Call Handling Endpoints

// Handle set_mode tool call
app.post('/api/tools/set_mode', optionalAuth, async (req, res) => {
  try {
    const { mode, openai_session_id } = req.body;
    
    if (!mode) {
      return res.status(400).json({ error: 'Mode is required' });
    }

    // Validate mode
    const validModes = ['email', 'calendar', 'todo', 'learning', 'relax'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode' });
    }

    // Get tools for this mode
    const newTools = await getToolsForMode(mode, req.user?.id);
    const toolNames = newTools.map(tool => tool.name);
    
    // Update our database record if session ID provided
    if (openai_session_id) {
      const updateData = {
        current_mode: mode,
        active_tools: toolNames,
        updated_at: new Date().toISOString()
      };

      await supabase
        .from('realtime_sessions')
        .update(updateData)
        .eq('openai_session_id', openai_session_id)
        .eq('user_id', req.user?.id || null);
    }
    
    res.json({
      success: true,
      message: `Switched to ${mode} mode. Frontend should update session with ${toolNames.length} tools.`,
      mode,
      tools: newTools,
      active_tools: toolNames,
      // Signal to frontend to update WebRTC session
      update_session: true
    });
  } catch (error) {
    console.error('Error handling set_mode:', error);
    res.status(500).json({ 
      error: 'Failed to switch mode',
      message: error.message
    });
  }
});

// Handle select_account tool call
app.post('/api/tools/select_account', optionalAuth, async (req, res) => {
  try {
    const { email, openai_session_id } = req.body;
    
    if (!email || !openai_session_id) {
      return res.status(400).json({ error: 'Email and OpenAI session ID are required' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required to select account' });
    }

    // Verify the user has access to this Google account
    const { data: account, error: accountError } = await supabase
      .from('google_accounts')
      .select('email, name')
      .eq('user_id', req.user.id)
      .eq('email', email)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Google account not found or not connected' });
    }

    // First, let's check if the session exists and get its current user_id
    const { data: existingSession } = await supabase
      .from('realtime_sessions')
      .select('user_id, current_mode')
      .eq('openai_session_id', openai_session_id)
      .single();

    console.log('Found session:', existingSession);

    // Update session with selected account and user_id if not set
    const updateData = { 
      selected_account_email: email,
      updated_at: new Date().toISOString()
    };

    // If session has no user_id, set it to current user
    if (!existingSession?.user_id) {
      updateData.user_id = req.user.id;
    }

    const { data: session, error: sessionError } = await supabase
      .from('realtime_sessions')
      .update(updateData)
      .eq('openai_session_id', openai_session_id)
      .select('current_mode')
      .single();

    if (sessionError) {
      console.error('Error updating session:', sessionError);
      return res.status(500).json({ error: 'Failed to update session' });
    }

    // If we're in email or calendar mode, refresh tools to include account context
    if (session?.current_mode && ['email', 'calendar'].includes(session.current_mode)) {
      await fetch(`${req.protocol}://${req.get('host')}/api/realtime/update-tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization
        },
        body: JSON.stringify({
          openai_session_id,
          mode: session.current_mode,
          selected_account_email: email
        })
      });
    }
    
    res.json({
      success: true,
      message: `Selected account: ${account.name || email}`,
      selected_account: {
        email: account.email,
        name: account.name
      }
    });
  } catch (error) {
    console.error('Error handling select_account:', error);
    res.status(500).json({ 
      error: 'Failed to select account',
      message: error.message
    });
  }
});

// Handle email_actions tool call
app.post('/api/tools/email_actions', authenticateUser, async (req, res) => {
  try {
    const { action, args, openai_session_id } = req.body;
    
    if (!action || !openai_session_id) {
      return res.status(400).json({ error: 'Action and OpenAI session ID are required' });
    }

    // Get session to check selected account
    const { data: session, error: sessionError } = await supabase
      .from('realtime_sessions')
      .select('selected_account_email')
      .eq('openai_session_id', openai_session_id)
      // .eq('user_id', req.user.id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.selected_account_email) {
      // Get available accounts to suggest to user
      const { data: accounts } = await supabase
        .from('google_accounts')
        .select('email, name')
        .eq('user_id', req.user.id);
      
      const accountList = accounts?.map(a => a.email).join(', ') || 'none';
      
      return res.status(400).json({ 
        error: 'No Google account selected for email operations.',
        message: `Please specify which email account to use. Available accounts: ${accountList}. Say "use [email]" to select an account.`,
        action: 'select_account_required',
        available_accounts: accounts || []
      });
    }

    // Get the Google account credentials
    const { data: account, error: accountError } = await supabase
      .from('google_accounts')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('email', session.selected_account_email)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Selected Google account not found' });
    }

    // Set up OAuth client for this account
    const accountOAuth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    accountOAuth.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token
    });

    const gmail = google.gmail({ version: 'v1', auth: accountOAuth });
    
    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    switch (action) {
      case 'search':
        const searchQuery = args?.query || 'in:inbox';
        const maxResults = args?.maxResults || 10;
        
        const searchResponse = await gmail.users.messages.list({
          userId: 'me',
          q: searchQuery,
          maxResults
        });
        
        res.json({
          success: true,
          action: 'search',
          query: searchQuery,
          messages: searchResponse.data.messages || [],
          resultSizeEstimate: searchResponse.data.resultSizeEstimate
        });
        break;
        
      case 'get':
        const messageId = args?.messageId || args?.id;
        if (!messageId) {
          return res.status(400).json({ error: 'Message ID required for get action' });
        }
        
        const getMessage = await gmail.users.messages.get({
          userId: 'me',
          id: messageId
        });
        
        res.json({
          success: true,
          action: 'get',
          message: getMessage.data
        });
        break;
        
      case 'draft':
        // Create email draft
        if (!args?.to) {
          return res.status(400).json({ error: 'Recipient email (to) is required for draft creation' });
        }
        
        // Validate email format
        if (!emailRegex.test(args.to)) {
          return res.status(400).json({ error: 'Invalid recipient email format' });
        }
        
        const emailContent = [
          `To: ${args.to}`,
          `Subject: ${args?.subject || '(No Subject)'}`,
          `Content-Type: text/plain; charset=utf-8`,
          ``,
          `${args?.body || ''}`
        ].join('\r\n');
        
        const draftData = {
          message: {
            raw: Buffer.from(emailContent).toString('base64')
          }
        };
        
        console.log('Creating draft with data:', {
          to: args.to,
          subject: args?.subject || '(No Subject)',
          bodyLength: args?.body?.length || 0
        });
        
        const draft = await gmail.users.drafts.create({
          userId: 'me',
          resource: draftData
        });
        
        console.log('Draft created successfully:', draft.data.id);
        
        res.json({
          success: true,
          action: 'draft',
          draft: draft.data
        });
        break;
        
      case 'send':
        // Send email
        if (!args?.to) {
          return res.status(400).json({ error: 'Recipient email (to) is required for sending' });
        }
        
        // Validate email format
        if (!emailRegex.test(args.to)) {
          return res.status(400).json({ error: 'Invalid recipient email format' });
        }
        
        const sendEmailContent = [
          `To: ${args.to}`,
          `Subject: ${args?.subject || '(No Subject)'}`,
          `Content-Type: text/plain; charset=utf-8`,
          ``,
          `${args?.body || ''}`
        ].join('\r\n');
        
        const sendData = {
          raw: Buffer.from(sendEmailContent).toString('base64')
        };
        
        const sent = await gmail.users.messages.send({
          userId: 'me',
          resource: sendData
        });
        
        res.json({
          success: true,
          action: 'send',
          message: sent.data
        });
        break;
        
      case 'reply':
        // Reply to an existing email
        const replyMessageId = args?.messageId || args?.id;
        if (!replyMessageId) {
          return res.status(400).json({ error: 'Message ID required for reply action' });
        }
        
        if (!args?.body) {
          return res.status(400).json({ error: 'Reply body is required' });
        }
        
        // Get the original message to extract reply information
        const originalMessage = await gmail.users.messages.get({
          userId: 'me',
          id: replyMessageId,
          format: 'full'
        });
        
        // Extract headers from original message
        const headers = originalMessage.data.payload.headers;
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
        
        const originalFrom = getHeader('From');
        const originalTo = getHeader('To');
        const originalCc = getHeader('Cc');
        const originalSubject = getHeader('Subject');
        const originalMessageId = getHeader('Message-ID');
        
        // Determine reply recipients
        let replyTo = originalFrom;
        let replyCc = '';
        
        // If original was sent to multiple people, include them in CC (Reply All logic)
        if (args?.replyAll) {
          const allRecipients = [originalTo, originalCc].filter(Boolean).join(', ');
          replyCc = allRecipients;
        }
        
        // Create reply subject (add "Re: " if not already present)
        let replySubject = originalSubject;
        if (!replySubject.toLowerCase().startsWith('re:')) {
          replySubject = `Re: ${originalSubject}`;
        }
        
        // Build reply email content
        const replyHeaders = [
          `To: ${replyTo}`,
          replyCc ? `Cc: ${replyCc}` : null,
          `Subject: ${replySubject}`,
          originalMessageId ? `In-Reply-To: ${originalMessageId}` : null,
          originalMessageId ? `References: ${originalMessageId}` : null,
          `Content-Type: text/plain; charset=utf-8`,
          ``
        ].filter(Boolean).join('\r\n');
        
        const replyBody = args.body;
        const replyEmailContent = replyHeaders + replyBody;
        
        console.log('Creating reply with data:', {
          originalFrom,
          replyTo,
          replyCc,
          replySubject,
          replyAll: args?.replyAll || false,
          bodyLength: replyBody?.length || 0
        });
        
        // Create reply as draft or send directly based on args
        if (args?.sendImmediately) {
          // Send reply immediately
          const replyData = {
            raw: Buffer.from(replyEmailContent).toString('base64')
          };
          
          const sentReply = await gmail.users.messages.send({
            userId: 'me',
            resource: replyData
          });
          
          console.log('Reply sent successfully:', sentReply.data.id);
          
          res.json({
            success: true,
            action: 'reply',
            type: 'sent',
            message: sentReply.data,
            replyTo,
            subject: replySubject
          });
        } else {
          // Create reply as draft
          const replyDraftData = {
            message: {
              raw: Buffer.from(replyEmailContent).toString('base64')
            }
          };
          
          const replyDraft = await gmail.users.drafts.create({
            userId: 'me',
            resource: replyDraftData
          });
          
          console.log('Reply draft created successfully:', replyDraft.data.id);
          
          res.json({
            success: true,
            action: 'reply',
            type: 'draft',
            draft: replyDraft.data,
            replyTo,
            subject: replySubject
          });
        }
        break;
        
      case 'summary':
        // Get email summary based on filters
        const summaryQuery = args?.query || 'in:inbox';
        const summaryMaxResults = args?.maxResults || 20;
        const timeRange = args?.timeRange || 'week'; // day, week, month
        
        // Add time filter to query
        let timeFilter = '';
        const now = new Date();
        switch (timeRange) {
          case 'day':
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            timeFilter = `after:${Math.floor(yesterday.getTime() / 1000)}`;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            timeFilter = `after:${Math.floor(weekAgo.getTime() / 1000)}`;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            timeFilter = `after:${Math.floor(monthAgo.getTime() / 1000)}`;
            break;
        }
        
        const finalQuery = timeFilter ? `${summaryQuery} ${timeFilter}` : summaryQuery;
        
        // Search for emails
        const summarySearchResponse = await gmail.users.messages.list({
          userId: 'me',
          q: finalQuery,
          maxResults: summaryMaxResults
        });
        
        if (!summarySearchResponse.data.messages || summarySearchResponse.data.messages.length === 0) {
          return res.json({
            success: true,
            action: 'summary',
            summary: {
              totalEmails: 0,
              timeRange,
              query: finalQuery,
              message: 'No emails found matching the criteria.'
            }
          });
        }
        
        // Get details for each email (in batches to avoid rate limits)
        const emailDetails = [];
        const batchSize = 10;
        
        for (let i = 0; i < Math.min(summarySearchResponse.data.messages.length, batchSize); i++) {
          const messageId = summarySearchResponse.data.messages[i].id;
          try {
            const emailDetail = await gmail.users.messages.get({
              userId: 'me',
              id: messageId,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date']
            });
            
            const headers = emailDetail.data.payload.headers;
            const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
            const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
            const date = headers.find(h => h.name === 'Date')?.value || 'Unknown Date';
            
            emailDetails.push({
              id: messageId,
              from,
              subject,
              date,
              snippet: emailDetail.data.snippet || ''
            });
          } catch (emailError) {
            console.error(`Error fetching email ${messageId}:`, emailError);
          }
        }
        
        // Analyze emails for summary
        const senders = {};
        const subjects = [];
        let totalEmails = summarySearchResponse.data.resultSizeEstimate || 0;
        
        emailDetails.forEach(email => {
          // Count emails by sender
          const senderEmail = email.from.match(/<(.+)>/) ? email.from.match(/<(.+)>/)[1] : email.from;
          senders[senderEmail] = (senders[senderEmail] || 0) + 1;
          
          // Collect subjects
          subjects.push(email.subject);
        });
        
        // Get top senders
        const topSenders = Object.entries(senders)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([email, count]) => ({ email, count }));
        
        // Generate summary
        const summary = {
          totalEmails,
          analyzedEmails: emailDetails.length,
          timeRange,
          query: finalQuery,
          topSenders,
          recentEmails: emailDetails.slice(0, 5).map(email => ({
            from: email.from,
            subject: email.subject,
            date: email.date,
            snippet: email.snippet.substring(0, 100) + '...'
          })),
          insights: {
            mostActiveDay: timeRange,
            averageEmailsPerDay: Math.round(totalEmails / (timeRange === 'day' ? 1 : timeRange === 'week' ? 7 : 30)),
            hasUnread: summaryQuery.includes('is:unread') || false
          }
        };
        
        res.json({
          success: true,
          action: 'summary',
          summary
        });
        break;
        
      case 'list_drafts':
        // List all drafts
        const draftsResponse = await gmail.users.drafts.list({
          userId: 'me',
          maxResults: args?.maxResults || 10
        });
        
        res.json({
          success: true,
          action: 'list_drafts',
          drafts: draftsResponse.data.drafts || []
        });
        break;
        
      case 'update_draft':
        // Update an existing draft
        const updateDraftId = args?.draftId || args?.id;
        if (!updateDraftId) {
          return res.status(400).json({ error: 'Draft ID required for update_draft action' });
        }
        
        // Validate email if provided
        if (args?.to && !emailRegex.test(args.to)) {
          return res.status(400).json({ error: 'Invalid recipient email format' });
        }
        
        const updateEmailContent = [
          `To: ${args?.to || ''}`,
          `Subject: ${args?.subject || '(No Subject)'}`,
          `Content-Type: text/plain; charset=utf-8`,
          ``,
          `${args?.body || ''}`
        ].join('\r\n');
        
        const updateDraftData = {
          message: {
            raw: Buffer.from(updateEmailContent).toString('base64')
          }
        };
        
        const updatedDraft = await gmail.users.drafts.update({
          userId: 'me',
          id: updateDraftId,
          resource: updateDraftData
        });
        
        res.json({
          success: true,
          action: 'update_draft',
          draft: updatedDraft.data
        });
        break;
        
      case 'delete_draft':
        // Delete a draft
        const deleteDraftId = args?.draftId || args?.id;
        if (!deleteDraftId) {
          return res.status(400).json({ error: 'Draft ID required for delete_draft action' });
        }
        
        await gmail.users.drafts.delete({
          userId: 'me',
          id: deleteDraftId
        });
        
        res.json({
          success: true,
          action: 'delete_draft',
          message: `Draft ${deleteDraftId} deleted successfully`
        });
        break;
        
      case 'send_draft':
        // Send an existing draft
        const sendDraftId = args?.draftId || args?.id;
        if (!sendDraftId) {
          return res.status(400).json({ error: 'Draft ID required for send_draft action' });
        }
        
        const sentDraft = await gmail.users.drafts.send({
          userId: 'me',
          resource: { id: sendDraftId }
        });
        
        res.json({
          success: true,
          action: 'send_draft',
          message: sentDraft.data
        });
        break;
        
      default:
        return res.status(400).json({ error: 'Unknown email action' });
    }
  } catch (error) {
    console.error('Error handling email_actions:', error);
    res.status(500).json({ 
      error: 'Email action failed',
      message: error.message
    });
  }
});

// Handle calendar_actions tool call
app.post('/api/tools/calendar_actions', authenticateUser, async (req, res) => {
  try {
    const { action, args, openai_session_id } = req.body;
    
    if (!action || !openai_session_id) {
      return res.status(400).json({ error: 'Action and OpenAI session ID are required' });
    }

    // Get session to check selected account
    const { data: session, error: sessionError } = await supabase
      .from('realtime_sessions')
      .select('selected_account_email')
      .eq('openai_session_id', openai_session_id)
      // .eq('user_id', req.user.id) // Commented out temporarily for debugging
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.selected_account_email) {
      // Get available accounts to suggest to user
      const { data: accounts } = await supabase
        .from('google_accounts')
        .select('email, name')
        .eq('user_id', req.user.id);
      
      const accountList = accounts?.map(a => a.email).join(', ') || 'none';
      
      return res.status(400).json({ 
        error: 'No Google account selected for calendar operations.',
        message: `Please specify which email account to use. Available accounts: ${accountList}. Say "use [email]" to select an account.`,
        action: 'select_account_required',
        available_accounts: accounts || []
      });
    }

    // Get the Google account credentials
    const { data: account, error: accountError } = await supabase
      .from('google_accounts')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('email', session.selected_account_email)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Selected Google account not found' });
    }

    // Set up OAuth client for this account
    const accountOAuth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    accountOAuth.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: accountOAuth });
    
    switch (action) {
      case 'list':
        const timeMin = args?.timeMin || new Date().toISOString();
        const maxResults = args?.maxResults || 10;
        
        const events = await calendar.events.list({
          calendarId: 'primary',
          timeMin,
          maxResults,
          singleEvents: true,
          orderBy: 'startTime'
        });
        
        res.json({
          success: true,
          action: 'list',
          events: events.data.items || []
        });
        break;
        
      case 'create':
        if (!args?.description) {
          return res.status(400).json({ error: 'Event summary required for create action' });
        }
        
        const eventData = {
          summary: args?.description,
          description: args.description || '',
          start: {
            dateTime: args.startTime || new Date().toISOString(),
            timeZone: args.timeZone || 'UTC'
          },
          end: {
            dateTime: args.endTime || new Date(Date.now() + 3600000).toISOString(), // +1 hour
            timeZone: args.timeZone || 'UTC'
          }
        };
        
        const createdEvent = await calendar.events.insert({
          calendarId: 'primary',
          resource: eventData
        });
        
        res.json({
          success: true,
          action: 'create',
          event: createdEvent.data
        });
        break;
        
      default:
        return res.status(400).json({ error: 'Unknown calendar action' });
    }
  } catch (error) {
    console.error('Error handling calendar_actions:', error);
    res.status(500).json({ 
      error: 'Calendar action failed',
      message: error.message
    });
  }
});

// Helper function to get internal session ID from OpenAI session ID
async function getSessionId(openaiSessionId) {
  const { data } = await supabase
    .from('realtime_sessions')
    .select('id')
    .eq('openai_session_id', openaiSessionId)
    .single();
  return data?.id;
}

// Helper function to categorize todo by keywords
function categorizeTodoByKeywords(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  
  // Work keywords
  if (/\b(meeting|presentation|report|project|client|deadline|work|office|email|call|review)\b/.test(text)) {
    return 'Work';
  }
  
  // Grocery keywords
  if (/\b(buy|grocery|groceries|shopping|store|milk|bread|food|cook|meal)\b/.test(text)) {
    return 'Grocery';
  }
  
  // Learning keywords
  if (/\b(learn|study|read|course|tutorial|practice|research|book|article)\b/.test(text)) {
    return 'Learning';
  }
  
  // Personal keywords
  if (/\b(personal|home|family|friend|doctor|appointment|birthday|call|visit)\b/.test(text)) {
    return 'Personal';
  }
  
  return 'Others';
}

// Handle todo_actions tool call
app.post('/api/tools/todo_actions', authenticateUser, async (req, res) => {
  try {
    const { action, args, openai_session_id } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }

    const userId = req.user.id;
    
    switch (action) {
      case 'list':
        // Get todos with optional filters
        let listQuery = supabase
          .from('todos')
          .select(`
            *,
            category:todo_categories(id, name, color, icon)
          `)
          .eq('user_id', userId)
          .order('due_date', { ascending: true, nullsFirst: false });
        
        // Apply filters from args
        if (args?.status) listQuery = listQuery.eq('status', args.status);
        if (args?.category_id) listQuery = listQuery.eq('category_id', args.category_id);
        if (args?.category_name) {
          // Get category ID by name first
          const { data: category } = await supabase
            .from('todo_categories')
            .select('id')
            .eq('user_id', userId)
            .ilike('name', args.category_name)
            .single();
          if (category) listQuery = listQuery.eq('category_id', category.id);
        }
        if (args?.limit) listQuery = listQuery.limit(args.limit);
        
        const { data: todos, error: listError } = await listQuery;
        
        if (listError) throw listError;
        
        return res.json({
          success: true,
          action: 'list',
          todos: todos || [],
          count: todos?.length || 0
        });
        
      case 'create':
        // Validate required fields
        if (!args?.title) {
          return res.status(400).json({ error: 'Title is required' });
        }
        
        // Get category ID if category name provided
        let categoryId = args.category_id;
        if (args.category_name && !categoryId) {
          const { data: category } = await supabase
            .from('todo_categories')
            .select('id')
            .eq('user_id', userId)
            .ilike('name', args.category_name)
            .single();
          categoryId = category?.id;
        }
        
        // Auto-categorize if no category provided
        if (!categoryId && !args.category_name) {
          const suggestedCategory = categorizeTodoByKeywords(args.title, args.description);
          const { data: category } = await supabase
            .from('todo_categories')
            .select('id')
            .eq('user_id', userId)
            .eq('name', suggestedCategory)
            .single();
          categoryId = category?.id;
        }
        
        const sessionId = openai_session_id ? await getSessionId(openai_session_id) : null;
        
        const { data: newTodo, error: createError } = await supabase
          .from('todos')
          .insert({
            user_id: userId,
            session_id: sessionId,
            title: args.title,
            description: args.description || null,
            due_date: args.due_date || null,
            category_id: categoryId || null,
            status: args.status || 'todo',
            priority: args.priority || 'medium',
            created_from_conversation: args.from_conversation || false,
            metadata: args.metadata || {}
          })
          .select(`
            *,
            category:todo_categories(id, name, color, icon)
          `)
          .single();
        
        if (createError) throw createError;
        
        return res.json({
          success: true,
          action: 'create',
          todo: newTodo,
          message: `Todo "${args.title}" created successfully`
        });
        
      case 'update':
        const todoId = args?.todo_id || args?.id;
        if (!todoId) {
          return res.status(400).json({ error: 'Todo ID is required for update' });
        }
        
        const updateData = {};
        if (args.title !== undefined) updateData.title = args.title;
        if (args.description !== undefined) updateData.description = args.description;
        if (args.due_date !== undefined) updateData.due_date = args.due_date;
        if (args.status !== undefined) updateData.status = args.status;
        if (args.priority !== undefined) updateData.priority = args.priority;
        
        // Handle category update
        if (args.category_name) {
          const { data: category } = await supabase
            .from('todo_categories')
            .select('id')
            .eq('user_id', userId)
            .ilike('name', args.category_name)
            .single();
          if (category) updateData.category_id = category.id;
        } else if (args.category_id !== undefined) {
          updateData.category_id = args.category_id;
        }
        
        const { data: updatedTodo, error: updateError } = await supabase
          .from('todos')
          .update(updateData)
          .eq('id', todoId)
          .eq('user_id', userId)
          .select(`
            *,
            category:todo_categories(id, name, color, icon)
          `)
          .single();
        
        if (updateError) throw updateError;
        
        if (!updatedTodo) {
          return res.status(404).json({ error: 'Todo not found' });
        }
        
        return res.json({
          success: true,
          action: 'update',
          todo: updatedTodo,
          message: 'Todo updated successfully'
        });
        
      case 'complete':
        let completeId = args?.todo_id || args?.id;
        
        // If no ID provided, try to find by title (fuzzy match)
        if (!completeId && args?.title) {
          const { data: matchingTodos } = await supabase
            .from('todos')
            .select('id, title')
            .eq('user_id', userId)
            .neq('status', 'done')
            .ilike('title', `%${args.title}%`)
            .limit(1);
          
          if (matchingTodos && matchingTodos.length > 0) {
            completeId = matchingTodos[0].id;
          }
        }
        
        if (!completeId) {
          return res.status(400).json({ 
            error: 'Todo ID or title is required',
            message: 'Please specify which todo to mark as complete'
          });
        }
        
        const { data: completedTodo, error: completeError } = await supabase
          .from('todos')
          .update({ status: 'done' })
          .eq('id', completeId)
          .eq('user_id', userId)
          .select(`
            *,
            category:todo_categories(id, name, color, icon)
          `)
          .single();
        
        if (completeError) throw completeError;
        
        if (!completedTodo) {
          return res.status(404).json({ error: 'Todo not found' });
        }
        
        return res.json({
          success: true,
          action: 'complete',
          todo: completedTodo,
          message: `"${completedTodo.title}" marked as complete`
        });
        
      case 'delete':
        const deleteId = args?.todo_id || args?.id;
        if (!deleteId) {
          return res.status(400).json({ error: 'Todo ID is required for delete' });
        }
        
        const { data: deletedTodo, error: deleteError } = await supabase
          .from('todos')
          .delete()
          .eq('id', deleteId)
          .eq('user_id', userId)
          .select('title')
          .single();
        
        if (deleteError) throw deleteError;
        
        if (!deletedTodo) {
          return res.status(404).json({ error: 'Todo not found' });
        }
        
        return res.json({
          success: true,
          action: 'delete',
          message: `"${deletedTodo.title}" deleted successfully`
        });
        
      case 'today': {
        // Get todos due today or overdue
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        const { data: todayTodos, error: todayError } = await supabase
          .from('todos')
          .select(`
            *,
            category:todo_categories(id, name, color, icon)
          `)
          .eq('user_id', userId)
          .neq('status', 'done')
          .lte('due_date', today.toISOString())
          .order('due_date', { ascending: true });
        
        if (todayError) throw todayError;
        
        // Separate overdue and today
        const nowToday = new Date();
        nowToday.setHours(0, 0, 0, 0);
        const overdue = todayTodos?.filter(t => t.due_date && new Date(t.due_date) < nowToday) || [];
        const dueToday = todayTodos?.filter(t => t.due_date && new Date(t.due_date) >= nowToday) || [];
        
        return res.json({
          success: true,
          action: 'today',
          todos: todayTodos || [],
          overdue: overdue,
          due_today: dueToday,
          count: todayTodos?.length || 0,
          message: `You have ${overdue.length} overdue and ${dueToday.length} due today`
        });
      }
        
      case 'upcoming': {
        const days = args?.days || 7;
        const upcomingDate = new Date();
        upcomingDate.setDate(upcomingDate.getDate() + days);
        
        const { data: upcomingTodos, error: upcomingError } = await supabase
          .from('todos')
          .select(`
            *,
            category:todo_categories(id, name, color, icon)
          `)
          .eq('user_id', userId)
          .neq('status', 'done')
          .gte('due_date', new Date().toISOString())
          .lte('due_date', upcomingDate.toISOString())
          .order('due_date', { ascending: true });
        
        if (upcomingError) throw upcomingError;
        
        return res.json({
          success: true,
          action: 'upcoming',
          todos: upcomingTodos || [],
          count: upcomingTodos?.length || 0,
          days: days,
          message: `${upcomingTodos?.length || 0} todos due in the next ${days} days`
        });
      }
        
      case 'overdue': {
        const nowOverdue = new Date();
        
        const { data: overdueTodos, error: overdueError } = await supabase
          .from('todos')
          .select(`
            *,
            category:todo_categories(id, name, color, icon)
          `)
          .eq('user_id', userId)
          .neq('status', 'done')
          .lt('due_date', nowOverdue.toISOString())
          .order('due_date', { ascending: true });
        
        if (overdueError) throw overdueError;
        
        return res.json({
          success: true,
          action: 'overdue',
          todos: overdueTodos || [],
          count: overdueTodos?.length || 0,
          message: `You have ${overdueTodos?.length || 0} overdue todos`
        });
      }
        
      default:
        return res.status(400).json({ error: 'Unknown todo action' });
    }
  } catch (error) {
    console.error('Error handling todo_actions:', error);
    res.status(500).json({ 
      error: 'Todo action failed',
      message: error.message
    });
  }
});

// Category Management Endpoints

// Get all categories for user
app.get('/api/todos/categories', authenticateUser, async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from('todo_categories')
      .select('*')
      .eq('user_id', req.user.id)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      categories: categories || [] 
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create new category
app.post('/api/todos/categories', authenticateUser, async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    const { data: newCategory, error } = await supabase
      .from('todo_categories')
      .insert({
        user_id: req.user.id,
        name,
        color: color || '#6366f1',
        icon: icon || '📝',
        is_default: false
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Category with this name already exists' });
      }
      throw error;
    }
    
    res.json({ 
      success: true, 
      category: newCategory,
      message: `Category "${name}" created successfully`
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
app.put('/api/todos/categories/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, icon } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;
    
    const { data: updatedCategory, error } = await supabase
      .from('todo_categories')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    
    if (error) throw error;
    
    if (!updatedCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ 
      success: true, 
      category: updatedCategory,
      message: 'Category updated successfully'
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category
app.delete('/api/todos/categories/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if it's a default category
    const { data: category } = await supabase
      .from('todo_categories')
      .select('is_default, name')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    if (category.is_default) {
      return res.status(400).json({ error: 'Cannot delete default categories' });
    }
    
    const { error } = await supabase
      .from('todo_categories')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);
    
    if (error) throw error;
    
    res.json({ 
      success: true,
      message: `Category "${category.name}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Get todo statistics
app.get('/api/todos/stats', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get counts by status
    const { data: todos } = await supabase
      .from('todos')
      .select('status, category_id, due_date')
      .eq('user_id', userId);
    
    const stats = {
      total: todos?.length || 0,
      todo: todos?.filter(t => t.status === 'todo').length || 0,
      in_progress: todos?.filter(t => t.status === 'in_progress').length || 0,
      done: todos?.filter(t => t.status === 'done').length || 0,
      overdue: 0,
      due_today: 0
    };
    
    // Calculate overdue and due today
    const now = new Date();
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    todos?.forEach(todo => {
      if (todo.status !== 'done' && todo.due_date) {
        const dueDate = new Date(todo.due_date);
        if (dueDate < now) {
          stats.overdue++;
        } else if (dueDate <= today) {
          stats.due_today++;
        }
      }
    });
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching todo stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Handle learning_actions tool call
app.post('/api/tools/learning_actions', authenticateUser, async (req, res) => {
  try {
    const { action, args, openai_session_id } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }

    const userId = req.user.id;
    
    switch (action) {
      case 'create_topic': {
        // Validate required fields
        if (!args?.title) {
          return res.status(400).json({ error: 'Topic title is required' });
        }
        
        // Create new learning topic
        const { data: newTopic, error: createError } = await supabase
          .from('learning_topics')
          .insert({
            user_id: userId,
            title: args.title,
            description: args.description || null,
            category: args.category || 'General',
            difficulty_level: args.difficulty_level || 'beginner',
            estimated_duration: args.estimated_duration || null,
            status: 'in_progress',
            last_accessed_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (createError) throw createError;
        
        // Create first session
        const sessionId = openai_session_id ? await getSessionId(openai_session_id) : null;
        const { data: firstSession, error: sessionError } = await supabase
          .from('learning_sessions')
          .insert({
            topic_id: newTopic.id,
            user_id: userId,
            realtime_session_id: sessionId,
            session_number: 1,
            title: `Session 1: Introduction to ${args.title}`,
            started_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (sessionError) throw sessionError;
        
        return res.json({
          success: true,
          action: 'create_topic',
          topic: newTopic,
          session: firstSession,
          message: `Great! Let's start learning ${args.title}. I'll help you through this journey.`
        });
      }
      
      case 'continue_topic': {
        const topicId = args?.topic_id;
        if (!topicId) {
          return res.status(400).json({ error: 'topic_id is required' });
        }
        
        // Get topic details
        const { data: topic, error: topicError } = await supabase
          .from('learning_topics')
          .select('*')
          .eq('id', topicId)
          .eq('user_id', userId)
          .single();
        
        if (topicError || !topic) {
          return res.status(404).json({ error: 'Topic not found' });
        }
        
        // Get last session
        const { data: lastSession } = await supabase
          .from('learning_sessions')
          .select('*')
          .eq('topic_id', topicId)
          .order('session_number', { ascending: false })
          .limit(1)
          .single();
        
        // Create new session
        const sessionId = openai_session_id ? await getSessionId(openai_session_id) : null;
        const sessionNumber = (lastSession?.session_number || 0) + 1;
        const { data: newSession, error: sessionError } = await supabase
          .from('learning_sessions')
          .insert({
            topic_id: topicId,
            user_id: userId,
            realtime_session_id: sessionId,
            session_number: sessionNumber,
            title: `Session ${sessionNumber}`,
            started_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (sessionError) throw sessionError;
        
        // Update topic last accessed
        await supabase
          .from('learning_topics')
          .update({ 
            last_accessed_at: new Date().toISOString(),
            status: 'in_progress'
          })
          .eq('id', topicId);
        
        return res.json({
          success: true,
          action: 'continue_topic',
          topic: topic,
          session: newSession,
          context: {
            last_session_summary: topic.last_session_summary,
            next_steps: topic.next_steps,
            key_concepts_learned: topic.key_concepts_learned,
            current_section: topic.current_section,
            progress_percentage: topic.progress_percentage,
            total_sessions: topic.total_sessions,
            last_session: lastSession
          },
          message: `Welcome back to ${topic.title}! Let's continue from where we left off.`
        });
      }
      
      case 'get_context': {
        const topicId = args?.topic_id;
        if (!topicId) {
          return res.status(400).json({ error: 'topic_id is required' });
        }
        
        // Get topic with all sessions
        const { data: topic } = await supabase
          .from('learning_topics')
          .select('*')
          .eq('id', topicId)
          .eq('user_id', userId)
          .single();
        
        if (!topic) {
          return res.status(404).json({ error: 'Topic not found' });
        }
        
        // Get all sessions
        const { data: sessions } = await supabase
          .from('learning_sessions')
          .select('*')
          .eq('topic_id', topicId)
          .order('session_number', { ascending: true });
        
        // Get recent progress points
        const { data: progressPoints } = await supabase
          .from('learning_progress_points')
          .select('*')
          .eq('topic_id', topicId)
          .order('created_at', { ascending: false })
          .limit(50);
        
        return res.json({
          success: true,
          action: 'get_context',
          topic: topic,
          sessions: sessions || [],
          progress_points: progressPoints || [],
          context_summary: {
            title: topic.title,
            status: topic.status,
            progress: topic.progress_percentage,
            total_sessions: topic.total_sessions,
            total_time: topic.total_duration_minutes,
            last_session_summary: topic.last_session_summary,
            next_steps: topic.next_steps,
            key_concepts: topic.key_concepts_learned,
            current_section: topic.current_section
          }
        });
      }
      
      case 'save_progress': {
        const topicId = args?.topic_id;
        if (!topicId) {
          return res.status(400).json({ error: 'topic_id is required' });
        }
        
        // Update topic with progress
        const updateData = {
          updated_at: new Date().toISOString()
        };
        
        if (args.summary) updateData.last_session_summary = args.summary;
        if (args.next_steps) updateData.next_steps = args.next_steps;
        if (args.current_section) updateData.current_section = args.current_section;
        if (args.progress_percentage !== undefined) updateData.progress_percentage = args.progress_percentage;
        
        // Update key concepts (merge with existing)
        if (args.concepts_covered && args.concepts_covered.length > 0) {
          const { data: currentTopic } = await supabase
            .from('learning_topics')
            .select('key_concepts_learned')
            .eq('id', topicId)
            .single();
          
          const existingConcepts = currentTopic?.key_concepts_learned || [];
          const newConcepts = args.concepts_covered.filter(c => !existingConcepts.includes(c));
          updateData.key_concepts_learned = [...existingConcepts, ...newConcepts];
        }
        
        const { data: updatedTopic, error: updateError } = await supabase
          .from('learning_topics')
          .update(updateData)
          .eq('id', topicId)
          .eq('user_id', userId)
          .select()
          .single();
        
        if (updateError) throw updateError;
        
        // Update current session if session_id provided or find latest
        let sessionToUpdate = args.session_id;
        if (!sessionToUpdate) {
          const { data: latestSession } = await supabase
            .from('learning_sessions')
            .select('id')
            .eq('topic_id', topicId)
            .eq('user_id', userId)
            .order('session_number', { ascending: false })
            .limit(1)
            .single();
          sessionToUpdate = latestSession?.id;
        }
        
        if (sessionToUpdate) {
          const sessionUpdateData = {
            ended_at: new Date().toISOString()
          };
          
          if (args.concepts_covered) sessionUpdateData.concepts_covered = args.concepts_covered;
          if (args.summary) sessionUpdateData.conversation_summary = args.summary;
          if (args.user_understanding) sessionUpdateData.user_understanding_level = args.user_understanding;
          if (args.exercises_completed) sessionUpdateData.exercises_completed = args.exercises_completed;
          if (args.questions_asked) sessionUpdateData.questions_asked = args.questions_asked;
          
          // Calculate duration
          const { data: session } = await supabase
            .from('learning_sessions')
            .select('started_at')
            .eq('id', sessionToUpdate)
            .single();
          
          if (session?.started_at) {
            const duration = Math.round((new Date() - new Date(session.started_at)) / 60000);
            sessionUpdateData.duration_minutes = duration;
          }
          
          await supabase
            .from('learning_sessions')
            .update(sessionUpdateData)
            .eq('id', sessionToUpdate);
        }
        
        // Save progress points if provided
        if (args.progress_points && args.progress_points.length > 0) {
          const points = args.progress_points.map(point => ({
            topic_id: topicId,
            session_id: sessionToUpdate,
            user_id: userId,
            point_type: point.type || 'concept',
            content: point.content,
            timestamp_in_session: point.timestamp || 0,
            metadata: point.metadata || {}
          }));
          
          await supabase
            .from('learning_progress_points')
            .insert(points);
        }
        
        return res.json({
          success: true,
          action: 'save_progress',
          topic: updatedTopic,
          message: 'Progress saved successfully! Great work today.'
        });
      }
      
      case 'list_topics': {
        let query = supabase
          .from('learning_topics')
          .select('*')
          .eq('user_id', userId)
          .order('last_accessed_at', { ascending: false, nullsFirst: false });
        
        if (args?.status) {
          query = query.eq('status', args.status);
        }
        
        if (args?.category) {
          query = query.eq('category', args.category);
        }
        
        const { data: topics, error: listError } = await query;
        
        if (listError) throw listError;
        
        // Format topics for LLM with relevant information for matching
        const formattedTopics = topics?.map(topic => ({
          id: topic.id,
          title: topic.title,
          description: topic.description,
          category: topic.category,
          status: topic.status,
          difficulty_level: topic.difficulty_level,
          progress_percentage: topic.progress_percentage,
          total_sessions: topic.total_sessions,
          total_duration_minutes: topic.total_duration_minutes,
          last_session_summary: topic.last_session_summary,
          next_steps: topic.next_steps,
          last_accessed_at: topic.last_accessed_at,
          created_at: topic.created_at
        })) || [];
        
        return res.json({
          success: true,
          action: 'list_topics',
          topics: formattedTopics,
          count: formattedTopics.length,
          message: formattedTopics.length === 0 
            ? 'No learning topics found. User can start a new one!'
            : `Found ${formattedTopics.length} learning topic(s). Analyze these to see if any match what the user wants to learn.`
        });
      }
      
      case 'complete_topic': {
        const topicId = args?.topic_id;
        if (!topicId) {
          return res.status(400).json({ error: 'topic_id is required' });
        }
        
        const { data: completedTopic, error: completeError } = await supabase
          .from('learning_topics')
          .update({
            status: 'completed',
            progress_percentage: 100,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', topicId)
          .eq('user_id', userId)
          .select()
          .single();
        
        if (completeError) throw completeError;
        
        if (!completedTopic) {
          return res.status(404).json({ error: 'Topic not found' });
        }
        
        return res.json({
          success: true,
          action: 'complete_topic',
          topic: completedTopic,
          message: `Congratulations! You've completed ${completedTopic.title}! 🎉`
        });
      }
      
      case 'update_topic': {
        const topicId = args?.topic_id;
        if (!topicId) {
          return res.status(400).json({ error: 'topic_id is required' });
        }
        
        const updateData = { updated_at: new Date().toISOString() };
        
        if (args.title !== undefined) updateData.title = args.title;
        if (args.description !== undefined) updateData.description = args.description;
        if (args.status !== undefined) updateData.status = args.status;
        if (args.progress_percentage !== undefined) updateData.progress_percentage = args.progress_percentage;
        if (args.current_section !== undefined) updateData.current_section = args.current_section;
        if (args.category !== undefined) updateData.category = args.category;
        if (args.difficulty_level !== undefined) updateData.difficulty_level = args.difficulty_level;
        
        const { data: updatedTopic, error: updateError } = await supabase
          .from('learning_topics')
          .update(updateData)
          .eq('id', topicId)
          .eq('user_id', userId)
          .select()
          .single();
        
        if (updateError) throw updateError;
        
        if (!updatedTopic) {
          return res.status(404).json({ error: 'Topic not found' });
        }
        
        return res.json({
          success: true,
          action: 'update_topic',
          topic: updatedTopic,
          message: 'Topic updated successfully'
        });
      }
      
      default:
        return res.status(400).json({ error: 'Unknown learning action' });
    }
  } catch (error) {
    console.error('Error handling learning_actions:', error);
    res.status(500).json({ 
      error: 'Learning action failed',
      message: error.message
    });
  }
});

// Handle other tool actions (relax, etc.)
app.post('/api/tools/:toolName', optionalAuth, async (req, res) => {
  try {
    const { toolName } = req.params;
    const { action, args } = req.body;
    
    // For now, implement basic responses for non-implemented tools
    switch (toolName) {
      case 'relax_actions':
        res.json({
          success: true,
          action,
          message: `Relax ${action} action received`,
          data: args
        });
        break;
        
      default:
        return res.status(404).json({ error: 'Unknown tool' });
    }
  } catch (error) {
    console.error(`Error handling ${req.params.toolName}:`, error);
    res.status(500).json({ 
      error: 'Tool action failed',
      message: error.message
    });
  }
});

// Learning REST API Endpoints

// Get all learning topics for user
app.get('/api/learning/topics', authenticateUser, async (req, res) => {
  try {
    const { status, category, limit, offset } = req.query;
    
    let query = supabase
      .from('learning_topics')
      .select('*')
      .eq('user_id', req.user.id)
      .order('last_accessed_at', { ascending: false, nullsFirst: false });
    
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (limit) query = query.limit(parseInt(limit));
    if (offset) query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit || 10) - 1);
    
    const { data: topics, error } = await query;
    
    if (error) throw error;
    
    res.json({
      success: true,
      topics: topics || []
    });
  } catch (error) {
    console.error('Error fetching learning topics:', error);
    res.status(500).json({ error: 'Failed to fetch learning topics' });
  }
});

// Create new learning topic
app.post('/api/learning/topics', authenticateUser, async (req, res) => {
  try {
    const { title, description, category, difficulty_level, estimated_duration } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const { data: newTopic, error } = await supabase
      .from('learning_topics')
      .insert({
        user_id: req.user.id,
        title,
        description: description || null,
        category: category || 'General',
        difficulty_level: difficulty_level || 'beginner',
        estimated_duration: estimated_duration || null,
        status: 'not_started',
        last_accessed_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      topic: newTopic,
      message: 'Learning topic created successfully'
    });
  } catch (error) {
    console.error('Error creating learning topic:', error);
    res.status(500).json({ error: 'Failed to create learning topic' });
  }
});

// Get specific topic with details
app.get('/api/learning/topics/:topicId', authenticateUser, async (req, res) => {
  try {
    const { topicId } = req.params;
    
    // Get topic
    const { data: topic, error: topicError } = await supabase
      .from('learning_topics')
      .select('*')
      .eq('id', topicId)
      .eq('user_id', req.user.id)
      .single();
    
    if (topicError || !topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    
    // Get sessions for this topic
    const { data: sessions, error: sessionsError } = await supabase
      .from('learning_sessions')
      .select('*')
      .eq('topic_id', topicId)
      .order('session_number', { ascending: false });
    
    if (sessionsError) throw sessionsError;
    
    res.json({
      success: true,
      topic,
      sessions: sessions || []
    });
  } catch (error) {
    console.error('Error fetching topic details:', error);
    res.status(500).json({ error: 'Failed to fetch topic details' });
  }
});

// Update learning topic
app.patch('/api/learning/topics/:topicId', authenticateUser, async (req, res) => {
  try {
    const { topicId } = req.params;
    const { title, description, status, progress_percentage, current_section, category, difficulty_level } = req.body;
    
    const updateData = { updated_at: new Date().toISOString() };
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (progress_percentage !== undefined) updateData.progress_percentage = progress_percentage;
    if (current_section !== undefined) updateData.current_section = current_section;
    if (category !== undefined) updateData.category = category;
    if (difficulty_level !== undefined) updateData.difficulty_level = difficulty_level;
    
    const { data: updatedTopic, error } = await supabase
      .from('learning_topics')
      .update(updateData)
      .eq('id', topicId)
      .eq('user_id', req.user.id)
      .select()
      .single();
    
    if (error) throw error;
    
    if (!updatedTopic) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    
    res.json({
      success: true,
      topic: updatedTopic,
      message: 'Topic updated successfully'
    });
  } catch (error) {
    console.error('Error updating topic:', error);
    res.status(500).json({ error: 'Failed to update topic' });
  }
});

// Delete learning topic
app.delete('/api/learning/topics/:topicId', authenticateUser, async (req, res) => {
  try {
    const { topicId } = req.params;
    
    const { data: deletedTopic, error } = await supabase
      .from('learning_topics')
      .delete()
      .eq('id', topicId)
      .eq('user_id', req.user.id)
      .select('title')
      .single();
    
    if (error) throw error;
    
    if (!deletedTopic) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    
    res.json({
      success: true,
      message: `Topic "${deletedTopic.title}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting topic:', error);
    res.status(500).json({ error: 'Failed to delete topic' });
  }
});

// Get learning statistics
app.get('/api/learning/stats', authenticateUser, async (req, res) => {
  try {
    const { data: topics } = await supabase
      .from('learning_topics')
      .select('status, category, total_duration_minutes')
      .eq('user_id', req.user.id);
    
    const stats = {
      total_topics: topics?.length || 0,
      not_started: topics?.filter(t => t.status === 'not_started').length || 0,
      in_progress: topics?.filter(t => t.status === 'in_progress').length || 0,
      completed: topics?.filter(t => t.status === 'completed').length || 0,
      paused: topics?.filter(t => t.status === 'paused').length || 0,
      total_learning_time: topics?.reduce((sum, t) => sum + (t.total_duration_minutes || 0), 0) || 0
    };
    
    // Group by category
    const byCategory = {};
    topics?.forEach(topic => {
      const cat = topic.category || 'General';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });
    stats.by_category = byCategory;
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching learning stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get sessions for a topic
app.get('/api/learning/topics/:topicId/sessions', authenticateUser, async (req, res) => {
  try {
    const { topicId } = req.params;
    const { limit, offset } = req.query;
    
    // Verify topic belongs to user
    const { data: topic } = await supabase
      .from('learning_topics')
      .select('id')
      .eq('id', topicId)
      .eq('user_id', req.user.id)
      .single();
    
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    
    let query = supabase
      .from('learning_sessions')
      .select('*')
      .eq('topic_id', topicId)
      .order('session_number', { ascending: false });
    
    if (limit) query = query.limit(parseInt(limit));
    if (offset) query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit || 10) - 1);
    
    const { data: sessions, error } = await query;
    
    if (error) throw error;
    
    res.json({
      success: true,
      sessions: sessions || []
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Authentication Endpoints

// Sign up endpoint
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || email.split('@')[0]
        }
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      user: data.user,
      message: 'User created successfully. Please check your email for verification.'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign in endpoint
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      user: data.user,
      session: data.session,
      access_token: data.session.access_token
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign out endpoint
app.post('/api/auth/signout', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Signed out successfully' });
  } catch (error) {
    console.error('Signout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
app.get('/api/auth/profile', authenticateUser, (req, res) => {
  res.json({ user: req.user });
});

// Google OAuth Endpoints

// Helper function to check if account has required scopes
const hasRequiredScopes = (accountScopes) => {
  const requiredScopes = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send',
    'https://mail.google.com/'
  ];
  
  return requiredScopes.every(scope => 
    accountScopes && accountScopes.includes(scope)
  );
};

// Get all connected Google accounts for authenticated user
app.get('/api/google/accounts', authenticateUser, async (req, res) => {
  try {
    const { data: accounts, error } = await supabase
      .from('google_accounts')
      .select('id, email, name, picture, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching Google accounts:', error);
      return res.status(500).json({ error: 'Failed to fetch Google accounts' });
    }

    const formattedAccounts = accounts.map(account => ({
      id: account.id,
      email: account.email,
      name: account.name,
      picture: account.picture,
      connectedAt: account.created_at,
      hasRequiredScopes: hasRequiredScopes(account.scopes),
      needsReauth: !hasRequiredScopes(account.scopes)
    }));

    res.json({ accounts: formattedAccounts });
  } catch (error) {
    console.error('Error fetching Google accounts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initiate Google OAuth flow
app.get('/api/google/auth', authenticateUser, (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://mail.google.com/',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force consent screen to get refresh token
    state: req.user.id, // Pass user ID in state parameter
    include_granted_scopes: true // Include previously granted scopes
  });

  res.json({ authUrl });
});

// Handle Google OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send('Authorization code not provided');
  }

  if (!state) {
    return res.status(400).send('State parameter missing');
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Store account information in Supabase
    const { data: existingAccount } = await supabase
      .from('google_accounts')
      .select('id')
      .eq('user_id', state)
      .eq('google_user_id', userInfo.data.id)
      .single();

    let accountData;
    if (existingAccount) {
      // Update existing account
      const { data, error } = await supabase
        .from('google_accounts')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          name: userInfo.data.name,
          picture: userInfo.data.picture,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAccount.id)
        .select()
        .single();

      if (error) {
        throw error;
      }
      accountData = data;
    } else {
      // Create new account
      const { data, error } = await supabase
        .from('google_accounts')
        .insert({
          user_id: state,
          google_user_id: userInfo.data.id,
          email: userInfo.data.email,
          name: userInfo.data.name,
          picture: userInfo.data.picture,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          scopes: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/gmail.compose',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://mail.google.com/',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/calendar.events'
          ]
        })
        .select()
        .single();

      if (error) {
        throw error;
      }
      accountData = data;
    }

    console.log(`Google account connected: ${userInfo.data.email} for user: ${state}`);

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    
    res.redirect(`${frontendUrl}/settings?connected=true&email=${encodeURIComponent(userInfo.data.email)}`);
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    
    res.redirect(`${frontendUrl}/settings?error=auth_failed`);
  }
});

// Disconnect a Google account
app.delete('/api/google/accounts/:accountId', authenticateUser, async (req, res) => {
  const { accountId } = req.params;
  
  try {
    // Get account from database
    const { data: account, error: fetchError } = await supabase
      .from('google_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Revoke the tokens
    if (account.access_token) {
      try {
        const revokeClient = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
        revokeClient.setCredentials({
          access_token: account.access_token,
          refresh_token: account.refresh_token
        });
        await revokeClient.revokeCredentials();
      } catch (revokeError) {
        console.error('Error revoking Google tokens:', revokeError);
        // Continue with deletion even if revoke fails
      }
    }
    
    // Delete from database
    const { error: deleteError } = await supabase
      .from('google_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', req.user.id);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`Google account disconnected: ${account.email} for user: ${req.user.id}`);
    
    res.json({ success: true, message: 'Account disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting Google account:', error);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

// Test Google API access for an account
app.get('/api/google/accounts/:accountId/test', authenticateUser, async (req, res) => {
  const { accountId } = req.params;
  
  try {
    // Get account from database
    const { data: account, error: fetchError } = await supabase
      .from('google_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Create OAuth client for this account
    const accountOAuth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    accountOAuth.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token
    });

    // Test Gmail access
    const gmail = google.gmail({ version: 'v1', auth: accountOAuth });
    const gmailProfile = await gmail.users.getProfile({ userId: 'me' });

    // Test Calendar access
    const calendar = google.calendar({ version: 'v3', auth: accountOAuth });
    const calendarList = await calendar.calendarList.list();

    res.json({
      success: true,
      email: account.email,
      gmail: {
        emailAddress: gmailProfile.data.emailAddress,
        messagesTotal: gmailProfile.data.messagesTotal,
        threadsTotal: gmailProfile.data.threadsTotal
      },
      calendar: {
        calendarsCount: calendarList.data.items?.length || 0,
        calendars: calendarList.data.items?.map(cal => ({
          id: cal.id,
          summary: cal.summary,
          primary: cal.primary
        })) || []
      }
    });
  } catch (error) {
    console.error('Error testing Google API access:', error);
    res.status(500).json({ 
      error: 'Failed to access Google APIs',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API endpoint to check configuration
app.get('/api/check-config', optionalAuth, async (req, res) => {
  try {
    let connectedGoogleAccounts = 0;
    
    if (req.user) {
      const { count } = await supabase
        .from('google_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id);
      
      connectedGoogleAccounts = count || 0;
    }

    res.json({ 
      hasApiKey: !!process.env.OPENAI_API_KEY,
      hasGoogleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      hasSupabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      environment: process.env.NODE_ENV || 'development',
      connectedGoogleAccounts,
      isAuthenticated: !!req.user
    });
  } catch (error) {
    console.error('Error checking configuration:', error);
    res.json({ 
      hasApiKey: !!process.env.OPENAI_API_KEY,
      hasGoogleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      hasSupabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      environment: process.env.NODE_ENV || 'development',
      connectedGoogleAccounts: 0,
      isAuthenticated: false
    });
  }
});

server.listen(port, () => {
  console.log(`Personal Assistant Backend running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`OpenAI API Key configured: ${!!process.env.OPENAI_API_KEY}`);
  console.log(`Google OAuth configured: ${!!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}`);
  console.log(`Supabase configured: ${!!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)}`);
});
