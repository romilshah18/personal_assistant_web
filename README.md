# Personal Assistant PWA

A progressive web app that provides AI-powered voice assistance using OpenAI's Realtime API.

## Features

- 🎤 Voice interaction with OpenAI Realtime API
- 📱 Progressive Web App (installable on mobile devices)
- 🎨 Modern mobile-first UI design
- 🔊 Real-time audio processing
- 💬 Live transcription and responses

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key with Realtime API access

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from the example:
   ```bash
   cp env.example .env
   ```

4. Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3001
   NODE_ENV=development
   ```

5. Start the backend server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run serve
   ```

4. Open your browser and go to `http://localhost:8080`

### Building for Production

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. The built files will be in the `frontend/dist` directory

## Usage

1. Open the app in your browser
2. Grant microphone permissions when prompted
3. Tap the microphone button to start voice interaction
4. Speak your question or request
5. The AI assistant will respond with both text and voice

## PWA Installation

### On Mobile Devices:
- **iOS**: Tap the share button in Safari and select "Add to Home Screen"
- **Android**: Tap the menu button in Chrome and select "Add to Home screen"

### On Desktop:
- Look for the install icon in your browser's address bar
- Or use the browser menu to install the app

## Technical Stack

- **Backend**: Node.js, Express, OpenAI Realtime API (Ephemeral Tokens)
- **Frontend**: Vue.js 3, Composition API, PWA
- **Audio**: WebRTC, Web Audio API
- **Real-time Communication**: WebRTC with OpenAI Realtime API

## Notes

- Requires HTTPS in production for microphone access
- OpenAI Realtime API access is required
- Uses ephemeral tokens for secure API access (no API key exposure to client)
- WebRTC provides low-latency audio streaming with OpenAI
- The app works offline for basic functionality (PWA caching)
- Optimized for mobile devices but works on desktop
- Audio is processed at 24kHz for optimal quality with OpenAI Realtime API
# personal_assistant_web
