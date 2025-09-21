# Google OAuth Setup Guide

This guide will help you set up Google OAuth integration for the Personal Assistant app to enable email and calendar access.

## Prerequisites

1. A Google Cloud Platform (GCP) account
2. Access to Google Cloud Console

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note down your project ID

## Step 2: Enable Required APIs

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for and enable the following APIs:
   - **Gmail API**
   - **Google Calendar API**
   - **Google+ API** (for user profile information)

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" user type
   - Fill in the required fields:
     - App name: "Personal Assistant"
     - User support email: Your email
     - Developer contact information: Your email
   - Add scopes:
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/calendar.events`
4. Create OAuth 2.0 Client ID:
   - Application type: "Web application"
   - Name: "Personal Assistant Web Client"
   - Authorized redirect URIs:
     - `http://localhost:3001/auth/google/callback` (for development)
     - Add your production URL if deploying: `https://yourdomain.com/auth/google/callback`

## Step 4: Configure Environment Variables

1. Copy the `.env.example` file to `.env` in the backend directory:
   ```bash
   cp backend/env.example backend/.env
   ```

2. Edit the `.env` file and add your Google OAuth credentials:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3001
   NODE_ENV=development
   
   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
   ```

3. Replace `your_google_client_id_here` and `your_google_client_secret_here` with the values from Step 3.

## Step 5: Test the Integration

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend development server:
   ```bash
   cd frontend
   npm run serve
   ```

3. Open the app in your browser and navigate to Settings
4. Click "Add Account" to test the Google OAuth flow
5. Grant the required permissions
6. Verify the account appears in the connected accounts list
7. Click "Test" to verify API access is working

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" error**:
   - Make sure the redirect URI in your Google Cloud Console matches exactly with the one in your `.env` file
   - Check for trailing slashes and HTTP vs HTTPS

2. **"access_denied" error**:
   - Make sure all required scopes are added to your OAuth consent screen
   - Check if your app is in testing mode and the user is added as a test user

3. **"invalid_client" error**:
   - Verify your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
   - Make sure there are no extra spaces in your environment variables

4. **API access errors**:
   - Ensure Gmail API and Calendar API are enabled in Google Cloud Console
   - Check if the user has granted all required permissions

### Testing in Production

When deploying to production:

1. Update the `GOOGLE_REDIRECT_URI` in your `.env` file to use your production domain
2. Add the production redirect URI to your Google Cloud Console OAuth client
3. Update the `frontendUrl` in the backend code if necessary
4. Consider moving from "Testing" to "Published" status in the OAuth consent screen

## Security Notes

- Keep your `GOOGLE_CLIENT_SECRET` secure and never expose it in client-side code
- In production, use environment variables or a secure secret management system
- Consider implementing token refresh logic for long-running applications
- The current implementation stores tokens in memory - for production, use a secure database

## API Capabilities

Once connected, each Google account provides access to:

### Gmail API
- Read email messages and threads
- Send emails on behalf of the user
- Access to email metadata and content

### Calendar API
- Read calendar events
- Create, update, and delete events
- Access to multiple calendars
- Manage calendar sharing and permissions

These capabilities can be used by your Personal Assistant to:
- Read and summarize emails
- Schedule meetings and appointments
- Send emails on your behalf
- Manage your calendar
- Provide intelligent notifications and reminders
