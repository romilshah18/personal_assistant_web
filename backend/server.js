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
      description: "Manage emails (search, get content, draft, send). Use this for all email-related operations.",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["search", "get", "draft", "send", "summary"],
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
      description: "Manage todo items and tasks. Use this for task management operations.",
      parameters: {
        type: "object", 
        properties: {
          action: { 
            type: "string", 
            enum: ["list", "create", "update", "delete", "complete"],
            description: "The todo action to perform"
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
  
  learning: {
    learning_actions: {
      type: "function",
      name: "learning_actions",
      description: "Educational and learning tools (research, summarize, explain). Use this for learning-related operations.",
      parameters: {
        type: "object",
        properties: {
          action: { 
            type: "string", 
            enum: ["research", "summarize", "explain", "quiz"],
            description: "The learning action to perform"
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
          'https://personal-assistant-web.vercel.app'
        ]
      : [
          'http://localhost:8080', 
          'https://localhost:8080',
          'http://192.168.1.13:8080', 
          'https://192.168.1.13:8080',
          'http://localhost:3000'
        ];

    // Check if origin is in allowed list or matches Vercel pattern
    const isAllowed = allowedOrigins.includes(origin) || 
                     (process.env.NODE_ENV === 'production' && /https:\/\/.*\.vercel\.app$/.test(origin));
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
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
        if (!args?.messageId) {
          return res.status(400).json({ error: 'Message ID required for get action' });
        }
        
        const getMessage = await gmail.users.messages.get({
          userId: 'me',
          id: args.messageId
        });
        
        res.json({
          success: true,
          action: 'get',
          message: getMessage.data
        });
        break;
        
      case 'draft':
        // Create email draft
        const draftData = {
          message: {
            raw: Buffer.from(
              `To: ${args?.to || ''}\r\n` +
              `Subject: ${args?.subject || ''}\r\n\r\n` +
              `${args?.body || ''}`
            ).toString('base64')
          }
        };
        
        const draft = await gmail.users.drafts.create({
          userId: 'me',
          resource: draftData
        });
        
        res.json({
          success: true,
          action: 'draft',
          draft: draft.data
        });
        break;
        
      case 'send':
        // Send email
        const sendData = {
          raw: Buffer.from(
            `To: ${args?.to || ''}\r\n` +
            `Subject: ${args?.subject || ''}\r\n\r\n` +
            `${args?.body || ''}`
          ).toString('base64')
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

// Handle other tool actions (todo, learning, relax)
app.post('/api/tools/:toolName', optionalAuth, async (req, res) => {
  try {
    const { toolName } = req.params;
    const { action, args } = req.body;
    
    // For now, implement basic responses for non-Google tools
    switch (toolName) {
      case 'todo_actions':
        res.json({
          success: true,
          action,
          message: `Todo ${action} action received`,
          data: args
        });
        break;
        
      case 'learning_actions':
        res.json({
          success: true,
          action,
          message: `Learning ${action} action received`,
          data: args
        });
        break;
        
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
      connectedAt: account.created_at
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
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force consent screen to get refresh token
    state: req.user.id // Pass user ID in state parameter
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
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
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
