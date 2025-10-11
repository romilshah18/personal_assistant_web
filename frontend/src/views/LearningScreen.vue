<template>
  <div class="learning-screen">
    <!-- Status Bar -->
    <div class="status-bar">
      <div class="time">{{ currentTime }}</div>
      <div class="status-icons">
        <div class="badge" v-if="stats">{{ stats.in_progress }}</div>
      </div>
    </div>

    <!-- Header -->
    <div class="header">
      <h1 class="page-title">Learning Hub</h1>
      <button class="add-btn" @click="showAddModal = true" :disabled="loading">
        <span class="add-icon">+</span>
        <span>New Topic</span>
      </button>
    </div>

    <!-- Stats Overview -->
    <div class="stats-overview" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.in_progress }}</div>
        <div class="stat-label">In Progress</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">{{ stats.completed }}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_topics }}</div>
        <div class="stat-label">Total Topics</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ formatDuration(stats.total_learning_time) }}</div>
        <div class="stat-label">Time Spent</div>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <button 
        v-for="filter in filters" 
        :key="filter.value"
        class="filter-tab"
        :class="{ active: activeFilter === filter.value }"
        @click="setFilter(filter.value)"
      >
        {{ filter.label }}
      </button>
    </div>

    <!-- Category Filter -->
    <div class="category-filter" v-if="categories.length > 0">
      <button 
        class="category-chip"
        :class="{ active: !selectedCategory }"
        @click="selectedCategory = null"
      >
        All
      </button>
      <button 
        v-for="category in categories" 
        :key="category"
        class="category-chip"
        :class="{ active: selectedCategory === category }"
        @click="selectedCategory = category"
      >
        {{ category }}
      </button>
    </div>

    <!-- Loading State -->
    <div class="loading-state" v-if="loading && topics.length === 0">
      <div class="spinner"></div>
      <p>Loading topics...</p>
    </div>

    <!-- Empty State -->
    <div class="empty-state" v-else-if="!loading && filteredTopics.length === 0">
      <div class="empty-icon">📚</div>
      <h3>No learning topics found</h3>
      <p v-if="activeFilter !== 'all'">No {{ activeFilter }} topics at the moment.</p>
      <p v-else-if="selectedCategory">No topics in this category.</p>
      <p v-else>Start your learning journey by adding a new topic!</p>
      <button class="primary-btn" @click="showAddModal = true">
        Start Learning
      </button>
    </div>

    <!-- Topics Grid -->
    <div class="topics-grid" v-else>
      <div 
        v-for="topic in filteredTopics" 
        :key="topic.id"
        class="topic-card"
        :class="topic.status"
        @click="viewTopicDetails(topic)"
      >
        <div class="topic-header">
          <div class="topic-title">{{ topic.title }}</div>
          <button 
            class="icon-btn delete" 
            @click.stop="confirmDelete(topic)"
            title="Delete"
          >
            🗑️
          </button>
        </div>

        <div class="topic-description" v-if="topic.description">
          {{ topic.description }}
        </div>

        <div class="topic-meta">
          <span class="badge" :style="{ backgroundColor: getStatusColor(topic.status) }">
            {{ formatStatus(topic.status) }}
          </span>
          <span class="badge" :style="{ backgroundColor: getDifficultyColor(topic.difficulty_level) }">
            {{ topic.difficulty_level }}
          </span>
          <span class="category-badge">
            {{ topic.category }}
          </span>
        </div>

        <div class="progress-section" v-if="topic.status !== 'not_started'">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: `${topic.progress_percentage || 0}%` }"
            ></div>
          </div>
          <div class="progress-text">{{ topic.progress_percentage || 0 }}% Complete</div>
        </div>

        <div class="topic-stats">
          <div class="stat-item">
            <span>📝</span>
            <span>{{ topic.total_sessions || 0 }} sessions</span>
          </div>
          <div class="stat-item">
            <span>⏱️</span>
            <span>{{ formatDuration(topic.total_duration_minutes) }}</span>
          </div>
        </div>

        <div class="topic-footer">
          <div class="last-accessed" v-if="topic.last_accessed_at">
            Last: {{ formatDate(topic.last_accessed_at) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Topic Modal -->
    <div class="modal-overlay" v-if="showAddModal || editingTopic" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ editingTopic ? 'Edit Topic' : 'New Learning Topic' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>Topic Title *</label>
            <input 
              v-model="topicForm.title" 
              type="text" 
              placeholder="e.g., Python Programming"
              class="form-input"
              @keyup.enter="saveTopic"
            />
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea 
              v-model="topicForm.description" 
              placeholder="What do you want to learn?"
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Category</label>
              <select v-model="topicForm.category" class="form-select">
                <option value="General">General</option>
                <option value="Programming">Programming</option>
                <option value="Language">Language</option>
                <option value="Music">Music</option>
                <option value="Science">Science</option>
                <option value="Business">Business</option>
                <option value="Art">Art</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div class="form-group">
              <label>Difficulty</label>
              <select v-model="topicForm.difficulty_level" class="form-select">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Estimated Duration</label>
            <input 
              v-model="topicForm.estimated_duration" 
              type="text" 
              placeholder="e.g., 2 weeks, 1 month"
              class="form-input"
            />
          </div>

          <div class="form-group" v-if="editingTopic">
            <label>Status</label>
            <select v-model="topicForm.status" class="form-select">
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div class="form-group" v-if="editingTopic">
            <label>Progress (%)</label>
            <input 
              v-model.number="topicForm.progress_percentage" 
              type="number" 
              min="0"
              max="100"
              class="form-input"
            />
          </div>
        </div>

        <div class="modal-footer">
          <button class="secondary-btn" @click="closeModal">Cancel</button>
          <button 
            class="primary-btn" 
            @click="saveTopic"
            :disabled="!topicForm.title || saving"
          >
            {{ saving ? 'Saving...' : (editingTopic ? 'Update' : 'Create') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Topic Details Modal -->
    <div class="modal-overlay" v-if="viewingTopic" @click.self="viewingTopic = null">
      <div class="modal large">
        <div class="modal-header">
          <h2>{{ viewingTopic.title }}</h2>
          <button class="close-btn" @click="viewingTopic = null">✕</button>
        </div>
        
        <div class="modal-body">
          <div class="topic-details">
            <div class="detail-section">
              <h3>Overview</h3>
              <p class="description">{{ viewingTopic.description || 'No description' }}</p>
              
              <div class="detail-badges">
                <span class="badge" :style="{ backgroundColor: getStatusColor(viewingTopic.status) }">
                  {{ formatStatus(viewingTopic.status) }}
                </span>
                <span class="badge" :style="{ backgroundColor: getDifficultyColor(viewingTopic.difficulty_level) }">
                  {{ viewingTopic.difficulty_level }}
                </span>
                <span class="category-badge">{{ viewingTopic.category }}</span>
              </div>
            </div>

            <div class="detail-section" v-if="viewingTopic.status !== 'not_started'">
              <h3>Progress</h3>
              <div class="progress-bar large">
                <div 
                  class="progress-fill" 
                  :style="{ width: `${viewingTopic.progress_percentage || 0}%` }"
                ></div>
              </div>
              <div class="progress-text">{{ viewingTopic.progress_percentage || 0 }}% Complete</div>
              
              <div class="stats-row">
                <div class="stat-item">
                  <strong>Sessions:</strong> {{ viewingTopic.total_sessions || 0 }}
                </div>
                <div class="stat-item">
                  <strong>Time Spent:</strong> {{ formatDuration(viewingTopic.total_duration_minutes) }}
                </div>
              </div>
            </div>

            <div class="detail-section" v-if="viewingTopic.current_section">
              <h3>Current Section</h3>
              <p>{{ viewingTopic.current_section }}</p>
            </div>

            <div class="detail-section" v-if="viewingTopic.last_session_summary">
              <h3>Last Session Summary</h3>
              <p>{{ viewingTopic.last_session_summary }}</p>
            </div>

            <div class="detail-section" v-if="viewingTopic.next_steps">
              <h3>Next Steps</h3>
              <p>{{ viewingTopic.next_steps }}</p>
            </div>

            <div class="detail-section" v-if="viewingTopic.key_concepts_learned && viewingTopic.key_concepts_learned.length > 0">
              <h3>Key Concepts Learned</h3>
              <div class="concepts-list">
                <span 
                  v-for="(concept, index) in viewingTopic.key_concepts_learned" 
                  :key="index"
                  class="concept-tag"
                >
                  {{ concept }}
                </span>
              </div>
            </div>

            <div class="detail-section" v-if="viewingSessions.length > 0">
              <h3>Learning Sessions ({{ viewingSessions.length }})</h3>
              <div class="sessions-list">
                <div 
                  v-for="session in viewingSessions" 
                  :key="session.id"
                  class="session-item"
                >
                  <div class="session-header">
                    <strong>Session {{ session.session_number }}</strong>
                    <span class="session-date">{{ formatDate(session.started_at) }}</span>
                  </div>
                  <div class="session-duration" v-if="session.duration_minutes">
                    ⏱️ {{ session.duration_minutes }} min
                  </div>
                  <div class="session-summary" v-if="session.conversation_summary">
                    {{ session.conversation_summary }}
                  </div>
                  <div class="session-concepts" v-if="session.concepts_covered && session.concepts_covered.length > 0">
                    <strong>Covered:</strong> {{ session.concepts_covered.join(', ') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="secondary-btn" @click="editTopicFromView">Edit Topic</button>
          <button class="primary-btn" @click="viewingTopic = null">Close</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div class="modal-overlay" v-if="deletingTopic" @click.self="deletingTopic = null">
      <div class="modal small">
        <div class="modal-header">
          <h2>Delete Learning Topic</h2>
          <button class="close-btn" @click="deletingTopic = null">✕</button>
        </div>
        
        <div class="modal-body">
          <p>Are you sure you want to delete <strong>"{{ deletingTopic.title }}"</strong>?</p>
          <p class="warning">This will delete all sessions and progress. This action cannot be undone.</p>
        </div>

        <div class="modal-footer">
          <button class="secondary-btn" @click="deletingTopic = null">Cancel</button>
          <button 
            class="danger-btn" 
            @click="handleDelete"
            :disabled="saving"
          >
            {{ saving ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <div class="toast" v-if="toast.show" :class="toast.type">
      {{ toast.message }}
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useLearning } from '../composables/useLearning'

export default {
  name: 'LearningScreen',
  setup() {
    const currentTime = ref('')
    const {
      topics,
      loading,
      categories,
      fetchTopics,
      createTopic,
      getTopicDetails,
      updateTopic,
      deleteTopic,
      fetchStats,
      getStatusColor,
      getDifficultyColor,
      formatDuration
    } = useLearning()

    const stats = ref(null)
    const activeFilter = ref('all')
    const selectedCategory = ref(null)
    const showAddModal = ref(false)
    const editingTopic = ref(null)
    const viewingTopic = ref(null)
    const viewingSessions = ref([])
    const deletingTopic = ref(null)
    const saving = ref(false)
    const toast = ref({ show: false, message: '', type: 'success' })

    const topicForm = ref({
      title: '',
      description: '',
      category: 'General',
      difficulty_level: 'beginner',
      estimated_duration: '',
      status: 'not_started',
      progress_percentage: 0
    })

    const filters = [
      { label: 'All', value: 'all' },
      { label: 'In Progress', value: 'in_progress' },
      { label: 'Completed', value: 'completed' },
      { label: 'Not Started', value: 'not_started' }
    ]

    // Update time
    const updateTime = () => {
      const now = new Date()
      currentTime.value = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    // Filtered topics based on active filter and category
    const filteredTopics = computed(() => {
      let filtered = topics.value

      // Filter by status
      if (activeFilter.value !== 'all') {
        filtered = filtered.filter(t => t.status === activeFilter.value)
      }

      // Filter by category
      if (selectedCategory.value) {
        filtered = filtered.filter(t => t.category === selectedCategory.value)
      }

      // Sort: in_progress first, then by last accessed
      return filtered.sort((a, b) => {
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1
        if (a.status !== 'in_progress' && b.status === 'in_progress') return 1
        
        const aDate = new Date(a.last_accessed_at || a.created_at)
        const bDate = new Date(b.last_accessed_at || b.created_at)
        return bDate - aDate
      })
    })

    // Format status
    const formatStatus = (status) => {
      const labels = {
        'not_started': 'Not Started',
        'in_progress': 'In Progress',
        'completed': 'Completed',
        'paused': 'Paused'
      }
      return labels[status] || status
    }

    // Format date
    const formatDate = (dateString) => {
      const date = new Date(dateString)
      const today = new Date()
      const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays} days ago`
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    // Set filter
    const setFilter = (filter) => {
      activeFilter.value = filter
    }

    // View topic details
    const viewTopicDetails = async (topic) => {
      try {
        const data = await getTopicDetails(topic.id)
        viewingTopic.value = data.topic
        viewingSessions.value = data.sessions || []
      } catch (err) {
        showToast('Failed to load topic details', 'error')
      }
    }

    // Edit topic
    const editTopic = (topic) => {
      editingTopic.value = topic
      topicForm.value = {
        title: topic.title,
        description: topic.description || '',
        category: topic.category || 'General',
        difficulty_level: topic.difficulty_level || 'beginner',
        estimated_duration: topic.estimated_duration || '',
        status: topic.status || 'not_started',
        progress_percentage: topic.progress_percentage || 0
      }
    }

    // Edit from view modal
    const editTopicFromView = () => {
      editTopic(viewingTopic.value)
      viewingTopic.value = null
    }

    // Save topic (create or update)
    const saveTopic = async () => {
      if (!topicForm.value.title.trim()) return

      saving.value = true
      
      try {
        const topicData = {
          title: topicForm.value.title.trim(),
          description: topicForm.value.description?.trim() || null,
          category: topicForm.value.category,
          difficulty_level: topicForm.value.difficulty_level,
          estimated_duration: topicForm.value.estimated_duration?.trim() || null
        }

        if (editingTopic.value) {
          topicData.status = topicForm.value.status
          topicData.progress_percentage = topicForm.value.progress_percentage
          await updateTopic(editingTopic.value.id, topicData)
          showToast('Topic updated successfully', 'success')
        } else {
          await createTopic(topicData)
          showToast('Topic created successfully! Start learning via voice assistant.', 'success')
        }

        closeModal()
        await loadStats()
      } catch (err) {
        showToast(err.message || 'Failed to save topic', 'error')
      } finally {
        saving.value = false
      }
    }

    // Confirm delete
    const confirmDelete = (topic) => {
      deletingTopic.value = topic
    }

    // Handle delete
    const handleDelete = async () => {
      if (!deletingTopic.value) return

      saving.value = true
      
      try {
        await deleteTopic(deletingTopic.value.id)
        showToast('Topic deleted', 'success')
        deletingTopic.value = null
        await loadStats()
      } catch (err) {
        showToast('Failed to delete topic', 'error')
      } finally {
        saving.value = false
      }
    }

    // Close modal
    const closeModal = () => {
      showAddModal.value = false
      editingTopic.value = null
      topicForm.value = {
        title: '',
        description: '',
        category: 'General',
        difficulty_level: 'beginner',
        estimated_duration: '',
        status: 'not_started',
        progress_percentage: 0
      }
    }

    // Show toast notification
    const showToast = (message, type = 'success') => {
      toast.value = { show: true, message, type }
      setTimeout(() => {
        toast.value.show = false
      }, 3000)
    }

    // Load stats
    const loadStats = async () => {
      stats.value = await fetchStats()
    }

    // Initialize
    let timeInterval
    onMounted(async () => {
      updateTime()
      timeInterval = setInterval(updateTime, 1000)
      
      await Promise.all([
        fetchTopics(),
        loadStats()
      ])
    })

    onUnmounted(() => {
      if (timeInterval) {
        clearInterval(timeInterval)
      }
    })

    return {
      currentTime,
      topics,
      categories,
      loading,
      stats,
      activeFilter,
      selectedCategory,
      showAddModal,
      editingTopic,
      viewingTopic,
      viewingSessions,
      deletingTopic,
      saving,
      topicForm,
      filters,
      filteredTopics,
      toast,
      formatStatus,
      formatDate,
      formatDuration,
      getStatusColor,
      getDifficultyColor,
      setFilter,
      viewTopicDetails,
      editTopic,
      editTopicFromView,
      saveTopic,
      confirmDelete,
      handleDelete,
      closeModal,
      showToast
    }
  }
}
</script>

<style scoped>
.learning-screen {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  padding-bottom: 80px;
}

/* Status Bar */
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 600;
  background: var(--surface-secondary);
  color: var(--text-secondary);
}

.status-icons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  background: #8b5cf6;
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
}

/* Header */
.header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
  flex: 1;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.add-icon {
  font-size: 20px;
  font-weight: 700;
}

/* Stats Overview */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 0 20px 20px;
}

.stat-card {
  background: var(--surface-secondary);
  padding: 16px;
  border-radius: 12px;
  text-align: center;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-light);
}

.stat-card.success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Filter Tabs */
.filter-tabs {
  display: flex;
  gap: 8px;
  padding: 0 20px 16px;
  border-bottom: 1px solid var(--surface-secondary);
}

.filter-tab {
  padding: 8px 20px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.filter-tab:hover {
  background: var(--surface-secondary);
}

.filter-tab.active {
  background: var(--surface-secondary);
  color: var(--text-primary);
}

/* Category Filter */
.category-filter {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  overflow-x: auto;
  scrollbar-width: none;
}

.category-filter::-webkit-scrollbar {
  display: none;
}

.category-chip {
  padding: 8px 16px;
  background: var(--surface-secondary);
  border: 2px solid transparent;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.3s ease;
  color: var(--text-primary);
}

.category-chip:hover {
  transform: translateY(-2px);
}

.category-chip.active {
  border-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--surface-secondary);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.empty-state h3 {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

.empty-state p {
  font-size: 14px;
  margin: 8px 0;
  opacity: 0.7;
}

.primary-btn {
  margin-top: 20px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.primary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
}

/* Topics Grid */
.topics-grid {
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.topic-card {
  background: var(--surface-secondary);
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.topic-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px var(--shadow-light);
}

.topic-card.in_progress {
  border-color: #3b82f6;
}

.topic-card.completed {
  border-color: #10b981;
}

.topic-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.topic-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  flex: 1;
  word-break: break-word;
}

.topic-description {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.topic-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
}

.category-badge {
  padding: 4px 10px;
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  border-radius: 8px;
  font-weight: 600;
}

.progress-section {
  margin-top: 8px;
}

.progress-bar {
  height: 8px;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-bar.large {
  height: 12px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%);
  border-radius: 8px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}

.topic-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.topic-footer {
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid rgba(139, 92, 246, 0.1);
}

.last-accessed {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.icon-btn:hover {
  background: var(--bg-primary);
}

.icon-btn.delete:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: var(--bg-primary);
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
}

.modal.small {
  max-width: 400px;
}

.modal.large {
  max-width: 700px;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--surface-secondary);
}

.modal-header h2 {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--surface-secondary);
  border-radius: 8px;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
}

.modal-body .warning {
  color: #ef4444;
  font-size: 14px;
  margin-top: 8px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 12px;
  background: var(--surface-secondary);
  border: 2px solid transparent;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-primary);
  transition: all 0.3s ease;
  font-family: inherit;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: #8b5cf6;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid var(--surface-secondary);
}

.secondary-btn {
  padding: 10px 20px;
  background: var(--surface-secondary);
  color: var(--text-primary);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.secondary-btn:hover {
  background: var(--bg-primary);
}

.danger-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.danger-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.primary-btn:disabled,
.danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Topic Details */
.topic-details {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-section {
  padding: 16px;
  background: var(--surface-secondary);
  border-radius: 12px;
}

.detail-section h3 {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 12px 0;
  color: var(--text-primary);
}

.detail-section p {
  margin: 8px 0;
  line-height: 1.6;
  color: var(--text-secondary);
}

.description {
  font-size: 14px;
}

.detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

.concepts-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.concept-tag {
  padding: 6px 12px;
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.session-item {
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 8px;
  font-size: 13px;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.session-date {
  font-size: 11px;
  color: var(--text-secondary);
}

.session-duration {
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.session-summary {
  margin: 8px 0;
  line-height: 1.5;
  color: var(--text-primary);
}

.session-concepts {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 8px;
}

/* Toast Notification */
.toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: var(--surface-secondary);
  color: var(--text-primary);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 12px var(--shadow-light);
  animation: slideUp 0.3s ease;
  z-index: 2000;
  max-width: 90%;
}

.toast.success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.toast.error {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.toast.info {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

/* Responsive Design */
@media (max-width: 768px) {
  .stats-overview {
    grid-template-columns: repeat(2, 1fr);
  }

  .header {
    flex-direction: column;
    align-items: stretch;
  }

  .add-btn {
    justify-content: center;
  }

  .topics-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .modal {
    max-height: 95vh;
  }

  .modal.large {
    max-width: 100%;
  }
}
</style>
