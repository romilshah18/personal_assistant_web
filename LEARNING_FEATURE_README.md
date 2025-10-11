# Learning Feature - Complete Implementation Guide

## 📚 Overview

The Learning feature enables users to learn any topic with the AI assistant while maintaining continuity across sessions. The assistant remembers what was taught, tracks progress, and seamlessly resumes from where the user left off.

## 🎯 Key Features

- **Persistent Memory**: AI remembers everything taught across multiple sessions
- **Progress Tracking**: Visual progress bars and session history
- **Smart Resume**: AI knows exactly where to continue from previous session
- **Multi-Topic Support**: Learn multiple subjects simultaneously
- **Session History**: Review past sessions and concepts learned
- **Categories & Filtering**: Organize topics by category (Programming, Language, Science, etc.)
- **Difficulty Levels**: Beginner, Intermediate, Advanced
- **Time Tracking**: Monitor total learning time per topic

## 🚀 Setup Instructions

### 1. Database Setup

Run the SQL schema in your Supabase SQL Editor:

```bash
# Execute the learning schema
psql -h your-supabase-host -U postgres -d postgres -f learning-schema.sql
```

Or copy the contents of `learning-schema.sql` and run it directly in Supabase SQL Editor.

The schema includes:
- `learning_topics` - Stores learning topics
- `learning_sessions` - Tracks individual learning sessions
- `learning_progress_points` - Granular progress tracking
- `learning_resources` - Optional resources for topics

### 2. Backend Setup

The backend implementation is already included in `backend/server.js`. It includes:

**API Endpoints:**
- `POST /api/tools/learning_actions` - AI tool handler
- `GET /api/learning/topics` - List all topics
- `POST /api/learning/topics` - Create new topic
- `GET /api/learning/topics/:topicId` - Get topic details
- `PATCH /api/learning/topics/:topicId` - Update topic
- `DELETE /api/learning/topics/:topicId` - Delete topic
- `GET /api/learning/stats` - Get learning statistics
- `GET /api/learning/topics/:topicId/sessions` - Get sessions for a topic

**AI Tool Actions:**
- `find_topic` - **Search for existing topic by name** (CRITICAL: ALWAYS use this first!)
- `create_topic` - Start learning a new subject (only after find_topic returns null)
- `continue_topic` - Resume existing topic with full context
- `get_context` - Get complete learning history
- `save_progress` - Save session progress and summary
- `list_topics` - Show all learning topics
- `complete_topic` - Mark topic as completed
- `update_topic` - Update topic details

### 3. Frontend Setup

The frontend implementation includes:

**Files:**
- `frontend/src/composables/useLearning.js` - Learning composable
- `frontend/src/views/LearningScreen.vue` - Main learning UI

**Features:**
- Topic cards with progress visualization
- Stats overview (in progress, completed, total time)
- Category and status filtering
- Topic details modal with session history
- Create/Edit topic forms
- Beautiful, responsive design

## 📖 User Guide

### Creating a Learning Topic

#### Option 1: Via Voice Assistant
```
User: "I want to learn Python programming"
AI: Creates topic and starts teaching immediately
```

#### Option 2: Via UI
1. Go to Learning tab
2. Click "New Topic" button
3. Fill in:
   - Title (e.g., "Python Programming")
   - Description (optional)
   - Category (Programming, Language, etc.)
   - Difficulty (Beginner/Intermediate/Advanced)
   - Estimated Duration (optional)
4. Click "Create"

### Learning with Voice Assistant

**Starting a New Topic (or Resuming):**
```
User: "Teach me JavaScript" or "I want to learn Python"

AI Workflow:
1. Calls find_topic("JavaScript") to check if it exists
2. If found: "I see you already have JavaScript in progress (45% complete). 
   Let's continue from where we left off..."
3. If not found: "Great! Let's start learning JavaScript from scratch..."
```

**Continuing Previous Learning:**
```
User: "Continue learning Python"
AI: 
1. Calls find_topic("Python") to get topic_id
2. Calls continue_topic(topic_id) to retrieve full context
3. "Welcome back! Last time we covered functions and parameters. 
    Today let's learn about lambda functions..."
```

**AI automatically:**
- **Checks for duplicates** before creating new topics
- **Resumes existing topics** when user wants to learn something they've started
- Tracks what concepts were covered
- Saves session summaries
- Notes what to teach next
- Monitors user's understanding level

**Smart Duplicate Detection:**
- "I want to learn Python" → Finds "Python Programming" (exact/partial match)
- "Teach me JS" → Finds "JavaScript Basics" (word matching)
- Case-insensitive matching
- Handles variations in topic names

### Viewing Progress

1. Open Learning tab
2. See all your learning topics as cards showing:
   - Title and description
   - Progress percentage
   - Number of sessions
   - Time spent
   - Last accessed date
3. Click a topic card to see:
   - Detailed progress
   - All session histories
   - Key concepts learned
   - Last session summary
   - Next steps

### Managing Topics

**Edit Topic:**
- Click topic card → Click "Edit Topic"
- Update status, progress, description, etc.

**Delete Topic:**
- Click trash icon on topic card
- Confirm deletion (this deletes all sessions too)

**Filter Topics:**
- By Status: All, In Progress, Completed, Not Started
- By Category: Programming, Language, Science, etc.

## 🤖 AI Integration

### Critical Workflow: No Duplicate Topics!

**When user says "I want to learn Python":**

1. **AI MUST first call `find_topic`:**
   ```javascript
   find_topic({ title: "Python" })
   ```

2. **If topic exists** (`found: true`):
   ```javascript
   // Response includes:
   {
     found: true,
     topic: { id, title, status, progress_percentage, ... },
     message: "Found existing topic: Python Programming (in_progress, 45% complete)",
     suggestion: "Let's continue from where you left off!"
   }
   // AI should then call: continue_topic({ topic_id: topic.id })
   ```

3. **If topic doesn't exist** (`found: false`):
   ```javascript
   // Response:
   {
     found: false,
     topic: null,
     message: "No existing topic found for Python",
     suggestion: "Would you like to start learning Python from scratch?"
   }
   // AI should then call: create_topic({ title: "Python" })
   ```

### How AI Uses Learning Context

When user says "Continue learning Python", the AI:

1. **Fetches Full Context:**
   - All previous sessions
   - Key concepts already taught
   - Last session summary
   - What to cover next
   - User's understanding level

2. **Injects Context:**
   ```
   LEARNING CONTEXT: 
   Topic: Python Programming (Session 4, 45% complete)
   Last Session: Covered functions, parameters, return statements
   Concepts Learned: def keyword, function scope, default parameters
   Next Steps: Lambda functions, decorators
   User Understanding: Confident with basics
   ```

3. **Continues Seamlessly:**
   - AI knows what NOT to repeat
   - Builds on previous knowledge
   - Adjusts pace based on progress

### Saving Progress

AI should call `save_progress` action when:
- User says "that's enough for today"
- Session naturally ends
- User says "stop" or "pause"
- Major milestone reached

**What to Save:**
```json
{
  "topic_id": "uuid-here",
  "summary": "Today we covered lambda functions and their syntax...",
  "concepts_covered": ["lambda functions", "anonymous functions", "map/filter"],
  "next_steps": "Next: Learn about decorators and their practical uses",
  "user_understanding": "confident",
  "progress_percentage": 55
}
```

## 💡 Example Scenarios

### Scenario 1: Complete Learning Journey

```
Day 1:
User: "I want to learn Spanish"
AI: Creates topic → Starts with basics → Saves progress

Day 2:
User: "Continue Spanish"
AI: Retrieves context → "Welcome back! Yesterday we learned greetings..."

Day 5:
User: "How much Spanish have I learned?"
AI: "You're 60% through. You've completed 5 sessions, learned
     120 words and basic conversation structures."
```

### Scenario 2: Multiple Topics

```
User has 3 active topics:
- Python Programming (70% complete)
- Spanish Language (30% complete)
- Guitar Basics (15% complete)

User: "Let's work on Python"
AI: Retrieves Python context and continues

User: "Now switch to Spanish"
AI: Saves Python progress, loads Spanish context, continues
```

### Scenario 3: Reviewing Progress

```
User clicks "Python Programming" topic card

Sees:
- 10 sessions completed
- 15 hours total learning time
- 75% progress
- Last session: "Advanced OOP concepts"
- Key concepts: [50+ items]
- Next: "Decorators and metaclasses"
- Session history with summaries
```

## 🎨 UI Features

### Topic Cards
- **Color-coded borders**: Blue (in progress), Green (completed)
- **Progress bars**: Visual percentage completion
- **Badges**: Status, difficulty, category
- **Stats**: Sessions count, time spent
- **Clickable**: Opens detailed view

### Stats Overview
- In Progress count
- Completed count
- Total topics
- Total time spent learning

### Filters
- Status tabs: All, In Progress, Completed, Not Started
- Category chips: Programming, Language, Science, etc.

### Details Modal
- Full overview
- Progress visualization
- Current section
- Last session summary
- Next steps
- All key concepts learned (as tags)
- Complete session history

## 🔧 Technical Details

### Database Schema

**learning_topics table:**
- Stores topic metadata, progress, summaries
- Tracks status, progress percentage, sessions count
- Maintains resume context (next steps, last summary)

**learning_sessions table:**
- Individual session records
- Links to realtime_sessions (AI conversations)
- Stores concepts covered, exercises, questions

**learning_progress_points table:**
- Granular tracking within sessions
- Timeline of learning events

### API Design

**RESTful endpoints** for frontend CRUD operations
**Tool handlers** for AI integration
**Context retrieval** optimized for AI consumption

### State Management

Frontend uses Vue Composition API with:
- `useLearning()` composable
- Reactive state management
- Computed properties for filtering
- Async data fetching

## 🎯 Best Practices

### For Users

1. **Be specific** when creating topics
2. **Use voice assistant** for actual learning
3. **Review progress** regularly via UI
4. **Update progress** manually if needed
5. **Complete topics** when done for satisfaction!

### For AI Assistant

1. **Always call** `continue_topic` when resuming
2. **Save progress** at natural breakpoints
3. **Update** `current_section` as you progress
4. **Track concepts** covered in each session
5. **Adjust difficulty** based on user understanding

## 🐛 Troubleshooting

### AI doesn't remember previous sessions
- Check if `save_progress` was called
- Verify topic_id is correct
- Ensure database policies allow read access

### Progress not updating
- Check trigger functions in database
- Verify session is properly ended
- Look at duration_minutes calculation

### Can't create topics via UI
- Check authentication
- Verify API endpoint is accessible
- Check browser console for errors

## 📊 Analytics

The system tracks:
- Total topics created
- Topics by status
- Topics by category
- Total learning time
- Session completion rates
- Average session duration

Access via: `GET /api/learning/stats`

## 🚀 Future Enhancements

Potential additions:
- [ ] Quiz generation based on learned concepts
- [ ] Spaced repetition reminders
- [ ] Learning streaks and achievements
- [ ] Export learning notes
- [ ] Share progress
- [ ] Collaborative learning
- [ ] Resource recommendations
- [ ] Progress charts and analytics

## 📝 Notes

- Users must be authenticated to use learning features
- Topics are private to each user
- All data syncs across devices automatically
- Progress is auto-saved during AI sessions
- Frontend works offline with cached data

## 🎉 Summary

The Learning feature transforms your personal assistant into a personalized tutor that:
- ✅ Never forgets what it taught you
- ✅ Picks up exactly where you left off
- ✅ Adapts to your learning pace
- ✅ Tracks your progress meticulously
- ✅ Provides beautiful visualizations
- ✅ Supports unlimited topics

Start learning anything, pause anytime, and continue seamlessly—your progress is always saved!

