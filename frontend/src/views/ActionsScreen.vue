<template>
  <div class="actions-screen">
    <!-- Status Bar -->
    <div class="status-bar">
      <div class="time">{{ currentTime }}</div>
      <div class="status-icons">
        <div class="connection-status connected"></div>
      </div>
    </div>

    <!-- Header -->
    <div class="header">
      <h1 class="page-title">Actions</h1>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="coming-soon">
        <div class="icon">⚡</div>
        <h2>Quick Actions</h2>
        <p>Perform common tasks and automations with ease</p>
        <div class="subtitle">Coming Soon</div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'

export default {
  name: 'ActionsScreen',
  setup() {
    const currentTime = ref('')

    // Update time
    const updateTime = () => {
      const now = new Date()
      currentTime.value = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    let timeInterval

    onMounted(() => {
      updateTime()
      timeInterval = setInterval(updateTime, 1000)
    })

    onUnmounted(() => {
      if (timeInterval) {
        clearInterval(timeInterval)
      }
    })

    return {
      currentTime
    }
  }
}
</script>

<style scoped>
.actions-screen {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
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
  background: #2ed573;
  transition: background 0.3s ease;
}

.header {
  padding: 40px 20px 20px;
  text-align: center;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.main-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.coming-soon {
  text-align: center;
  max-width: 300px;
}

.icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.coming-soon h2 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 12px 0;
}

.coming-soon p {
  font-size: 16px;
  opacity: 0.8;
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.subtitle {
  font-size: 14px;
  opacity: 0.6;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
  border-radius: 20px;
  display: inline-block;
}
</style>
