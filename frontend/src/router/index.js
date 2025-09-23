import { createRouter, createWebHistory } from 'vue-router'
import MicScreen from '../views/MicScreen.vue'
import HistoryScreen from '../views/HistoryScreen.vue'
import SettingsScreen from '../views/SettingsScreen.vue'
import AuthScreen from '../views/AuthScreen.vue'
import { useAuth } from '../composables/useAuth'

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
  
  // Initialize auth state if not already done
  await initAuth()
  
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
