import { ref, reactive } from 'vue'

const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? (process.env.VUE_APP_API_BASE || "https://personalassistantweb-production.up.railway.app")
  : window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : `http://${window.location.hostname}:3001`

export function useAudioService() {
  // Reactive state
  const isListening = ref(false)
  const isProcessing = ref(false)
  const isConnected = ref(false)
  const hasPermission = ref(false)
  const permissionDenied = ref(false)
  const transcription = ref('')
  const assistantResponse = ref('')
  
  // WebRTC and audio related variables
  let peerConnection = null
  let audioStream = null
  let audioElement = null
  let dataChannel = null
  let currentSession = null
  let sessionStartTime = null
  let messageCount = 0
  
  // Fetch ephemeral token from backend
  const getRealtimeSession = async () => {
    try {
      console.log('Fetching ephemeral token...')
      const response = await fetch(`${BACKEND_URL}/api/realtime/session`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to get session: ${error.error || response.statusText}`)
      }
      
      const data = await response.json()
      console.log('Successfully fetched ephemeral token')
      return data
    } catch (error) {
      console.error('Error fetching realtime session:', error)
      throw error
    }
  }
  
  // Initialize WebRTC connection to OpenAI
  const initializeWebRTC = async (session) => {
    try {
      console.log('Initializing WebRTC connection...')
      
      // Create RTCPeerConnection
      peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      })
      
      // Set up audio element for playback
      audioElement = document.createElement('audio')
      audioElement.autoplay = true
      audioElement.style.display = 'none'
      document.body.appendChild(audioElement)
      
      // Handle incoming audio stream from OpenAI
      peerConnection.ontrack = (event) => {
        console.log('Received audio track from OpenAI')
        if (event.streams && event.streams[0]) {
          audioElement.srcObject = event.streams[0]
        }
      }
      
      // Create data channel for events (optional)
      dataChannel = peerConnection.createDataChannel('oai-events')
      dataChannel.onopen = () => {
        console.log('Data channel opened')
      }
      
      dataChannel.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleRealtimeEvent(data)
        } catch (error) {
          console.log('Data channel message:', event.data)
        }
      }
      
      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState)
        isConnected.value = peerConnection.connectionState === 'connected'
        
        if (peerConnection.connectionState === 'failed' || 
            peerConnection.connectionState === 'disconnected') {
          console.log('Connection failed or disconnected, cleaning up...')
          cleanup()
        }
      }
      
      // Get user media and add to peer connection
      if (audioStream) {
        audioStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, audioStream)
        })
      }
      
      // Create and set local description
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true
      })
      await peerConnection.setLocalDescription(offer)
      
      // Send offer to OpenAI Realtime API
      const baseUrl = 'https://api.openai.com/v1/realtime'
      const model = 'gpt-4o-realtime-preview'
      
      console.log('Sending offer to OpenAI...')
      const response = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${session.client_secret.value}`,
          'Content-Type': 'application/sdp',
        },

      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
      }
      
      const answerSdp = await response.text()
      const answer = {
        type: 'answer',
        sdp: answerSdp,
      }
      
      await peerConnection.setRemoteDescription(answer)
      console.log('WebRTC connection established with OpenAI')
      
      return true
    } catch (error) {
      console.error('Error initializing WebRTC:', error)
      cleanup()
      throw error
    }
  }
  
  // Store conversation message
  const storeMessage = async (messageType, content, audioDurationMs = null) => {
    if (!currentSession?.session_id) return
    
    try {
      const timestamp = sessionStartTime ? Date.now() - sessionStartTime : 0
      const authToken = localStorage.getItem('auth_token')
      const headers = {
        'Content-Type': 'application/json'
      }
      
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`
      }
      
      await fetch(`${BACKEND_URL}/api/realtime/session/${currentSession.session_id}/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message_type: messageType,
          content,
          audio_duration_ms: audioDurationMs,
          timestamp_ms: timestamp,
          metadata: {}
        })
      })
      
      messageCount++
    } catch (error) {
      console.error('Error storing message:', error)
      // Don't fail the conversation if we can't store messages
    }
  }

  // Handle tool call execution
  const handleToolCall = async (toolCall) => {
    try {
      console.log('Executing tool call:', toolCall)
      
      // Forward tool call to backend
      const authToken = localStorage.getItem('auth_token')
      const headers = {
        'Content-Type': 'application/json'
      }
      
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`
      }
      
      const response = await fetch(`${BACKEND_URL}/api/tools/${toolCall.name}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...toolCall.arguments,
          openai_session_id: currentSession?.openai_session_id || currentSession?.id // Use OpenAI session ID
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Tool execution failed')
      }
      
      const result = await response.json()
      
      // Check if we need to update the session with new tools
      if (result.update_session && result.tools && dataChannel && dataChannel.readyState === 'open') {
        console.log('Updating WebRTC session with new tools:', result.tools)
        
        // Send session.update event via data channel
        dataChannel.send(JSON.stringify({
          type: 'session.update',
          session: {
            tools: result.tools
          }
        }))
      }
      
      // Send tool result back to OpenAI via data channel
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: toolCall.id,
            output: JSON.stringify(result)
          }
        }))
        
        // Trigger response generation after tool result
        setTimeout(() => {
          dataChannel.send(JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['text', 'audio']
            }
          }))
        }, 100)
      }
      
      console.log('Tool call completed:', result)
      return result
    } catch (error) {
      console.error('Tool call error:', error)
      
      // Send error back to OpenAI via data channel
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: toolCall.id,
            output: JSON.stringify({
              success: false,
              error: error.message
            })
          }
        }))
        
        // Trigger response generation after error
        setTimeout(() => {
          dataChannel.send(JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['text', 'audio']
            }
          }))
        }, 100)
      }
      
      // Store error message
      storeMessage('system', `Tool error: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  // Handle realtime events from data channel
  const handleRealtimeEvent = (event) => {
    console.log('Realtime event:', event)
    console.log('Event type:', event.type)
    switch (event.type) {
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          transcription.value = event.transcript
          // Store user transcription
          storeMessage('user_text', event.transcript)
        }
        break
        
      case 'response.text.delta':
        if (event.delta) {
          assistantResponse.value += event.delta
        }
        break
        
      case 'response.function_call_arguments.done': {
        // Handle tool call from assistant
        isProcessing.value = true
        
        // Format the tool call data to match expected structure
        const toolCall = {
          id: event.call_id,
          name: event.name,
          arguments: JSON.parse(event.arguments)
        }
        
        console.log('Tool call detected:', toolCall)
        handleToolCall(toolCall)
        break
      }
        
      case 'response.done':
        isProcessing.value = false
        console.log('Response completed')
        // Store complete assistant response
        if (assistantResponse.value) {
          storeMessage('assistant_text', assistantResponse.value)
        }
        break
        
      case 'error':
        console.error('OpenAI error:', event.error)
        isProcessing.value = false
        isListening.value = false
        // Store error message
        storeMessage('system', `Error: ${event.error?.message || 'Unknown error'}`)
        break
        
      default:
        console.log('Unhandled event type:', event.type)
    }
  }
  
  // Request microphone permission and get audio stream
  const requestPermission = async () => {
    try {
      console.log('Requesting microphone permission...')
      audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 24000, // OpenAI Realtime API prefers 24kHz
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      
      hasPermission.value = true
      permissionDenied.value = false
      console.log('Microphone permission granted')
      
      // Store permission state in localStorage for future visits
      localStorage.setItem('microphonePermission', 'granted')
      
      return true
    } catch (error) {
      console.error('Permission denied or error:', error)
      hasPermission.value = false
      permissionDenied.value = true
      
      // Store denial state in localStorage
      if (error.name === 'NotAllowedError') {
        localStorage.setItem('microphonePermission', 'denied')
      }
      
      return false
    }
  }
  
  // Update session status
  const updateSessionStatus = async (status, errorMessage = null) => {
    if (!currentSession?.session_id) return
    
    try {
      const duration = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : null
      const authToken = localStorage.getItem('auth_token')
      const headers = {
        'Content-Type': 'application/json'
      }
      
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`
      }
      
      await fetch(`${BACKEND_URL}/api/realtime/session/${currentSession.session_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status,
          error_message: errorMessage,
          duration_seconds: duration,
          total_messages: messageCount
        })
      })
    } catch (error) {
      console.error('Error updating session status:', error)
    }
  }

  // Start realtime conversation
  const startRealtime = async () => {
    try {
      console.log('Starting realtime conversation...')
      isProcessing.value = true
      
      // Ensure we have microphone permission
      if (!audioStream) {
        const granted = await requestPermission()
        if (!granted) {
          isProcessing.value = false
          return false
        }
      }
      
      // Get ephemeral session
      currentSession = await getRealtimeSession()
      sessionStartTime = Date.now()
      messageCount = 0
      
      // Initialize WebRTC connection
      await initializeWebRTC(currentSession)
      
      isListening.value = true
      isProcessing.value = false
      transcription.value = ''
      assistantResponse.value = ''
      
      console.log('Realtime conversation started')
      return true
    } catch (error) {
      console.error('Error starting realtime conversation:', error)
      isProcessing.value = false
      isListening.value = false
      
      // Update session status as failed
      await updateSessionStatus('failed', error.message)
      
      // Show user-friendly error message
      if (error.message.includes('session')) {
        alert('Failed to connect to AI service. Please check your API key configuration.')
      } else if (error.message.includes('WebRTC')) {
        alert('Failed to establish voice connection. Please try again.')
      } else {
        alert('An unexpected error occurred. Please try again.')
      }
      
      return false
    }
  }
  
  // Stop realtime conversation
  const stopRealtime = async () => {
    console.log('Stopping realtime conversation...')
    isListening.value = false
    isProcessing.value = true
    
    // Update session as completed
    await updateSessionStatus('completed')
    
    // Small delay to show processing state
    setTimeout(() => {
      cleanup()
      isProcessing.value = false
    }, 1000)
  }
  
  // Clean up all connections and resources
  const cleanup = () => {
    console.log('Cleaning up resources...')
    
    if (peerConnection) {
      peerConnection.close()
      peerConnection = null
    }
    
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop())
      audioStream = null
    }
    
    if (audioElement) {
      audioElement.remove()
      audioElement = null
    }
    
    if (dataChannel) {
      dataChannel.close()
      dataChannel = null
    }
    
    currentSession = null
    sessionStartTime = null
    messageCount = 0
    isConnected.value = false
    isListening.value = false
  }
  
  // Toggle microphone (main function called by UI)
  const toggleMicrophone = async () => {
    if (!hasPermission.value && permissionDenied.value) {
      return
    }
    
    if (isListening.value) {
      stopRealtime()
    } else {
      await startRealtime()
    }
  }
  
  // Clear conversation history
  const clearConversation = () => {
    transcription.value = ''
    assistantResponse.value = ''
  }
  
  // Reset permission state (useful for testing or if user wants to change their mind)
  const resetPermissions = () => {
    hasPermission.value = false
    permissionDenied.value = false
    localStorage.removeItem('microphonePermission')
    
    // Clean up any existing audio stream
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop())
      audioStream = null
    }
    
    console.log('Permission state reset')
  }
  
  // Initialize permissions on first load
  const initialize = async () => {
    // First, check localStorage for previous permission state
    const storedPermission = localStorage.getItem('microphonePermission')
    if (storedPermission === 'granted') {
      hasPermission.value = true
      console.log('Using stored permission: granted')
    } else if (storedPermission === 'denied') {
      permissionDenied.value = true
      console.log('Using stored permission: denied')
    }
    
    try {
      // Check if we already have permission using Permissions API
      const permissions = await navigator.permissions.query({ name: 'microphone' })
      if (permissions.state === 'granted') {
        hasPermission.value = true
        permissionDenied.value = false
        localStorage.setItem('microphonePermission', 'granted')
        console.log('Microphone permission confirmed via Permissions API')
      } else if (permissions.state === 'denied') {
        hasPermission.value = false
        permissionDenied.value = true
        localStorage.setItem('microphonePermission', 'denied')
        console.log('Microphone permission denied via Permissions API')
      }
      
      // Listen for permission changes
      permissions.addEventListener('change', () => {
        if (permissions.state === 'granted') {
          hasPermission.value = true
          permissionDenied.value = false
          localStorage.setItem('microphonePermission', 'granted')
        } else if (permissions.state === 'denied') {
          hasPermission.value = false
          permissionDenied.value = true
          localStorage.setItem('microphonePermission', 'denied')
        } else {
          // Permission state is 'prompt' - clear stored state
          localStorage.removeItem('microphonePermission')
        }
      })
    } catch (error) {
      console.log('Permission API not supported, using localStorage state only')
      // If no stored state and API not supported, we'll show the modal
      // This ensures new users get prompted, but returning users don't
    }
  }
  
  // Cleanup on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanup)
  }
  
  // Initialize when composable is created
  initialize()
  
  return {
    isListening,
    isProcessing,
    isConnected,
    hasPermission,
    permissionDenied,
    transcription,
    assistantResponse,
    toggleMicrophone,
    requestPermission,
    clearConversation,
    resetPermissions
  }
}