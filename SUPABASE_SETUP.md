# Supabase Setup Guide

This guide will help you set up Supabase for the Personal Assistant app with user authentication and Google account storage.

## Prerequisites

1. A Supabase account (sign up at [supabase.com](https://supabase.com))
2. Basic understanding of SQL and database concepts

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in the project details:
   - **Name**: "Personal Assistant"
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Select the region closest to your users
4. Click "Create new project"
5. Wait for the project to be created (this may take a few minutes)

## Step 2: Get Your Project Credentials

Once your project is created, you'll need these credentials:

1. Go to **Settings** > **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://your-project-id.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
   - **service_role secret key** (starts with `eyJ...`) - ⚠️ **Keep this secret!**

## Step 3: Set Up the Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Create a new query and paste the contents of `supabase-schema.sql`
3. Click "Run" to execute the schema (JWT secret is managed automatically by Supabase)

The schema creates:
- **user_profiles** table: Extended user information
- **google_accounts** table: Google OAuth tokens and account data
- **Row Level Security (RLS)** policies: Users can only access their own data
- **Triggers**: Automatic profile creation and timestamp updates

## Step 4: Configure Environment Variables

1. Create/update your `.env` file in the backend directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
NODE_ENV=development

# Frontend Configuration
FRONTEND_URL=http://localhost:8080

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_public_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret_key_here
JWT_SECRET=any-secure-random-string-for-your-app
```

2. Replace the placeholder values with your actual credentials from Step 2

## Step 5: Configure Authentication Settings

1. Go to **Authentication** > **Settings** in your Supabase dashboard
2. **Site URL**: Set to `http://localhost:8080` (or your frontend URL)
3. **Redirect URLs**: Add your frontend URL for OAuth redirects
4. **Email Settings**: Configure if you want email verification (optional for development)

### Email Authentication Settings (Optional)

If you want email verification:
1. Go to **Authentication** > **Settings** > **Email**
2. Enable "Enable email confirmations"
3. Configure SMTP settings or use Supabase's built-in email service

## Step 6: Set Up Row Level Security Policies

The schema file already includes RLS policies, but you can verify they're working:

1. Go to **Authentication** > **Policies**
2. You should see policies for:
   - `user_profiles`: Users can view/update their own profile
   - `google_accounts`: Users can manage their own Google accounts

## Step 7: Test the Database Connection

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Start the backend server:
   ```bash
   npm run dev
   ```

3. Check the logs - you should see:
   ```
   Supabase configured: true
   ```

4. Test the configuration endpoint:
   ```bash
   curl http://localhost:3001/api/check-config
   ```

   You should get a response with `"hasSupabase": true`

## Step 8: Test User Registration

1. Start both backend and frontend:
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend  
   cd frontend && npm run serve
   ```

2. Open http://localhost:8080
3. You should be redirected to `/auth`
4. Try creating a new account
5. Check your Supabase dashboard under **Authentication** > **Users** to see the new user

## Step 9: Verify Google OAuth Integration

1. Make sure you've completed the Google OAuth setup (see `GOOGLE_OAUTH_SETUP.md`)
2. Sign in to your app
3. Go to Settings and try connecting a Google account
4. Check your Supabase dashboard under **Table Editor** > **google_accounts** to see the stored tokens

## Database Schema Overview

### Tables Created

1. **user_profiles**
   - Extends Supabase auth.users with additional profile information
   - Automatically created when a user signs up
   - Includes: id, email, full_name, avatar_url, timestamps

2. **google_accounts**
   - Stores Google OAuth tokens and account information
   - Linked to users via user_id foreign key
   - Includes: OAuth tokens, user info, scopes, timestamps
   - Supports multiple Google accounts per user

### Security Features

- **Row Level Security (RLS)**: Enabled on all tables
- **User Isolation**: Users can only access their own data
- **Secure Token Storage**: Google tokens are stored securely with proper access controls
- **Automatic Cleanup**: Cascading deletes when users are removed

## Troubleshooting

### Common Issues

1. **"Invalid JWT" errors**:
   - Check that your `JWT_SECRET` is set in your `.env` file (used for your app's internal JWT handling)
   - Supabase manages its own JWT secrets automatically

2. **"Row Level Security" errors**:
   - Verify RLS policies are created correctly
   - Check that the user is properly authenticated before making requests

3. **Connection errors**:
   - Verify your `SUPABASE_URL` and keys are correct
   - Check that your Supabase project is active and not paused

4. **Schema errors**:
   - Make sure you ran the complete schema file
   - Check for any SQL errors in the Supabase SQL Editor

### Useful SQL Queries for Debugging

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- View all policies
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Check user profiles
SELECT * FROM user_profiles;

-- Check Google accounts (as admin)
SELECT id, user_id, email, name, created_at 
FROM google_accounts;
```

## Production Considerations

When deploying to production:

1. **Environment Variables**: Use secure environment variable management
2. **JWT Secret**: Use a cryptographically secure random string
3. **Database Backups**: Enable automatic backups in Supabase
4. **Monitoring**: Set up monitoring and alerts
5. **Rate Limiting**: Configure appropriate rate limits
6. **CORS Settings**: Update CORS settings for your production domain

## Security Best Practices

1. **Never expose service role keys** in client-side code
2. **Use anon keys only** for client-side Supabase calls
3. **Keep JWT secrets secure** and rotate them periodically
4. **Monitor authentication logs** for suspicious activity
5. **Regular security updates** for all dependencies

## Support

- **Supabase Documentation**: [docs.supabase.com](https://docs.supabase.com)
- **Community Support**: [github.com/supabase/supabase/discussions](https://github.com/supabase/supabase/discussions)
- **Discord**: [discord.supabase.com](https://discord.supabase.com)
