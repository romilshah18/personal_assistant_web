# Email Actions Guide for AI Assistant

This guide explains how the AI assistant should use the email_actions tool to handle all email-related queries from users.

## Overview

The `email_actions` tool provides comprehensive Gmail integration with 9 different actions for managing emails and drafts. The AI should use this tool whenever users ask about emails, want to search for emails, create drafts, send emails, or manage their inbox.

## Available Actions

### 1. Search Emails (`search`)
**When to use:** When users want to find specific emails
**Required parameters:** None (uses default query "in:inbox")
**Optional parameters:** 
- `query` (string): Gmail search query
- `maxResults` (integer): Number of results to return (max 100)

**Examples:**
- "Show me unread emails" → `{action: "search", args: {query: "is:unread"}}`
- "Find emails from John" → `{action: "search", args: {query: "from:john@example.com"}}`
- "Get emails about meetings" → `{action: "search", args: {query: "subject:meeting"}}`

### 2. Get Email Content (`get`)
**When to use:** When users want to see the full content of a specific email
**Required parameters:** 
- `messageId` (string): Gmail message ID

**Examples:**
- "Show me the details of email ID 12345" → `{action: "get", args: {messageId: "12345"}}`

### 3. Create Draft (`draft`)
**When to use:** When users want to create a new email draft
**Required parameters:**
- `to` (string): Recipient email address
- `subject` (string): Email subject
**Optional parameters:**
- `body` (string): Email body content

**Examples:**
- "Create a draft to john@example.com about the meeting" → `{action: "draft", args: {to: "john@example.com", subject: "Meeting", body: ""}}`

### 4. Send Email (`send`)
**When to use:** When users want to send an email immediately
**Required parameters:**
- `to` (string): Recipient email address
- `subject` (string): Email subject
**Optional parameters:**
- `body` (string): Email body content

**Examples:**
- "Send an email to john@example.com about the project" → `{action: "send", args: {to: "john@example.com", subject: "Project Update", body: "Here's the latest update..."}}`

### 5. Email Summary (`summary`)
**When to use:** When users want analytics or summaries of their emails
**Required parameters:** None
**Optional parameters:**
- `query` (string): Gmail search query (default: "in:inbox")
- `timeRange` (string): "day", "week", or "month" (default: "week")
- `maxResults` (integer): Number of emails to analyze (max 50)

**Examples:**
- "Give me a summary of my emails this week" → `{action: "summary", args: {timeRange: "week"}}`
- "Summarize unread emails" → `{action: "summary", args: {query: "is:unread"}}`

### 6. List Drafts (`list_drafts`)
**When to use:** When users want to see all their saved drafts
**Required parameters:** None
**Optional parameters:**
- `maxResults` (integer): Number of drafts to return (max 50)

**Examples:**
- "Show me my drafts" → `{action: "list_drafts", args: {}}`

### 7. Update Draft (`update_draft`)
**When to use:** When users want to modify an existing draft
**Required parameters:**
- `draftId` (string): Gmail draft ID
- `to` (string): Recipient email address
- `subject` (string): Email subject
**Optional parameters:**
- `body` (string): Email body content

**Examples:**
- "Update draft 12345 with new subject" → `{action: "update_draft", args: {draftId: "12345", to: "john@example.com", subject: "New Subject", body: ""}}`

### 8. Delete Draft (`delete_draft`)
**When to use:** When users want to remove a draft
**Required parameters:**
- `draftId` (string): Gmail draft ID

**Examples:**
- "Delete draft 12345" → `{action: "delete_draft", args: {draftId: "12345"}}`

### 9. Send Draft (`send_draft`)
**When to use:** When users want to send an existing draft
**Required parameters:**
- `draftId` (string): Gmail draft ID

**Examples:**
- "Send draft 12345" → `{action: "send_draft", args: {draftId: "12345"}}`

## Gmail Search Syntax

The AI should use these Gmail search operators when constructing queries:

### Basic Operators
- `from:email@example.com` - emails from specific sender
- `to:email@example.com` - emails to specific recipient
- `subject:keyword` - emails with keyword in subject
- `has:attachment` - emails with attachments
- `is:unread` - unread emails
- `is:read` - read emails
- `in:inbox` - emails in inbox
- `in:sent` - sent emails
- `in:drafts` - draft emails

### Date Operators
- `after:2024/01/01` - emails after specific date
- `before:2024/12/31` - emails before specific date
- `newer_than:1d` - emails newer than 1 day
- `older_than:1w` - emails older than 1 week

### Combined Queries
- `from:john@example.com is:unread` - unread emails from John
- `subject:meeting has:attachment` - meeting emails with attachments
- `after:2024/01/01 before:2024/01/31` - emails in January 2024

## Common User Queries and Responses

### "Show me my emails"
→ Use `search` action with default query "in:inbox"

### "What unread emails do I have?"
→ Use `search` action with query "is:unread"

### "Find emails from John about the project"
→ Use `search` action with query "from:john@example.com subject:project"

### "Create a draft email to Sarah"
→ Use `draft` action (ask for subject and body if not provided)

### "Send an email to the team about the meeting"
→ Use `send` action (ask for subject and body if not provided)

### "Show me my drafts"
→ Use `list_drafts` action

### "Give me a summary of this week's emails"
→ Use `summary` action with timeRange "week"

### "Delete that draft"
→ Use `delete_draft` action (need draftId from previous list_drafts)

## Error Handling

The AI should handle these common error scenarios:

1. **Missing parameters**: Ask user to provide required information
2. **Invalid messageId/draftId**: Inform user the ID doesn't exist
3. **Authentication errors**: Suggest reconnecting Google account
4. **Rate limiting**: Ask user to wait and try again
5. **Permission errors**: Suggest checking account permissions

## Best Practices

1. **Always validate parameters** before making API calls
2. **Provide helpful error messages** with suggestions
3. **Ask for missing information** rather than failing
4. **Use appropriate search queries** for user intent
5. **Limit results** to reasonable numbers (10-50)
6. **Provide confirmation messages** for actions like send/delete
7. **Show relevant information** from responses to users

## Response Format

All email actions return JSON responses with:
- `success`: boolean indicating if action succeeded
- `action`: the action that was performed
- `message`: human-readable message about the result
- Action-specific data (messages, drafts, etc.)
- Error information if applicable

The AI should parse these responses and present the information in a user-friendly format.
