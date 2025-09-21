<template>
  <div class="auth-screen">
    <!-- Status Bar -->
    <div class="status-bar">
      <div class="time">{{ currentTime }}</div>
      <div class="status-icons">
        <div class="connection-status connected"></div>
      </div>
    </div>

    <!-- Header -->
    <div class="header">
      <h1 class="app-title">Personal Assistant</h1>
      <p class="subtitle">{{ isSignUp ? 'Create your account' : 'Sign in to continue' }}</p>
    </div>

    <!-- Auth Form -->
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-tabs">
          <button 
            class="tab-button"
            :class="{ active: !isSignUp }"
            @click="switchToSignIn"
          >
            Sign In
          </button>
          <button 
            class="tab-button"
            :class="{ active: isSignUp }"
            @click="switchToSignUp"
          >
            Sign Up
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="auth-form">
          <!-- Full Name (Sign Up only) -->
          <div class="form-group" v-if="isSignUp">
            <label for="fullName">Full Name</label>
            <input
              id="fullName"
              v-model="fullName"
              type="text"
              placeholder="Enter your full name"
              :disabled="isLoading"
            />
          </div>

          <!-- Email -->
          <div class="form-group">
            <label for="email">Email Address</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="Enter your email"
              required
              :disabled="isLoading"
            />
          </div>

          <!-- Password -->
          <div class="form-group">
            <label for="password">Password</label>
            <div class="password-input">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Enter your password"
                required
                :disabled="isLoading"
                :minlength="isSignUp ? 6 : undefined"
              />
              <button
                type="button"
                class="password-toggle"
                @click="togglePasswordVisibility"
                :disabled="isLoading"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
              </button>
            </div>
            <div class="password-hint" v-if="isSignUp">
              Password must be at least 6 characters long
            </div>
          </div>

          <!-- Error Message -->
          <div class="error-message" v-if="error">
            {{ error }}
          </div>

          <!-- Success Message -->
          <div class="success-message" v-if="successMessage">
            {{ successMessage }}
          </div>

          <!-- Submit Button -->
          <button 
            type="submit" 
            class="submit-button"
            :disabled="isLoading || !isFormValid"
          >
            <div class="button-content">
              <div class="spinner" v-if="isLoading"></div>
              <span>{{ isLoading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In') }}</span>
            </div>
          </button>
        </form>

        <!-- Additional Actions -->
        <div class="auth-footer">
          <p v-if="!isSignUp">
            Don't have an account? 
            <button class="link-button" @click="switchToSignUp">Sign up here</button>
          </p>
          <p v-else>
            Already have an account? 
            <button class="link-button" @click="switchToSignIn">Sign in here</button>
          </p>
        </div>
      </div>
    </div>

    <!-- Features Section -->
    <div class="features-section">
      <h3>What you can do:</h3>
      <div class="features-list">
        <div class="feature-item">
          <div class="feature-icon">🎤</div>
          <span>Voice conversations with AI</span>
        </div>
        <div class="feature-item">
          <div class="feature-icon">📧</div>
          <span>Connect Gmail accounts</span>
        </div>
        <div class="feature-item">
          <div class="feature-icon">📅</div>
          <span>Manage your calendar</span>
        </div>
        <div class="feature-item">
          <div class="feature-icon">🔒</div>
          <span>Secure data storage</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'AuthScreen',
  setup() {
    const router = useRouter()
    const { signUp, signIn, isLoading, error, clearError, isAuthenticated } = useAuth()

    const currentTime = ref('')
    const isSignUp = ref(false)
    const email = ref('')
    const password = ref('')
    const fullName = ref('')
    const showPassword = ref(false)
    const successMessage = ref('')

    // Computed properties
    const isFormValid = computed(() => {
      if (!email.value || !password.value) return false
      if (isSignUp.value && password.value.length < 6) return false
      return true
    })

    // Update time
    const updateTime = () => {
      const now = new Date()
      currentTime.value = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    // Switch between sign in and sign up
    const switchToSignIn = () => {
      isSignUp.value = false
      clearForm()
      clearError()
      successMessage.value = ''
    }

    const switchToSignUp = () => {
      isSignUp.value = true
      clearForm()
      clearError()
      successMessage.value = ''
    }

    // Clear form
    const clearForm = () => {
      email.value = ''
      password.value = ''
      fullName.value = ''
      showPassword.value = false
    }

    // Toggle password visibility
    const togglePasswordVisibility = () => {
      showPassword.value = !showPassword.value
    }

    // Handle form submission
    const handleSubmit = async () => {
      if (!isFormValid.value) return

      clearError()
      successMessage.value = ''

      try {
        if (isSignUp.value) {
          const result = await signUp(email.value, password.value, fullName.value)
          successMessage.value = result.message
          // Switch to sign in after successful signup
          setTimeout(() => {
            switchToSignIn()
            successMessage.value = ''
          }, 3000)
        } else {
          await signIn(email.value, password.value)
          // Redirect to main app after successful sign in
          router.push('/')
        }
      } catch (err) {
        // Error is already set in the auth composable
        console.error('Auth error:', err)
      }
    }

    let timeInterval

    onMounted(() => {
      updateTime()
      timeInterval = setInterval(updateTime, 1000)

      // Redirect if already authenticated
      if (isAuthenticated.value) {
        router.push('/')
      }
    })

    onUnmounted(() => {
      if (timeInterval) {
        clearInterval(timeInterval)
      }
    })

    return {
      currentTime,
      isSignUp,
      email,
      password,
      fullName,
      showPassword,
      successMessage,
      isFormValid,
      isLoading,
      error,
      switchToSignIn,
      switchToSignUp,
      togglePasswordVisibility,
      handleSubmit
    }
  }
}
</script>

<style scoped>
.auth-screen {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  flex-direction: column;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.1);
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
  text-align: center;
  padding: 40px 20px 20px;
}

.app-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.subtitle {
  font-size: 16px;
  opacity: 0.8;
  font-weight: 400;
}

.auth-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
}

.auth-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 30px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.auth-tabs {
  display: flex;
  margin-bottom: 30px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 4px;
}

.tab-button {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  color: white;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-button.active {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.9;
}

.form-group input {
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  color: white;
  font-size: 16px;
  transition: all 0.3s ease;
}

.form-group input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.form-group input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.15);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.password-input {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.password-toggle:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.password-toggle svg {
  width: 20px;
  height: 20px;
}

.password-hint {
  font-size: 12px;
  opacity: 0.7;
  margin-top: 4px;
}

.error-message {
  background: rgba(255, 107, 107, 0.2);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
}

.success-message {
  background: rgba(46, 213, 115, 0.2);
  border: 1px solid rgba(46, 213, 115, 0.3);
  color: #2ed573;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
}

.submit-button {
  padding: 16px;
  border: none;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 10px;
}

.submit-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.button-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.auth-footer {
  text-align: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.auth-footer p {
  font-size: 14px;
  opacity: 0.8;
  margin: 0;
}

.link-button {
  background: none;
  border: none;
  color: white;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  margin-left: 4px;
}

.link-button:hover {
  opacity: 0.8;
}

.features-section {
  padding: 20px;
  text-align: center;
}

.features-section h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  opacity: 0.9;
}

.features-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  max-width: 600px;
  margin: 0 auto;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.feature-icon {
  font-size: 20px;
}

.feature-item span {
  font-size: 14px;
  font-weight: 500;
}

/* Mobile Responsiveness */
@media (max-width: 480px) {
  .auth-card {
    margin: 10px;
    padding: 24px;
  }
  
  .app-title {
    font-size: 24px;
  }
  
  .features-list {
    grid-template-columns: 1fr;
  }
}
</style>
