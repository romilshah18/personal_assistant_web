const jwt = require('jsonwebtoken');
const { supabase } = require('./supabase');

// Middleware to verify JWT token and get user info
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token with Supabase
    const { data: user, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile from our custom table
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return res.status(500).json({ error: 'Error fetching user profile' });
    }

    // Add user info to request object
    req.user = {
      id: user.user.id,
      email: user.user.email,
      profile: profile
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    const { data: user, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      req.user = null;
      return next();
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.user.id)
      .single();

    req.user = {
      id: user.user.id,
      email: user.user.email,
      profile: profile
    };

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = {
  authenticateUser,
  optionalAuth
};
