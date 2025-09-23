<template>
  <div class="history-screen">
    <!-- Header -->
    <div class="header">
      <button class="back-button" @click="$router.go(-1)">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z"/>
        </svg>
      </button>
      <h1 class="title">Conversation History</h1>
      <button class="refresh-button" @click="refreshSessions" :disabled="isLoading">
        <svg viewBox="0 0 24 24" fill="currentColor" :class="{ spinning: isLoading }">
          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
        </svg>
      </button>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="refreshSessions">Try Again</button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading && sessions.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>Loading conversation history...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="sessions.length === 0 && !isLoading" class="empty-state">
      <div class="empty-icon">🎤</div>
      <h2>No conversations yet</h2>
      <p>Start a conversation to see your history here</p>
      <button class="start-button" @click="$router.push('/')">
        Start Conversation
      </button>
    </div>

    <!-- Sessions List -->
    <div v-else class="sessions-container">
      <div class="sessions-list">
        <div 
          v-for="session in sessions" 
          :key="session.id" 
          class="session-card"
          @click="viewSessionDetail(session.id)"
        >
          <div class="session-header">
            <div class="session-status">
              <span class="status-icon">{{ getSessionStatus(session.status).icon }}</span>
              <span class="status-text">{{ getSessionStatus(session.status).label }}</span>
            </div>
            <div class="session-time">
              {{ formatTimestamp(session.started_at) }}
            </div>
          </div>
          
          <div class="session-info">
            <div class="session-duration">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              {{ formatDuration(session.duration_seconds) }}
            </div>
            <div class="session-messages">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
              </svg>
              {{ session.total_messages || 0 }} messages
            </div>
          </div>

          <div class="session-model">
            <span class="model-tag">{{ session.model }}</span>
            <span class="voice-tag">{{ session.voice }}</span>
          </div>

          <div class="session-actions">
            <button 
              class="delete-button" 
              @click.stop="confirmDeleteSession(session.id)"
              :disabled="isLoading"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Load More Button -->
      <div v-if="sessions.length >= 10" class="load-more">
        <button 
          @click="loadMoreSessions" 
          :disabled="isLoading"
          class="load-more-button"
        >
          {{ isLoading ? 'Loading...' : 'Load More' }}
        </button>
      </div>
    </div>

    <!-- Session Detail Modal -->
    <div v-if="showDetailModal" class="modal-overlay" @click="closeDetailModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Conversation Details</h2>
          <button class="close-button" @click="closeDetailModal">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div v-if="currentSessionDetail" class="modal-body">
          <div class="session-summary">
            <div class="summary-item">
              <strong>Status:</strong> 
              <span :class="'status-' + currentSessionDetail.session.status">
                {{ getSessionStatus(currentSessionDetail.session.status).label }}
              </span>
            </div>
            <div class="summary-item">
              <strong>Duration:</strong> {{ formatDuration(currentSessionDetail.session.duration_seconds) }}
            </div>
            <div class="summary-item">
              <strong>Messages:</strong> {{ currentSessionDetail.session.total_messages || 0 }}
            </div>
            <div class="summary-item">
              <strong>Started:</strong> {{ new Date(currentSessionDetail.session.started_at).toLocaleString() }}
            </div>
          </div>

          <div class="conversation-messages">
            <h3>Conversation</h3>
            <div class="messages-list">
              <div 
                v-for="message in currentSessionDetail.messages" 
                :key="message.id"
                class="message"
                :class="'message-' + message.message_type"
              >
                <div class="message-header">
                  <span class="message-type">
                    {{ getMessageTypeInfo(message.message_type).icon }}
                    {{ getMessageTypeInfo(message.message_type).label }}
                  </span>
                  <span class="message-time">
                    {{ formatMessageTime(message.timestamp_ms) }}
                  </span>
                </div>
                <div class="message-content">
                  {{ message.content }}
                  <span v-if="message.audio_duration_ms" class="audio-duration">
                    ({{ Math.round(message.audio_duration_ms / 1000) }}s audio)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click="closeDeleteModal">
      <div class="modal delete-modal" @click.stop>
        <div class="modal-header">
          <h2>Delete Conversation</h2>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete this conversation? This action cannot be undone.</p>
        </div>
        <div class="modal-actions">
          <button class="cancel-button" @click="closeDeleteModal">Cancel</button>
          <button class="delete-button" @click="deleteSelectedSession" :disabled="isLoading">
            {{ isLoading ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useSessionHistory } from '../composables/useSessionHistory'

export default {
  name: 'HistoryScreen',
  setup() {
    const {
      sessions,
      currentSessionDetail,
      isLoading,
      error,
      fetchSessions,
      fetchSessionDetail,
      deleteSession,
      clearSessionDetail,
      formatDuration,
      formatTimestamp,
      getSessionStatus,
      getMessageTypeInfo
    } = useSessionHistory()

    const showDetailModal = ref(false)
    const showDeleteModal = ref(false)
    const sessionToDelete = ref(null)
    const currentOffset = ref(0)

    const refreshSessions = async () => {
      currentOffset.value = 0
      await fetchSessions(10, 0)
    }

    const loadMoreSessions = async () => {
      currentOffset.value += 10
      await fetchSessions(10, currentOffset.value)
    }

    const viewSessionDetail = async (sessionId) => {
      await fetchSessionDetail(sessionId)
      showDetailModal.value = true
    }

    const closeDetailModal = () => {
      showDetailModal.value = false
      clearSessionDetail()
    }

    const confirmDeleteSession = (sessionId) => {
      sessionToDelete.value = sessionId
      showDeleteModal.value = true
    }

    const closeDeleteModal = () => {
      showDeleteModal.value = false
      sessionToDelete.value = null
    }

    const deleteSelectedSession = async () => {
      if (sessionToDelete.value) {
        const success = await deleteSession(sessionToDelete.value)
        if (success) {
          closeDeleteModal()
        }
      }
    }

    const formatMessageTime = (timestampMs) => {
      if (!timestampMs) return '0:00'
      
      const totalSeconds = Math.floor(timestampMs / 1000)
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    onMounted(() => {
      refreshSessions()
    })

    return {
      sessions,
      currentSessionDetail,
      isLoading,
      error,
      showDetailModal,
      showDeleteModal,
      refreshSessions,
      loadMoreSessions,
      viewSessionDetail,
      closeDetailModal,
      confirmDeleteSession,
      closeDeleteModal,
      deleteSelectedSession,
      formatDuration,
      formatTimestamp,
      formatMessageTime,
      getSessionStatus,
      getMessageTypeInfo
    }
  }
}
</script>

<style scoped>
.history-screen {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: rgba(0, 0, 0, 0.1);
}

.back-button, .refresh-button {
  width: 40px;
  height: 40px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.back-button:hover, .refresh-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.back-button svg, .refresh-button svg {
  width: 20px;
  height: 20px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.error-message {
  margin: 20px;
  padding: 20px;
  background: rgba(255, 107, 107, 0.2);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 12px;
  text-align: center;
}

.error-message button {
  margin-top: 10px;
  padding: 8px 16px;
  background: rgba(255, 107, 107, 0.8);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.empty-state h2 {
  font-size: 24px;
  margin-bottom: 10px;
}

.empty-state p {
  font-size: 16px;
  opacity: 0.8;
  margin-bottom: 30px;
}

.start-button {
  padding: 14px 28px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: none;
  border-radius: 25px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.start-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.sessions-container {
  padding: 0 20px 20px;
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.session-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.session-card:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.session-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  font-size: 14px;
}

.status-text {
  font-size: 14px;
  font-weight: 600;
}

.session-time {
  font-size: 12px;
  opacity: 0.8;
}

.session-info {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
}

.session-duration, .session-messages {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.session-duration svg, .session-messages svg {
  width: 16px;
  height: 16px;
  opacity: 0.7;
}

.session-model {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.model-tag, .voice-tag {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.session-actions {
  position: absolute;
  top: 20px;
  right: 20px;
}

.delete-button {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 107, 107, 0.2);
  border-radius: 50%;
  color: #ff6b6b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  opacity: 0;
}

.session-card:hover .delete-button {
  opacity: 1;
}

.delete-button:hover {
  background: rgba(255, 107, 107, 0.3);
  transform: scale(1.1);
}

.delete-button svg {
  width: 16px;
  height: 16px;
}

.load-more {
  text-align: center;
  margin-top: 20px;
}

.load-more-button {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: none;
  border-radius: 20px;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.load-more-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}

.load-more-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  color: #333;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.close-button {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button svg {
  width: 18px;
  height: 18px;
}

.modal-body {
  padding: 24px;
}

.session-summary {
  margin-bottom: 24px;
}

.summary-item {
  margin-bottom: 8px;
  font-size: 14px;
}

.conversation-messages h3 {
  margin-bottom: 16px;
  font-size: 18px;
}

.messages-list {
  max-height: 300px;
  overflow-y: auto;
}

.message {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.05);
}

.message-user_text, .message-user_audio {
  background: rgba(74, 144, 226, 0.1);
  border-left: 3px solid #4A90E2;
}

.message-assistant_text, .message-assistant_audio {
  background: rgba(46, 213, 115, 0.1);
  border-left: 3px solid #2ed573;
}

.message-system {
  background: rgba(128, 128, 128, 0.1);
  border-left: 3px solid #808080;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
}

.message-content {
  font-size: 14px;
  line-height: 1.4;
}

.audio-duration {
  font-size: 12px;
  opacity: 0.7;
  font-style: italic;
}

.delete-modal {
  max-width: 400px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.cancel-button, .delete-button {
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.cancel-button {
  background: #f5f5f5;
  color: #666;
}

.cancel-button:hover {
  background: #e0e0e0;
}

.modal-actions .delete-button {
  background: #ff6b6b;
  color: white;
}

.modal-actions .delete-button:hover:not(:disabled) {
  background: #ff5252;
}

.modal-actions .delete-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Status colors */
.status-active { color: #4A90E2; }
.status-completed { color: #2ed573; }
.status-failed { color: #ff6b6b; }
.status-expired { color: #ffa726; }

/* Mobile Responsiveness */
@media (max-width: 480px) {
  .header {
    padding: 16px;
  }
  
  .title {
    font-size: 18px;
  }
  
  .sessions-container {
    padding: 0 16px 16px;
  }
  
  .session-card {
    padding: 16px;
  }
  
  .modal {
    margin: 10px;
    max-height: 90vh;
  }
  
  .modal-header, .modal-body {
    padding: 20px;
  }
}
</style>

