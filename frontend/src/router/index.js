import { createRouter, createWebHistory } from 'vue-router'
import MicScreen from '../views/MicScreen.vue'
import HistoryScreen from '../views/HistoryScreen.vue'
import SettingsScreen from '../views/SettingsScreen.vue'
import AuthScreen from '../views/AuthScreen.vue'
import TodoScreen from '../views/TodoScreen.vue'
import LearningScreen from '../views/LearningScreen.vue'
import ActionsScreen from '../views/ActionsScreen.vue'
import { useAuth } from '../composables/useAuth'
import { useConversationState } from '../composables/useConversationState'

const routes = [
  {
    path: '/auth',
    name: 'AuthScreen',
    component: AuthScreen,
    meta: { requiresGuest: true }
  },
  {
    path: '/',
    name: 'MicScreen',
    component: MicScreen,
    meta: { requiresAuth: true }
  },
  {
    path: '/todo',
    name: 'TodoScreen',
    component: TodoScreen,
    meta: { requiresAuth: true }
  },
  {
    path: '/learning',
    name: 'LearningScreen',
    component: LearningScreen,
    meta: { requiresAuth: true }
  },
  {
    path: '/actions',
    name: 'ActionsScreen',
    component: ActionsScreen,
    meta: { requiresAuth: true }
  },
  {
    path: '/history',
    name: 'HistoryScreen',
    component: HistoryScreen
  },
  {
    path: '/settings',
    name: 'SettingsScreen',
    component: SettingsScreen,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

// Route guards
router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, initAuth } = useAuth()
  const { isConversationActive, forceStopConversation } = useConversationState()
  
  // Initialize auth state if not already done
  await initAuth()
  
  // Check if trying to navigate away from MicScreen while conversation is active
  if (from.name === 'MicScreen' && to.name !== 'MicScreen' && isConversationActive.value) {
    const confirmed = window.confirm(
      '⚠️ You are currently in an active conversation!\n\n' +
      'Navigating away will stop your current session with the assistant.\n\n' +
      'Do you want to stop the conversation and proceed?'
    )
    
    if (!confirmed) {
      // User chose to stay, cancel navigation
      next(false)
      return
    } else {
      // User confirmed, stop the conversation and proceed
      await forceStopConversation()
      // Continue with navigation
    }
  }
  
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresGuest = to.matched.some(record => record.meta.requiresGuest)
  
  if (requiresAuth && !isAuthenticated.value) {
    // Redirect to auth if authentication is required
    next('/auth')
  } else if (requiresGuest && isAuthenticated.value) {
    // Redirect to home if already authenticated and trying to access auth page
    next('/')
  } else {
    next()
  }
})

export default router
