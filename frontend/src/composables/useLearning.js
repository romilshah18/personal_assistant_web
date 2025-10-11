import { ref, computed } from 'vue'
import { useAuth } from './useAuth'

export function useLearning() {
  const { getAuthHeaders } = useAuth()
  const API_URL = process.env.VUE_APP_API_URL || 'http://localhost:3001'
  
  const topics = ref([])
  const currentTopic = ref(null)
  const sessions = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Fetch learning topics with optional filters
  async function fetchTopics(filters = {}) {
    loading.value = true
    error.value = null
    
    try {
      const queryParams = new URLSearchParams()
      if (filters.status) queryParams.append('status', filters.status)
      if (filters.category) queryParams.append('category', filters.category)
      if (filters.limit) queryParams.append('limit', filters.limit)
      if (filters.offset) queryParams.append('offset', filters.offset)
      
      const response = await fetch(`${API_URL}/api/learning/topics?${queryParams}`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error('Failed to fetch learning topics')
      }

      const data = await response.json()
      topics.value = data.topics || []
      return data.topics
    } catch (err) {
      console.error('Error fetching learning topics:', err)
      error.value = err.message
      return []
    } finally {
      loading.value = false
    }
  }

  // Create new learning topic
  async function createTopic(topicData) {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`${API_URL}/api/learning/topics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(topicData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create learning topic')
      }

      const data = await response.json()
      
      // Add to local list
      if (data.topic) {
        topics.value.unshift(data.topic)
      }
      
      return data
    } catch (err) {
      console.error('Error creating learning topic:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // Get topic details with sessions
  async function getTopicDetails(topicId) {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`${API_URL}/api/learning/topics/${topicId}`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error('Failed to fetch topic details')
      }

      const data = await response.json()
      currentTopic.value = data.topic
      sessions.value = data.sessions || []
      return data
    } catch (err) {
      console.error('Error fetching topic details:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update learning topic
  async function updateTopic(topicId, updates) {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`${API_URL}/api/learning/topics/${topicId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update topic')
      }

      const data = await response.json()
      
      // Update in local list
      if (data.topic) {
        const index = topics.value.findIndex(t => t.id === topicId)
        if (index !== -1) {
          topics.value[index] = data.topic
        }
        if (currentTopic.value?.id === topicId) {
          currentTopic.value = data.topic
        }
      }
      
      return data
    } catch (err) {
      console.error('Error updating topic:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // Delete learning topic
  async function deleteTopic(topicId) {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`${API_URL}/api/learning/topics/${topicId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete topic')
      }

      // Remove from local list
      topics.value = topics.value.filter(t => t.id !== topicId)
      if (currentTopic.value?.id === topicId) {
        currentTopic.value = null
      }
      
      return await response.json()
    } catch (err) {
      console.error('Error deleting topic:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch sessions for a topic
  async function fetchSessions(topicId, limit = 10, offset = 0) {
    loading.value = true
    error.value = null
    
    try {
      const queryParams = new URLSearchParams()
      if (limit) queryParams.append('limit', limit)
      if (offset) queryParams.append('offset', offset)
      
      const response = await fetch(`${API_URL}/api/learning/topics/${topicId}/sessions?${queryParams}`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error('Failed to fetch sessions')
      }

      const data = await response.json()
      sessions.value = data.sessions || []
      return data.sessions
    } catch (err) {
      console.error('Error fetching sessions:', err)
      error.value = err.message
      return []
    } finally {
      loading.value = false
    }
  }

  // Get learning statistics
  async function fetchStats() {
    try {
      const response = await fetch(`${API_URL}/api/learning/stats`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }

      const data = await response.json()
      return data.stats
    } catch (err) {
      console.error('Error fetching stats:', err)
      return null
    }
  }

  // Computed properties
  const notStartedTopics = computed(() => 
    topics.value.filter(t => t.status === 'not_started')
  )

  const inProgressTopics = computed(() => 
    topics.value.filter(t => t.status === 'in_progress')
  )

  const completedTopics = computed(() => 
    topics.value.filter(t => t.status === 'completed')
  )

  const pausedTopics = computed(() => 
    topics.value.filter(t => t.status === 'paused')
  )

  // Group topics by category
  const topicsByCategory = computed(() => {
    const grouped = {}
    topics.value.forEach(topic => {
      const categoryName = topic.category || 'General'
      if (!grouped[categoryName]) {
        grouped[categoryName] = []
      }
      grouped[categoryName].push(topic)
    })
    return grouped
  })

  // Get categories list
  const categories = computed(() => {
    const cats = new Set()
    topics.value.forEach(topic => {
      cats.add(topic.category || 'General')
    })
    return Array.from(cats).sort()
  })

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'not_started': '#9ca3af',
      'in_progress': '#3b82f6',
      'completed': '#10b981',
      'paused': '#f59e0b'
    }
    return colors[status] || colors.not_started
  }

  // Get difficulty color
  const getDifficultyColor = (difficulty) => {
    const colors = {
      'beginner': '#10b981',
      'intermediate': '#f59e0b',
      'advanced': '#ef4444'
    }
    return colors[difficulty] || colors.beginner
  }

  // Format duration
  const formatDuration = (minutes) => {
    if (!minutes) return '0 min'
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  return {
    // State
    topics,
    currentTopic,
    sessions,
    loading,
    error,
    
    // Methods
    fetchTopics,
    createTopic,
    getTopicDetails,
    updateTopic,
    deleteTopic,
    fetchSessions,
    fetchStats,
    
    // Computed
    notStartedTopics,
    inProgressTopics,
    completedTopics,
    pausedTopics,
    topicsByCategory,
    categories,
    
    // Helpers
    getStatusColor,
    getDifficultyColor,
    formatDuration
  }
}

