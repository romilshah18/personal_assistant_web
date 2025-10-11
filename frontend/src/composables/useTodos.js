import { ref, computed } from 'vue'
import { useAuth } from './useAuth'

export function useTodos() {
  const { getAuthHeaders } = useAuth()
  const API_URL = process.env.VUE_APP_API_URL || 'http://localhost:3001'
  
  const todos = ref([])
  const categories = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Fetch todos with optional filters
  async function fetchTodos(filters = {}) {
    loading.value = true
    error.value = null
    
    try {
      const queryParams = new URLSearchParams()
      if (filters.status) queryParams.append('status', filters.status)
      if (filters.category_id) queryParams.append('category_id', filters.category_id)
      if (filters.limit) queryParams.append('limit', filters.limit)
      
      const response = await fetch(`${API_URL}/api/tools/todo_actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          action: 'list',
          args: filters
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch todos')
      }

      const data = await response.json()
      todos.value = data.todos || []
      return data.todos
    } catch (err) {
      console.error('Error fetching todos:', err)
      error.value = err.message
      return []
    } finally {
      loading.value = false
    }
  }

  // Create new todo
  async function createTodo(todoData) {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`${API_URL}/api/tools/todo_actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          action: 'create',
          args: todoData
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create todo')
      }

      const data = await response.json()
      
      // Add to local list
      if (data.todo) {
        todos.value.unshift(data.todo)
      }
      
      return data
    } catch (err) {
      console.error('Error creating todo:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update existing todo
  async function updateTodo(todoId, updates) {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`${API_URL}/api/tools/todo_actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          action: 'update',
          args: {
            todo_id: todoId,
            ...updates
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update todo')
      }

      const data = await response.json()
      
      // Update in local list
      if (data.todo) {
        const index = todos.value.findIndex(t => t.id === todoId)
        if (index !== -1) {
          todos.value[index] = data.todo
        }
      }
      
      return data
    } catch (err) {
      console.error('Error updating todo:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // Mark todo as complete
  async function completeTodo(todoId) {
    return updateTodo(todoId, { status: 'done' })
  }

  // Delete todo
  async function deleteTodo(todoId) {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`${API_URL}/api/tools/todo_actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          action: 'delete',
          args: { todo_id: todoId }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete todo')
      }

      // Remove from local list
      todos.value = todos.value.filter(t => t.id !== todoId)
      
      return await response.json()
    } catch (err) {
      console.error('Error deleting todo:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch categories
  async function fetchCategories() {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`${API_URL}/api/todos/categories`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }

      const data = await response.json()
      categories.value = data.categories || []
      return data.categories
    } catch (err) {
      console.error('Error fetching categories:', err)
      error.value = err.message
      return []
    } finally {
      loading.value = false
    }
  }

  // Create new category
  async function createCategory(categoryData) {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`${API_URL}/api/todos/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(categoryData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create category')
      }

      const data = await response.json()
      
      // Add to local list
      if (data.category) {
        categories.value.push(data.category)
      }
      
      return data
    } catch (err) {
      console.error('Error creating category:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update category
  async function updateCategory(categoryId, updates) {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`${API_URL}/api/todos/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update category')
      }

      const data = await response.json()
      
      // Update in local list
      if (data.category) {
        const index = categories.value.findIndex(c => c.id === categoryId)
        if (index !== -1) {
          categories.value[index] = data.category
        }
      }
      
      return data
    } catch (err) {
      console.error('Error updating category:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // Delete category
  async function deleteCategory(categoryId) {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`${API_URL}/api/todos/categories/${categoryId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete category')
      }

      // Remove from local list
      categories.value = categories.value.filter(c => c.id !== categoryId)
      
      return await response.json()
    } catch (err) {
      console.error('Error deleting category:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // Get todo statistics
  async function fetchStats() {
    try {
      const response = await fetch(`${API_URL}/api/todos/stats`, {
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
  const todoTodos = computed(() => 
    todos.value.filter(t => t.status === 'todo')
  )

  const inProgressTodos = computed(() => 
    todos.value.filter(t => t.status === 'in_progress')
  )

  const doneTodos = computed(() => 
    todos.value.filter(t => t.status === 'done')
  )

  const todayTodos = computed(() => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    
    return todos.value.filter(t => {
      if (!t.due_date || t.status === 'done') return false
      const dueDate = new Date(t.due_date)
      return dueDate >= startOfDay && dueDate <= today
    })
  })

  const overdueTodos = computed(() => {
    const now = new Date()
    return todos.value.filter(t => {
      if (!t.due_date || t.status === 'done') return false
      return new Date(t.due_date) < now
    })
  })

  const upcomingTodos = computed(() => {
    const now = new Date()
    const weekFromNow = new Date()
    weekFromNow.setDate(weekFromNow.getDate() + 7)
    
    return todos.value.filter(t => {
      if (!t.due_date || t.status === 'done') return false
      const dueDate = new Date(t.due_date)
      return dueDate > now && dueDate <= weekFromNow
    })
  })

  // Group todos by category
  const todosByCategory = computed(() => {
    const grouped = {}
    todos.value.forEach(todo => {
      const categoryName = todo.category?.name || 'Uncategorized'
      if (!grouped[categoryName]) {
        grouped[categoryName] = []
      }
      grouped[categoryName].push(todo)
    })
    return grouped
  })

  return {
    // State
    todos,
    categories,
    loading,
    error,
    
    // Methods
    fetchTodos,
    createTodo,
    updateTodo,
    completeTodo,
    deleteTodo,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    fetchStats,
    
    // Computed
    todoTodos,
    inProgressTodos,
    doneTodos,
    todayTodos,
    overdueTodos,
    upcomingTodos,
    todosByCategory
  }
}

