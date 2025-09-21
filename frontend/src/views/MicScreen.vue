<template>
  <div class="mic-screen">
    <!-- Status Bar -->
    <div class="status-bar">
      <div class="time">{{ currentTime }}</div>
      <div class="status-icons">
        <div class="connection-status" :class="{ connected: isConnected }"></div>
      </div>
    </div>

    <!-- Header -->
    <div class="header">
      <div class="header-content">
        <div class="title-section">
          <h1 class="app-title">Personal Assistant</h1>
          <p class="subtitle">Tap the microphone to start</p>
        </div>
        <button class="settings-button" @click="goToSettings">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Voice Visualizer -->
      <div class="voice-visualizer" v-if="isListening">
        <div class="wave-container">
          <div class="wave" v-for="i in 5" :key="i" :style="{ animationDelay: i * 0.1 + 's' }"></div>
        </div>
      </div>

      <!-- Microphone Button -->
      <div class="mic-container">
        <button 
          class="mic-button" 
          :class="{ 
            active: isListening, 
            processing: isProcessing,
            disabled: !hasPermission && permissionDenied 
          }"
          @click="toggleMicrophone"
          :disabled="!hasPermission && permissionDenied"
        >
          <div class="mic-icon">
            <svg v-if="!isListening" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v12H6z"/>
            </svg>
          </div>
        </button>
        
        <!-- Ripple Effect -->
        <div class="ripple-container" v-if="isListening">
          <div class="ripple" v-for="i in 3" :key="i" :style="{ animationDelay: i * 0.5 + 's' }"></div>
        </div>
      </div>

      <!-- Status Text -->
      <div class="status-text">
        <p v-if="!hasPermission && !permissionDenied" class="permission-text">
          Microphone permission required
        </p>
        <p v-else-if="permissionDenied" class="error-text">
          Microphone access denied. Please enable in settings.
        </p>
        <p v-else-if="isProcessing && !isListening" class="connecting-text">
          Connecting to AI assistant...
        </p>
        <p v-else-if="isListening && isConnected" class="listening-text">
          🎤 Listening... Speak now
        </p>
        <p v-else-if="isListening && !isConnected" class="connecting-text">
          Establishing voice connection...
        </p>
        <p v-else-if="isProcessing" class="processing-text">
          Processing your request...
        </p>
        <p v-else class="ready-text">
          Ready to chat with AI
        </p>
      </div>

      <!-- Transcription Display -->
      <div class="transcription" v-if="transcription">
        <div class="transcription-content">
          <h3>You said:</h3>
          <p>{{ transcription }}</p>
        </div>
      </div>

      <!-- Response Display -->
      <div class="response" v-if="assistantResponse">
        <div class="response-content">
          <h3>Assistant:</h3>
          <p>{{ assistantResponse }}</p>
        </div>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="bottom-actions">
      <button class="action-button" @click="clearConversation" v-if="transcription || assistantResponse">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        Clear
      </button>
    </div>

    <!-- Permission Modal -->
    <div class="modal-overlay" v-if="showPermissionModal" @click="closePermissionModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Microphone Permission</h2>
        </div>
        <div class="modal-body">
          <p>This app needs access to your microphone to provide voice assistance.</p>
          <p>Please allow microphone access when prompted.</p>
        </div>
        <div class="modal-actions">
          <button class="modal-button primary" @click="requestPermission">
            Grant Permission
          </button>
          <button class="modal-button" @click="closePermissionModal">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAudioService } from '../composables/useAudioService'

export default {
  name: 'MicScreen',
  setup() {
    const router = useRouter()
    const currentTime = ref('')
    const showPermissionModal = ref(false)
    
    const {
      isListening,
      isProcessing,
      isConnected,
      hasPermission,
      permissionDenied,
      transcription,
      assistantResponse,
      toggleMicrophone,
      requestPermission: requestAudioPermission,
      clearConversation
    } = useAudioService()

    // Update time
    const updateTime = () => {
      const now = new Date()
      currentTime.value = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const requestPermission = async () => {
      closePermissionModal()
      await requestAudioPermission()
    }

    const closePermissionModal = () => {
      showPermissionModal.value = false
    }

    const goToSettings = () => {
      router.push('/settings')
    }

    let timeInterval

    onMounted(() => {
      updateTime()
      timeInterval = setInterval(updateTime, 1000)
      
      // Check if permission is needed
      if (!hasPermission.value && !permissionDenied.value) {
        showPermissionModal.value = true
      }
    })

    onUnmounted(() => {
      if (timeInterval) {
        clearInterval(timeInterval)
      }
    })

    return {
      currentTime,
      showPermissionModal,
      isListening,
      isProcessing,
      isConnected,
      hasPermission,
      permissionDenied,
      transcription,
      assistantResponse,
      toggleMicrophone,
      requestPermission,
      closePermissionModal,
      clearConversation,
      goToSettings
    }
  }
}
</script>

<style scoped>
.mic-screen {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.1);
}

.status-icons {
  display: flex;
  gap: 8px;
}

.connection-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff4757;
  transition: background 0.3s ease;
}

.connection-status.connected {
  background: #2ed573;
}

.header {
  padding: 40px 20px 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 400px;
  margin: 0 auto;
}

.title-section {
  text-align: center;
  flex: 1;
}

.app-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.subtitle {
  font-size: 16px;
  opacity: 0.8;
  font-weight: 400;
}

.settings-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.settings-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.settings-button svg {
  width: 20px;
  height: 20px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
}

.voice-visualizer {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.wave-container {
  display: flex;
  gap: 4px;
  align-items: center;
}

.wave {
  width: 4px;
  height: 20px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 2px;
  animation: wave 1s infinite ease-in-out;
}

@keyframes wave {
  0%, 100% { height: 20px; }
  50% { height: 60px; }
}

.mic-container {
  position: relative;
  z-index: 2;
  margin-bottom: 40px;
}

.mic-button {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.mic-button:hover {
  transform: scale(1.05);
  background: rgba(255, 255, 255, 0.3);
}

.mic-button.active {
  background: rgba(255, 107, 107, 0.8);
  animation: pulse 2s infinite;
}

.mic-button.processing {
  background: rgba(255, 193, 7, 0.8);
  animation: spin 1s linear infinite;
}

.mic-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mic-icon {
  width: 40px;
  height: 40px;
}

.mic-icon svg {
  width: 100%;
  height: 100%;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ripple-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.ripple {
  position: absolute;
  width: 120px;
  height: 120px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  animation: ripple 2s infinite;
}

@keyframes ripple {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

.status-text {
  text-align: center;
  margin-bottom: 30px;
}

.status-text p {
  font-size: 16px;
  font-weight: 500;
}

.permission-text, .connecting-text {
  color: #ffd700;
}

.error-text {
  color: #ff6b6b;
}

.listening-text {
  color: #4ecdc4;
  animation: blink 1.5s infinite;
}

.processing-text {
  color: #ffa726;
}

.ready-text {
  color: #66bb6a;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.transcription, .response {
  width: 100%;
  max-width: 400px;
  margin: 10px 0;
}

.transcription-content, .response-content {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 20px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.transcription-content h3, .response-content h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  opacity: 0.8;
}

.transcription-content p, .response-content p {
  font-size: 16px;
  line-height: 1.5;
}

.bottom-actions {
  padding: 20px;
  display: flex;
  justify-content: center;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: none;
  border-radius: 25px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.action-button svg {
  width: 18px;
  height: 18px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 30px;
  max-width: 400px;
  width: 100%;
  color: #333;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header h2 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 16px;
  color: #333;
}

.modal-body p {
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 12px;
  color: #666;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.modal-button {
  flex: 1;
  padding: 14px 20px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.modal-button.primary {
  background: #667eea;
  color: white;
}

.modal-button.primary:hover {
  background: #5a6fd8;
  transform: translateY(-1px);
}

.modal-button:not(.primary) {
  background: #f5f5f5;
  color: #666;
}

.modal-button:not(.primary):hover {
  background: #e0e0e0;
}

/* Mobile Responsiveness */
@media (max-width: 480px) {
  .app-title {
    font-size: 24px;
  }
  
  .mic-button {
    width: 100px;
    height: 100px;
  }
  
  .mic-icon {
    width: 35px;
    height: 35px;
  }
  
  .modal {
    margin: 20px;
    padding: 24px;
  }
}
</style>
