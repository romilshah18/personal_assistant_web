<template>
  <div class="todo-screen">
    <!-- Status Bar -->
    <div class="status-bar">
      <div class="time">{{ currentTime }}</div>
      <div class="status-icons">
        <div class="badge" v-if="stats">{{ stats.todo + stats.in_progress }}</div>
      </div>
    </div>

    <!-- Header -->
    <div class="header">
      <h1 class="page-title">To Do List</h1>
      <button class="add-btn" @click="showAddModal = true" :disabled="loading">
        <span class="add-icon">+</span>
        <span>Add Todo</span>
      </button>
    </div>

    <!-- Stats Overview -->
    <div class="stats-overview" v-if="stats">
      <div class="stat-card" :class="{ alert: stats.overdue > 0 }">
        <div class="stat-value">{{ stats.overdue }}</div>
        <div class="stat-label">Overdue</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.due_today }}</div>
        <div class="stat-label">Due Today</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.in_progress }}</div>
        <div class="stat-label">In Progress</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">{{ stats.done }}</div>
        <div class="stat-label">Done</div>
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
        :key="category.id"
        class="category-chip"
        :class="{ active: selectedCategory === category.id }"
        :style="{ borderColor: category.color }"
        @click="selectedCategory = category.id"
      >
        <span>{{ category.icon }}</span>
        <span>{{ category.name }}</span>
      </button>
    </div>

    <!-- Loading State -->
    <div class="loading-state" v-if="loading && todos.length === 0">
      <div class="spinner"></div>
      <p>Loading todos...</p>
    </div>

    <!-- Empty State -->
    <div class="empty-state" v-else-if="!loading && filteredTodos.length === 0">
      <div class="empty-icon">✨</div>
      <h3>No todos found</h3>
      <p v-if="activeFilter !== 'all'">No {{ activeFilter }} todos at the moment.</p>
      <p v-else-if="selectedCategory">No todos in this category.</p>
      <p v-else>Start by adding your first todo!</p>
      <button class="primary-btn" @click="showAddModal = true">
        Add Your First Todo
      </button>
    </div>

    <!-- Todo List -->
    <div class="todo-list" v-else>
      <div 
        v-for="todo in filteredTodos" 
        :key="todo.id"
        class="todo-card"
        :class="{ 
          done: todo.status === 'done',
          overdue: isOverdue(todo),
          'in-progress': todo.status === 'in_progress'
        }"
      >
        <div class="todo-header">
          <button 
            class="checkbox"
            :class="{ checked: todo.status === 'done' }"
            @click="toggleComplete(todo)"
          >
            <span v-if="todo.status === 'done'">✓</span>
          </button>
          
          <div class="todo-content">
            <div class="todo-title">{{ todo.title }}</div>
            <div class="todo-meta">
              <span v-if="todo.category" class="category-badge" :style="{ color: todo.category.color }">
                {{ todo.category.icon }} {{ todo.category.name }}
              </span>
              <span v-if="todo.due_date" class="due-date" :class="{ overdue: isOverdue(todo) }">
                📅 {{ formatDate(todo.due_date) }}
              </span>
              <span v-if="todo.priority" class="priority" :class="`priority-${todo.priority}`">
                {{ getPriorityIcon(todo.priority) }}
              </span>
            </div>
            <div v-if="todo.description" class="todo-description">
              {{ todo.description }}
            </div>
          </div>

          <div class="todo-actions">
            <button class="icon-btn" @click="editTodo(todo)" title="Edit">
              ✏️
            </button>
            <button class="icon-btn delete" @click="confirmDelete(todo)" title="Delete">
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div class="modal-overlay" v-if="showAddModal || editingTodo" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ editingTodo ? 'Edit Todo' : 'Add New Todo' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>Title *</label>
            <input 
              v-model="todoForm.title" 
              type="text" 
              placeholder="What needs to be done?"
              class="form-input"
              @keyup.enter="saveTodo"
            />
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea 
              v-model="todoForm.description" 
              placeholder="Add more details..."
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Category</label>
              <select v-model="todoForm.category_id" class="form-select">
                <option :value="null">Select category</option>
                <option 
                  v-for="category in categories" 
                  :key="category.id"
                  :value="category.id"
                >
                  {{ category.icon }} {{ category.name }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>Priority</label>
              <select v-model="todoForm.priority" class="form-select">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Due Date</label>
            <input 
              v-model="todoForm.due_date" 
              type="datetime-local" 
              class="form-input"
            />
          </div>

          <div class="form-group" v-if="editingTodo">
            <label>Status</label>
            <select v-model="todoForm.status" class="form-select">
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button class="secondary-btn" @click="closeModal">Cancel</button>
          <button 
            class="primary-btn" 
            @click="saveTodo"
            :disabled="!todoForm.title || saving"
          >
            {{ saving ? 'Saving...' : (editingTodo ? 'Update' : 'Add') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div class="modal-overlay" v-if="deletingTodo" @click.self="deletingTodo = null">
      <div class="modal small">
        <div class="modal-header">
          <h2>Delete Todo</h2>
          <button class="close-btn" @click="deletingTodo = null">✕</button>
        </div>
        
        <div class="modal-body">
          <p>Are you sure you want to delete <strong>"{{ deletingTodo.title }}"</strong>?</p>
          <p class="warning">This action cannot be undone.</p>
        </div>

        <div class="modal-footer">
          <button class="secondary-btn" @click="deletingTodo = null">Cancel</button>
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
import { useTodos } from '../composables/useTodos'

export default {
  name: 'TodoScreen',
  setup() {
    const currentTime = ref('')
    const {
      todos,
      categories,
      loading,
      fetchTodos,
      createTodo,
      updateTodo,
      deleteTodo,
      fetchCategories,
      fetchStats
    } = useTodos()

    const stats = ref(null)
    const activeFilter = ref('active')
    const selectedCategory = ref(null)
    const showAddModal = ref(false)
    const editingTodo = ref(null)
    const deletingTodo = ref(null)
    const saving = ref(false)
    const toast = ref({ show: false, message: '', type: 'success' })

    const todoForm = ref({
      title: '',
      description: '',
      category_id: null,
      priority: 'medium',
      due_date: '',
      status: 'todo'
    })

    const filters = [
      { label: 'Active', value: 'active' },
      { label: 'All', value: 'all' },
      { label: 'Completed', value: 'done' }
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

    // Filtered todos based on active filter and category
    const filteredTodos = computed(() => {
      let filtered = todos.value

      // Filter by status
      if (activeFilter.value === 'active') {
        filtered = filtered.filter(t => t.status !== 'done')
      } else if (activeFilter.value === 'done') {
        filtered = filtered.filter(t => t.status === 'done')
      }

      // Filter by category
      if (selectedCategory.value) {
        filtered = filtered.filter(t => t.category?.id === selectedCategory.value)
      }

      // Sort: overdue first, then by due date, then by priority
      return filtered.sort((a, b) => {
        const aOverdue = isOverdue(a)
        const bOverdue = isOverdue(b)
        
        if (aOverdue && !bOverdue) return -1
        if (!aOverdue && bOverdue) return 1
        
        if (a.due_date && b.due_date) {
          return new Date(a.due_date) - new Date(b.due_date)
        }
        if (a.due_date) return -1
        if (b.due_date) return 1
        
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })
    })

    // Check if todo is overdue
    const isOverdue = (todo) => {
      if (!todo.due_date || todo.status === 'done') return false
      return new Date(todo.due_date) < new Date()
    }

    // Format date
    const formatDate = (dateString) => {
      const date = new Date(dateString)
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const isToday = date.toDateString() === today.toDateString()
      const isTomorrow = date.toDateString() === tomorrow.toDateString()

      if (isToday) return 'Today'
      if (isTomorrow) return 'Tomorrow'
      
      const options = { month: 'short', day: 'numeric' }
      if (date.getFullYear() !== today.getFullYear()) {
        options.year = 'numeric'
      }
      
      return date.toLocaleDateString('en-US', options)
    }

    // Get priority icon
    const getPriorityIcon = (priority) => {
      return { low: '🔵', medium: '🟡', high: '🔴' }[priority] || '🟡'
    }

    // Set filter
    const setFilter = (filter) => {
      activeFilter.value = filter
    }

    // Toggle todo completion
    const toggleComplete = async (todo) => {
      try {
        const newStatus = todo.status === 'done' ? 'todo' : 'done'
        await updateTodo(todo.id, { status: newStatus })
        
        if (newStatus === 'done') {
          showToast('Todo completed! 🎉', 'success')
        } else {
          showToast('Todo marked as incomplete', 'info')
        }
        
        // Refresh stats
        await loadStats()
      } catch (err) {
        showToast('Failed to update todo', 'error')
      }
    }

    // Edit todo
    const editTodo = (todo) => {
      editingTodo.value = todo
      todoForm.value = {
        title: todo.title,
        description: todo.description || '',
        category_id: todo.category?.id || null,
        priority: todo.priority || 'medium',
        due_date: todo.due_date ? new Date(todo.due_date).toISOString().slice(0, 16) : '',
        status: todo.status
      }
    }

    // Save todo (create or update)
    const saveTodo = async () => {
      if (!todoForm.value.title.trim()) return

      saving.value = true
      
      try {
        const todoData = {
          title: todoForm.value.title.trim(),
          description: todoForm.value.description?.trim() || null,
          category_id: todoForm.value.category_id,
          priority: todoForm.value.priority,
          due_date: todoForm.value.due_date ? new Date(todoForm.value.due_date).toISOString() : null
        }

        if (editingTodo.value) {
          todoData.status = todoForm.value.status
          await updateTodo(editingTodo.value.id, todoData)
          showToast('Todo updated successfully', 'success')
        } else {
          await createTodo(todoData)
          showToast('Todo created successfully', 'success')
        }

        closeModal()
        await loadStats()
      } catch (err) {
        showToast(err.message || 'Failed to save todo', 'error')
      } finally {
        saving.value = false
      }
    }

    // Confirm delete
    const confirmDelete = (todo) => {
      deletingTodo.value = todo
    }

    // Handle delete
    const handleDelete = async () => {
      if (!deletingTodo.value) return

      saving.value = true
      
      try {
        await deleteTodo(deletingTodo.value.id)
        showToast('Todo deleted', 'success')
        deletingTodo.value = null
        await loadStats()
      } catch (err) {
        showToast('Failed to delete todo', 'error')
      } finally {
        saving.value = false
      }
    }

    // Close modal
    const closeModal = () => {
      showAddModal.value = false
      editingTodo.value = null
      todoForm.value = {
        title: '',
        description: '',
        category_id: null,
        priority: 'medium',
        due_date: '',
        status: 'todo'
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
        fetchTodos(),
        fetchCategories(),
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
      todos,
      categories,
      loading,
      stats,
      activeFilter,
      selectedCategory,
      showAddModal,
      editingTodo,
      deletingTodo,
      saving,
      todoForm,
      filters,
      filteredTodos,
      toast,
      isOverdue,
      formatDate,
      getPriorityIcon,
      setFilter,
      toggleComplete,
      editTodo,
      saveTodo,
      confirmDelete,
      handleDelete,
      closeModal,
      showToast
    }
  }
}
</script>

<style scoped>
.todo-screen {
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
  background: #3b82f6;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
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

.stat-card.alert {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  color: white;
}

.stat-card.success {
  background: linear-gradient(135deg, #2ed573 0%, #17c964 100%);
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
  display: flex;
  align-items: center;
  gap: 6px;
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
  border-color: currentColor;
  background: var(--bg-primary);
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
  border-top-color: #667eea;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* Todo List */
.todo-list {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.todo-card {
  background: var(--surface-secondary);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.todo-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-light);
}

.todo-card.done {
  opacity: 0.6;
}

.todo-card.overdue {
  border-color: #ff6b6b;
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.1) 0%, rgba(238, 90, 111, 0.1) 100%);
}

.todo-card.in-progress {
  border-color: #feca57;
}

.todo-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.checkbox {
  width: 24px;
  height: 24px;
  border: 2px solid var(--text-secondary);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s ease;
  color: white;
  font-size: 14px;
  font-weight: 700;
}

.checkbox:hover {
  border-color: #667eea;
}

.checkbox.checked {
  background: linear-gradient(135deg, #2ed573 0%, #17c964 100%);
  border-color: #2ed573;
}

.todo-content {
  flex: 1;
  min-width: 0;
}

.todo-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
  word-wrap: break-word;
}

.todo-card.done .todo-title {
  text-decoration: line-through;
  opacity: 0.6;
}

.todo-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}

.category-badge {
  padding: 4px 10px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 8px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.due-date {
  padding: 4px 10px;
  background: rgba(254, 202, 87, 0.1);
  color: #feca57;
  border-radius: 8px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.due-date.overdue {
  background: rgba(255, 107, 107, 0.1);
  color: #ff6b6b;
}

.priority {
  font-size: 14px;
}

.todo-description {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-top: 8px;
}

.todo-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
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
  background: rgba(255, 107, 107, 0.1);
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
  color: #ff6b6b;
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
  border-color: #667eea;
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
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
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
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
}

.primary-btn:disabled,
.danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
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
  background: linear-gradient(135deg, #2ed573 0%, #17c964 100%);
  color: white;
}

.toast.error {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
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

  .form-row {
    grid-template-columns: 1fr;
  }

  .modal {
    max-height: 95vh;
  }

  .todo-actions {
    flex-direction: column;
  }
}
</style>
