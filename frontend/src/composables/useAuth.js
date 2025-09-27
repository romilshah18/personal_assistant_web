import { ref, computed } from 'vue'

const API_BASE = process.env.NODE_ENV === 'production' 
  ? (process.env.VUE_APP_API_BASE || 'https://personalassistantweb-production.up.railway.app')
  : 'http://localhost:3001'

// Global auth state
const user = ref(null)
const token = ref(localStorage.getItem('auth_token'))
const isLoading = ref(false)
const error = ref('')

// Computed properties
const isAuthenticated = computed(() => !!user.value && !!token.value)

// Set auth header for requests
const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json'
  }
  
  if (token.value) {
    headers.Authorization = `Bearer ${token.value}`
  }
  
  return headers
}

// Make authenticated API request
const apiRequest = async (url, options = {}) => {
  const config = {
    headers: getAuthHeaders(),
    ...options
  }
  
  const response = await fetch(`${API_BASE}${url}`, config)
  
  if (response.status === 401) {
    // Token expired or invalid
    await signOut()
    throw new Error('Authentication expired. Please sign in again.')
  }
  
  return response
}

// Sign up function
const signUp = async (email, password, fullName = '') => {
  isLoading.value = true
  error.value = ''
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, fullName })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Sign up failed')
    }
    
    return { success: true, message: data.message }
  } catch (err) {
    error.value = err.message
    throw err
  } finally {
    isLoading.value = false
  }
}

// Sign in function
const signIn = async (email, password) => {
  isLoading.value = true
  error.value = ''
  
  try {
    console.log('Attempting sign in to:', `${API_BASE}/api/auth/signin`)
    const response = await fetch(`${API_BASE}/api/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Sign in failed')
    }
    
    // Store token and user data
    token.value = data.access_token
    user.value = data.user
    localStorage.setItem('auth_token', data.access_token)
    
    return { success: true, user: data.user }
  } catch (err) {
    console.error('Sign in error details:', err)
    
    // Handle different types of errors
    if (err.message.includes('Failed to fetch')) {
      error.value = 'Network error. Please check your internet connection and try again.'
    } else if (err.message.includes('CORS')) {
      error.value = 'Connection blocked. Please try refreshing the page.'
    } else {
      error.value = err.message
    }
    
    throw err
  } finally {
    isLoading.value = false
  }
}

// Sign out function
const signOut = async () => {
  isLoading.value = true
  
  try {
    if (token.value) {
      await apiRequest('/api/auth/signout', { method: 'POST' })
    }
  } catch (err) {
    console.error('Sign out error:', err)
  } finally {
    // Clear local state regardless of API call success
    user.value = null
    token.value = null
    localStorage.removeItem('auth_token')
    isLoading.value = false
  }
}

// Get current user profile
const getCurrentUser = async () => {
  if (!token.value) return null
  
  try {
    const response = await apiRequest('/api/auth/profile')
    const data = await response.json()
    
    if (response.ok) {
      user.value = data.user
      return data.user
    } else {
      throw new Error(data.error || 'Failed to get user profile')
    }
  } catch (err) {
    console.error('Get current user error:', err)
    await signOut()
    return null
  }
}

// Initialize auth state on app load
const initAuth = async () => {
  if (token.value) {
    await getCurrentUser()
  }
}

// Clear error
const clearError = () => {
  error.value = ''
}

export function useAuth() {
  return {
    // State
    user,
    token,
    isLoading,
    error,
    
    // Computed
    isAuthenticated,
    
    // Methods
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    initAuth,
    clearError,
    apiRequest,
    getAuthHeaders
  }
}
