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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(limiter);
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : [
        'http://localhost:8080', 
        'https://localhost:8080',
        'http://192.168.1.13:8080', 
        'https://192.168.1.13:8080',
        'http://localhost:3000'
      ],
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
app.post('/api/realtime/session', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured' 
      });
    }

    console.log('Creating ephemeral token for OpenAI Realtime API...');
    
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: 'verse'
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

    const data = await response.json();
    console.log('Successfully created ephemeral token');
    
    res.json(data);
  } catch (error) {
    console.error('Error creating OpenAI session:', error);
    res.status(500).json({ 
      error: 'Internal server error',
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
