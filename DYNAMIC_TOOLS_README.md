# Dynamic Tool Registration System

This document explains the dynamic tool registration (capability gating) system implemented for the Personal Assistant.

## Overview

The system dynamically loads tools based on the user's context and current mode, keeping the tool set small and relevant. Instead of giving the AI all 25+ tools at once, we start with just 2 meta tools and progressively load domain-specific tools as needed.

## Architecture

### 1. Tool Definitions (`backend/server.js`)

Tools are organized into categories:
- **Meta tools**: Always available (`set_mode`, `select_account`)
- **Domain tools**: Loaded based on mode (`email_actions`, `calendar_actions`, etc.)

### 2. Session Management

The `realtime_sessions` table now tracks:
- `current_mode`: Current domain (email, calendar, todo, learning, relax)
- `selected_account_email`: Currently selected Google account
- `active_tools`: Array of currently loaded tool names

### 3. Dynamic Loading Flow

```
Session Start → Meta Tools Only (2 tools)
     ↓
User: "Check my email"
     ↓
AI calls set_mode("email")
     ↓
Backend updates OpenAI session with email tools
     ↓
AI now has email_actions tool available
```

## API Endpoints

### Session Creation
- `POST /api/realtime/session` - Creates session with initial meta tools

### Tool Management
- `POST /api/realtime/update-tools` - Updates active tools for a session

### Tool Execution
- `POST /api/tools/set_mode` - Switch domains
- `POST /api/tools/select_account` - Select Google account
- `POST /api/tools/email_actions` - Email operations
- `POST /api/tools/calendar_actions` - Calendar operations
- `POST /api/tools/:toolName` - Generic tool handler

## Frontend Integration

### Data Channel Handling (`useAudioService.js`)

```javascript
case 'response.tool_call':
  // Forward to backend
  const result = await fetch(`/api/tools/${toolCall.name}`, {
    method: 'POST',
    body: JSON.stringify({
      ...toolCall.arguments,
      openai_session_id: currentSession?.id
    })
  })
  
  // Send result back to OpenAI
  dataChannel.send(JSON.stringify({
    type: 'response.tool_call.result',
    tool_call_id: toolCall.id,
    result: JSON.stringify(result)
  }))
```

## Account-Aware Filtering

Tools are filtered based on:
1. **Connected Accounts**: Only show email/calendar tools if user has Google accounts
2. **Selected Account**: Route operations to the currently selected account
3. **Mode Context**: Only load relevant tools for current domain

## Usage Examples

### Email Flow
```
User: "Check my email"
→ AI calls set_mode("email") 
→ Backend loads email_actions tool
→ User: "Show me emails from John"
→ AI calls email_actions("search", {query: "from:john"})
→ Backend searches Gmail and returns results
```

### Account Selection
```
User: "Use my work email"
→ AI calls select_account("work@company.com")
→ Backend verifies account access and updates session
→ Future email operations use work@company.com
```

## Benefits

1. **Performance**: Smaller tool set (2-6 tools vs 25+)
2. **Context Relevance**: Only relevant tools available
3. **Security**: Account verification before tool access
4. **Flexibility**: Easy to add new domains and tools
5. **User Experience**: Cleaner, more focused interactions

## Database Changes

```sql
-- Added to realtime_sessions table:
current_mode TEXT CHECK (current_mode IN ('email', 'calendar', 'todo', 'learning', 'relax')),
selected_account_email TEXT,
active_tools TEXT[] DEFAULT ARRAY[]::TEXT[]
```

Run the updated `supabase-schema.sql` to apply these changes to your database.
