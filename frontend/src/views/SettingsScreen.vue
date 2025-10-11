<template>
  <div class="settings-screen">
    <!-- Status Bar -->
    <div class="status-bar">
      <div class="time">{{ currentTime }}</div>
      <div class="status-icons">
        <div class="connection-status" :class="{ connected: isConnected }"></div>
      </div>
    </div>

    <!-- Header -->
    <div class="header">
      <h1 class="page-title">Settings</h1>
      <button class="logout-button" @click="handleLogout" title="Sign Out">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
        </svg>
      </button>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Google Integration Section -->
      <div class="settings-section">
        <div class="section-header">
          <div class="section-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <div class="section-info">
            <h2>Google Integration</h2>
            <p>Connect your Google accounts for email and calendar access</p>
          </div>
        </div>

        <!-- Google OAuth Status -->
        <div class="oauth-status" v-if="!googleConfigured">
          <div class="status-card error">
            <div class="status-icon">⚠️</div>
            <div class="status-text">
              <h3>Google OAuth Not Configured</h3>
              <p>Please configure Google OAuth credentials in the backend environment variables.</p>
            </div>
          </div>
        </div>

        <!-- Connected Accounts -->
        <div class="connected-accounts" v-if="googleConfigured">
          <div class="accounts-header">
            <h3>Connected Accounts ({{ googleAccounts.length }})</h3>
            <button 
              class="add-account-btn" 
              @click="connectGoogleAccount"
              :disabled="isConnecting"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              {{ isConnecting ? 'Connecting...' : 'Add Account' }}
            </button>
          </div>

          <!-- Account List -->
          <div class="account-list" v-if="googleAccounts.length > 0">
            <div 
              class="account-card" 
              v-for="account in googleAccounts" 
              :key="account.id"
            >
              <div class="account-info">
                <img 
                  :src="account.picture" 
                  :alt="account.name"
                  class="account-avatar"
                  @error="handleImageError"
                >
                <div class="account-details">
                  <h4>{{ account.name }}</h4>
                  <p>{{ account.email }}</p>
                  <span class="connected-date">
                    Connected {{ formatDate(account.connectedAt) }}
                  </span>
                </div>
              </div>
              <div class="account-actions">
                <button 
                  class="test-btn"
                  @click="testAccount(account.id)"
                  :disabled="testingAccounts.has(account.id)"
                >
                  {{ testingAccounts.has(account.id) ? 'Testing...' : 'Test' }}
                </button>
                <button 
                  class="disconnect-btn"
                  @click="disconnectAccount(account.id)"
                  :disabled="disconnectingAccounts.has(account.id)"
                >
                  {{ disconnectingAccounts.has(account.id) ? 'Removing...' : 'Remove' }}
                </button>
              </div>
            </div>
          </div>

          <!-- No Accounts -->
          <div class="no-accounts" v-else>
            <div class="empty-state">
              <div class="empty-icon">📧</div>
              <h3>No Google Accounts Connected</h3>
              <p>Connect your Google accounts to enable email and calendar features in your personal assistant.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Permissions Section -->
      <div class="settings-section">
        <div class="section-header">
          <div class="section-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
          </div>
          <div class="section-info">
            <h2>Permissions</h2>
            <p>Manage app permissions and access</p>
          </div>
        </div>

        <div class="permission-list">
          <div class="permission-item">
            <div class="permission-info">
              <h4>Gmail Access</h4>
              <p>Read and send emails on your behalf</p>
            </div>
            <div class="permission-status granted">
              <span>Granted via Google OAuth</span>
            </div>
          </div>
          <div class="permission-item">
            <div class="permission-info">
              <h4>Calendar Access</h4>
              <p>Read and manage your calendar events</p>
            </div>
            <div class="permission-status granted">
              <span>Granted via Google OAuth</span>
            </div>
          </div>
          <div class="permission-item">
            <div class="permission-info">
              <h4>Microphone Access</h4>
              <p>Record audio for voice assistant functionality</p>
            </div>
            <div class="permission-status" :class="{ 
              granted: hasPermission, 
              denied: permissionDenied, 
              pending: !hasPermission && !permissionDenied 
            }">
              <span v-if="hasPermission">Granted</span>
              <span v-else-if="permissionDenied">Denied</span>
              <span v-else>Not requested</span>
              <button 
                v-if="hasPermission || permissionDenied" 
                class="reset-permission-btn"
                @click="resetMicrophonePermission"
                title="Reset microphone permission"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Success/Error Messages -->
    <div class="toast" v-if="toast.show" :class="toast.type">
      <div class="toast-content">
        <div class="toast-icon">
          {{ toast.type === 'success' ? '✅' : '❌' }}
        </div>
        <span>{{ toast.message }}</span>
      </div>
    </div>

    <!-- Test Results Modal -->
    <div class="modal-overlay" v-if="testResults" @click="closeTestResults">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>API Test Results</h2>
          <button class="close-btn" @click="closeTestResults">×</button>
        </div>
        <div class="modal-body">
          <div class="test-result">
            <h3>{{ testResults.email }}</h3>
            
            <div class="api-section">
              <h4>📧 Gmail Access</h4>
              <div class="api-details">
                <p><strong>Email:</strong> {{ testResults.gmail.emailAddress }}</p>
                <p><strong>Total Messages:</strong> {{ testResults.gmail.messagesTotal }}</p>
                <p><strong>Total Threads:</strong> {{ testResults.gmail.threadsTotal }}</p>
              </div>
            </div>

            <div class="api-section">
              <h4>📅 Calendar Access</h4>
              <div class="api-details">
                <p><strong>Calendars:</strong> {{ testResults.calendar.calendarsCount }}</p>
                <div class="calendar-list" v-if="testResults.calendar.calendars.length > 0">
                  <div 
                    class="calendar-item" 
                    v-for="cal in testResults.calendar.calendars" 
                    :key="cal.id"
                  >
                    <span class="calendar-name">{{ cal.summary }}</span>
                    <span class="calendar-badge" v-if="cal.primary">Primary</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useAudioService } from '../composables/useAudioService'

export default {
  name: 'SettingsScreen',
  setup() {
    const router = useRouter()
    const { apiRequest, user, signOut } = useAuth()
    const { hasPermission, permissionDenied, resetPermissions } = useAudioService()
    const currentTime = ref('')
    const isConnected = ref(true) // Assume connected for settings
    const googleConfigured = ref(false)
    const googleAccounts = ref([])
    const isConnecting = ref(false)
    const testingAccounts = ref(new Set())
    const disconnectingAccounts = ref(new Set())
    const testResults = ref(null)
    const toast = ref({
      show: false,
      type: 'success',
      message: ''
    })

    const API_BASE = process.env.NODE_ENV === 'production' 
      ? 'https://personalassistantweb-production.up.railway.app' 
      : 'http://localhost:3001'

    // Update time
    const updateTime = () => {
      const now = new Date()
      currentTime.value = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    // Go back to main screen - no longer needed with tab navigation
    // const goBack = () => {
    //   router.push('/')
    // }

    // Show toast message
    const showToast = (message, type = 'success') => {
      toast.value = { show: true, message, type }
      setTimeout(() => {
        toast.value.show = false
      }, 3000)
    }

    // Format date
    const formatDate = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }

    // Handle image error
    const handleImageError = (event) => {
      event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFNUU3RUIiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik0xMiAxMkM5Ljc5IDEyIDggMTAuMjEgOCA4UzEwLjIxIDQgMTIgNFMxNiA1Ljc5IDE2IDhTMTQuMjEgMTIgMTIgMTJaTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyUzYuNDggMjIgMTIgMjJTMjIgMTcuNTIgMjIgMTJTMTcuNTIgMiAxMiAyWk0xMiAyMEMxMC4xOSAyMCA4LjQxIDE5LjE5IDcuMjYgMTcuNzNDNy4xMSAxNy4zOSA3LjI2IDE2Ljk1IDcuNjggMTYuODZDOS4yMiAxNi40OSAxMC42IDE2IDEyIDE2UzE0Ljc4IDE2LjQ5IDE2LjMyIDE2Ljg2QzE2Ljc0IDE2Ljk1IDE2Ljg5IDE3LjM5IDE2Ljc0IDE3LjczQzE1LjU5IDE5LjE5IDEzLjgxIDIwIDEyIDIwWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4KPC9zdmc+Cg=='
    }

    // Check configuration
    const checkConfiguration = async () => {
      try {
        const response = await apiRequest('/api/check-config')
        const config = await response.json()
        googleConfigured.value = config.hasGoogleOAuth
      } catch (error) {
        console.error('Error checking configuration:', error)
        googleConfigured.value = false
      }
    }

    // Load Google accounts
    const loadGoogleAccounts = async () => {
      try {
        const response = await apiRequest('/api/google/accounts')
        const data = await response.json()
        googleAccounts.value = data.accounts || []
      } catch (error) {
        console.error('Error loading Google accounts:', error)
        showToast('Failed to load Google accounts', 'error')
      }
    }

    // Connect Google account
    const connectGoogleAccount = async () => {
      if (isConnecting.value) return
      
      isConnecting.value = true
      try {
        const response = await apiRequest('/api/google/auth')
        const data = await response.json()
        
        if (data.authUrl) {
          // Open OAuth flow in new window
          const popup = window.open(
            data.authUrl,
            'google-oauth',
            'width=500,height=600,scrollbars=yes,resizable=yes'
          )

          // Poll for popup close
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed)
              isConnecting.value = false
              // Reload accounts after OAuth flow
              setTimeout(() => {
                loadGoogleAccounts()
              }, 1000)
            }
          }, 1000)
        } else {
          throw new Error('No auth URL received')
        }
      } catch (error) {
        console.error('Error initiating Google OAuth:', error)
        showToast('Failed to initiate Google connection', 'error')
        isConnecting.value = false
      }
    }

    // Test account
    const testAccount = async (accountId) => {
      if (testingAccounts.value.has(accountId)) return

      testingAccounts.value.add(accountId)
      try {
        const response = await apiRequest(`/api/google/accounts/${accountId}/test`)
        const data = await response.json()
        
        if (data.success) {
          testResults.value = data
        } else {
          showToast(data.error || 'API test failed', 'error')
        }
      } catch (error) {
        console.error('Error testing account:', error)
        showToast('Failed to test API access', 'error')
      } finally {
        testingAccounts.value.delete(accountId)
      }
    }

    // Disconnect account
    const disconnectAccount = async (accountId) => {
      if (disconnectingAccounts.value.has(accountId)) return

      const account = googleAccounts.value.find(acc => acc.id === accountId)
      if (!account) return

      if (!confirm(`Are you sure you want to disconnect ${account.email}?`)) {
        return
      }

      disconnectingAccounts.value.add(accountId)
      try {
        const response = await apiRequest(`/api/google/accounts/${accountId}`, {
          method: 'DELETE'
        })
        const data = await response.json()
        
        if (data.success) {
          showToast(`Disconnected ${account.email}`, 'success')
          await loadGoogleAccounts()
        } else {
          showToast(data.error || 'Failed to disconnect account', 'error')
        }
      } catch (error) {
        console.error('Error disconnecting account:', error)
        showToast('Failed to disconnect account', 'error')
      } finally {
        disconnectingAccounts.value.delete(accountId)
      }
    }

    // Close test results modal
    const closeTestResults = () => {
      testResults.value = null
    }

    // Reset microphone permission
    const resetMicrophonePermission = () => {
      if (confirm('This will reset your microphone permission. You will be prompted to grant permission again on your next visit. Continue?')) {
        resetPermissions()
        showToast('Microphone permission reset', 'success')
      }
    }

    // Handle logout
    const handleLogout = async () => {
      if (confirm('Are you sure you want to sign out?')) {
        await signOut()
        router.push('/auth')
      }
    }

    let timeInterval

    onMounted(async () => {
      updateTime()
      timeInterval = setInterval(updateTime, 1000)
      
      // Check for OAuth callback params first
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('connected') === 'true') {
        const email = urlParams.get('email')
        showToast(`Successfully connected ${decodeURIComponent(email)}`, 'success')
        // Clean up URL
        router.replace('/settings')
      } else if (urlParams.get('error')) {
        const errorType = urlParams.get('error')
        let errorMessage = 'Failed to connect Google account'
        
        if (errorType === 'auth_failed') {
          errorMessage = 'Google authentication failed. Please try again.'
        }
        
        showToast(errorMessage, 'error')
        // Clean up URL
        router.replace('/settings')
      }
      
      await checkConfiguration()
      if (googleConfigured.value) {
        await loadGoogleAccounts()
      }
    })

    onUnmounted(() => {
      if (timeInterval) {
        clearInterval(timeInterval)
      }
    })

    return {
      currentTime,
      isConnected,
      googleConfigured,
      googleAccounts,
      isConnecting,
      testingAccounts,
      disconnectingAccounts,
      testResults,
      toast,
      hasPermission,
      permissionDenied,
      formatDate,
      handleImageError,
      connectGoogleAccount,
      testAccount,
      disconnectAccount,
      closeTestResults,
      resetMicrophonePermission,
      handleLogout
    }
  }
}
</script>

<style scoped>
.settings-screen {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  padding-bottom: 80px; /* Space for tab navigation */
}

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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  gap: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  flex: 1;
  text-align: center;
  color: var(--text-primary);
}

.logout-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--surface-secondary);
  backdrop-filter: blur(10px);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.logout-button:hover {
  background: rgba(255, 107, 107, 0.2);
  transform: scale(1.05);
  color: var(--accent-error);
}

.logout-button svg {
  width: 20px;
  height: 20px;
}

.main-content {
  flex: 1;
  padding: 0 20px 20px;
  overflow-y: auto;
}

.settings-section {
  background: var(--surface-primary);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid var(--border-light);
  margin-bottom: 20px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  border-bottom: 1px solid var(--surface-secondary);
}

.section-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--surface-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.section-icon svg {
  width: 24px;
  height: 24px;
}

.section-info h2 {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px 0;
}

.section-info p {
  font-size: 14px;
  opacity: 0.8;
  margin: 0;
}

.oauth-status {
  padding: 24px;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
}

.status-card.error {
  background: rgba(255, 107, 107, 0.2);
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.status-icon {
  font-size: 24px;
}

.status-text h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.status-text p {
  font-size: 14px;
  opacity: 0.8;
  margin: 0;
}

.connected-accounts {
  padding: 24px;
}

.accounts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.accounts-header h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.add-account-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--surface-secondary);
  backdrop-filter: blur(10px);
  border: none;
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.add-account-btn:hover:not(:disabled) {
  background: var(--surface-hover);
  transform: translateY(-1px);
}

.add-account-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.add-account-btn svg {
  width: 16px;
  height: 16px;
}

.account-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.account-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--surface-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-light);
}

.account-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.account-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.account-details h4 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.account-details p {
  font-size: 14px;
  opacity: 0.8;
  margin: 0 0 4px 0;
}

.connected-date {
  font-size: 12px;
  opacity: 0.6;
}

.account-actions {
  display: flex;
  gap: 8px;
}

.test-btn, .disconnect-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.test-btn {
  background: var(--accent-success);
  color: var(--text-light);
}

.test-btn:hover:not(:disabled) {
  background: rgba(46, 213, 115, 0.9);
}

.disconnect-btn {
  background: var(--accent-error);
  color: var(--text-light);
}

.disconnect-btn:hover:not(:disabled) {
  background: rgba(255, 107, 107, 0.9);
}

.test-btn:disabled, .disconnect-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Permission styles */
.permission-list {
  padding: 24px;
}

.permission-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--surface-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-light);
  margin-bottom: 12px;
}

.permission-item:last-child {
  margin-bottom: 0;
}

.permission-info h4 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.permission-info p {
  font-size: 14px;
  opacity: 0.8;
  margin: 0;
}

.permission-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.permission-status.granted {
  color: var(--accent-success);
}

.permission-status.denied {
  color: var(--accent-error);
}

.permission-status.pending {
  color: var(--accent-warning);
}

.reset-permission-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  background: var(--surface-secondary);
  color: var(--text-secondary);
  transition: all 0.3s ease;
}

.reset-permission-btn:hover {
  background: var(--surface-hover);
}

.no-accounts {
  text-align: center;
  padding: 40px 20px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.6;
}

.empty-state h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.empty-state p {
  font-size: 14px;
  opacity: 0.8;
  margin: 0;
  max-width: 300px;
  line-height: 1.5;
}

.permission-list {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.permission-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.permission-info h4 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.permission-info p {
  font-size: 14px;
  opacity: 0.8;
  margin: 0;
}

.permission-status {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.permission-status.granted {
  background: rgba(46, 213, 115, 0.2);
  color: #2ed573;
  border: 1px solid rgba(46, 213, 115, 0.3);
}

.toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  padding: 16px 20px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: slideUp 0.3s ease-out;
}

.toast.success {
  background: rgba(46, 213, 115, 0.9);
  color: white;
}

.toast.error {
  background: rgba(255, 107, 107, 0.9);
  color: white;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toast-icon {
  font-size: 16px;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
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
  max-width: 500px;
  width: 100%;
  color: #333;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h2 {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: #333;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f5f5f5;
  color: #666;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: #e0e0e0;
}

.test-result h3 {
  color: #333;
  margin-bottom: 20px;
}

.api-section {
  margin-bottom: 20px;
}

.api-section h4 {
  color: #555;
  margin-bottom: 12px;
  font-size: 16px;
}

.api-details p {
  margin: 8px 0;
  color: #666;
}

.calendar-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calendar-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.calendar-name {
  color: #333;
  font-weight: 500;
}

.calendar-badge {
  background: #667eea;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

/* Mobile Responsiveness */
@media (max-width: 480px) {
  .main-content {
    padding: 0 16px 16px;
  }
  
  .section-header {
    padding: 20px;
  }
  
  .connected-accounts, .permission-list {
    padding: 20px;
  }
  
  .accounts-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .account-card {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .account-actions {
    justify-content: stretch;
  }
  
  .test-btn, .disconnect-btn {
    flex: 1;
  }
  
  .modal {
    margin: 20px;
    padding: 24px;
  }
}
</style>
