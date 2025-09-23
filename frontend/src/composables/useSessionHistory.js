import { ref, reactive } from 'vue'

const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? (process.env.VUE_APP_API_URL || 'https://your-backend-domain.com')
  : window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : `http://${window.location.hostname}:3001`

export function useSessionHistory() {
  // Reactive state
  const sessions = ref([])
  const currentSessionDetail = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  // Fetch user's session history
  const fetchSessions = async (limit = 10, offset = 0, status = null) => {
    try {
      isLoading.value = true
      error.value = null

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      })
      
      if (status) {
        params.append('status', status)
      }

      const response = await fetch(`${BACKEND_URL}/api/realtime/sessions?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (offset === 0) {
        sessions.value = data.sessions
      } else {
        sessions.value.push(...data.sessions)
      }

      return data.sessions
    } catch (err) {
      console.error('Error fetching sessions:', err)
      error.value = err.message
      return []
    } finally {
      isLoading.value = false
    }
  }

  // Fetch specific session with conversation history
  const fetchSessionDetail = async (sessionId) => {
    try {
      isLoading.value = true
      error.value = null

      const response = await fetch(`${BACKEND_URL}/api/realtime/session/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.statusText}`)
      }

      const data = await response.json()
      currentSessionDetail.value = data

      return data
    } catch (err) {
      console.error('Error fetching session detail:', err)
      error.value = err.message
      return null
    } finally {
      isLoading.value = false
    }
  }

  // Delete a session
  const deleteSession = async (sessionId) => {
    try {
      isLoading.value = true
      error.value = null

      const response = await fetch(`${BACKEND_URL}/api/realtime/session/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.statusText}`)
      }

      // Remove from local sessions array
      sessions.value = sessions.value.filter(session => session.id !== sessionId)
      
      // Clear current detail if it's the deleted session
      if (currentSessionDetail.value?.session?.id === sessionId) {
        currentSessionDetail.value = null
      }

      return true
    } catch (err) {
      console.error('Error deleting session:', err)
      error.value = err.message
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Format duration for display
  const formatDuration = (durationSeconds) => {
    if (!durationSeconds) return '0s'
    
    if (durationSeconds < 60) {
      return `${durationSeconds}s`
    } else if (durationSeconds < 3600) {
      const minutes = Math.floor(durationSeconds / 60)
      const seconds = durationSeconds % 60
      return `${minutes}m ${seconds}s`
    } else {
      const hours = Math.floor(durationSeconds / 3600)
      const minutes = Math.floor((durationSeconds % 3600) / 60)
      return `${hours}h ${minutes}m`
    }
  }

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return ''
    
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return `${diffMinutes} minutes ago`
    } else if (diffHours < 24) {
      const hours = Math.floor(diffHours)
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    } else if (diffDays < 7) {
      const days = Math.floor(diffDays)
      return `${days} day${days > 1 ? 's' : ''} ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  // Get session status color/icon
  const getSessionStatus = (status) => {
    switch (status) {
      case 'active':
        return { color: 'blue', icon: '🔵', label: 'Active' }
      case 'completed':
        return { color: 'green', icon: '✅', label: 'Completed' }
      case 'failed':
        return { color: 'red', icon: '❌', label: 'Failed' }
      case 'expired':
        return { color: 'orange', icon: '⏰', label: 'Expired' }
      default:
        return { color: 'gray', icon: '⚪', label: 'Unknown' }
    }
  }

  // Get message type display info
  const getMessageTypeInfo = (messageType) => {
    switch (messageType) {
      case 'user_text':
        return { icon: '👤', label: 'You', color: 'blue' }
      case 'user_audio':
        return { icon: '🎤', label: 'You (Audio)', color: 'blue' }
      case 'assistant_text':
        return { icon: '🤖', label: 'Assistant', color: 'green' }
      case 'assistant_audio':
        return { icon: '🔊', label: 'Assistant (Audio)', color: 'green' }
      case 'system':
        return { icon: '⚙️', label: 'System', color: 'gray' }
      default:
        return { icon: '💬', label: 'Message', color: 'gray' }
    }
  }

  // Clear current session detail
  const clearSessionDetail = () => {
    currentSessionDetail.value = null
  }

  // Clear all sessions
  const clearSessions = () => {
    sessions.value = []
    currentSessionDetail.value = null
    error.value = null
  }

  return {
    // State
    sessions,
    currentSessionDetail,
    isLoading,
    error,
    
    // Methods
    fetchSessions,
    fetchSessionDetail,
    deleteSession,
    clearSessionDetail,
    clearSessions,
    
    // Utility methods
    formatDuration,
    formatTimestamp,
    getSessionStatus,
    getMessageTypeInfo
  }
}
