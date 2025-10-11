<template>
  <div class="tab-navigation">
    <div class="tab-container">
      <button
        v-for="tab in tabs"
        :key="tab.name"
        class="tab-button"
        :class="{ active: currentRoute === tab.route }"
        @click="navigateToTab(tab.route)"
      >
        <div class="tab-icon" v-html="tab.icon"></div>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

export default {
  name: 'TabNavigation',
  setup() {
    const router = useRouter()
    const route = useRoute()

    const currentRoute = computed(() => route.name)

    const tabs = [
      {
        name: 'todo',
        label: 'To Do',
        route: 'TodoScreen',
        icon: `<svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
        </svg>`
      },
      {
        name: 'learning',
        label: 'Learning',
        route: 'LearningScreen',
        icon: `<svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12,3L1,9L12,15L21,10.09V17H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z"/>
        </svg>`
      },
      {
        name: 'mic',
        label: 'Mic',
        route: 'MicScreen',
        icon: `<svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>`
      },
      {
        name: 'actions',
        label: 'Actions',
        route: 'ActionsScreen',
        icon: `<svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M13,1.5L12,1L11,1.5L8.5,2.5L6,4.5L4.5,6L2.5,8.5L1.5,11L1,12L1.5,13L2.5,15.5L4.5,18L6,19.5L8.5,21.5L11,22.5L12,23L13,22.5L15.5,21.5L18,19.5L19.5,18L21.5,15.5L22.5,13L23,12L22.5,11L21.5,8.5L19.5,6L18,4.5L15.5,2.5L13,1.5M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M10,8V16L16,12L10,8Z"/>
        </svg>`
      },
      {
        name: 'settings',
        label: 'Settings',
        route: 'SettingsScreen',
        icon: `<svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
        </svg>`
      }
    ]

    const navigateToTab = (routeName) => {
      router.push({ name: routeName })
    }

    return {
      tabs,
      currentRoute,
      navigateToTab
    }
  }
}
</script>

<style scoped>
.tab-navigation {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface-primary);
  backdrop-filter: blur(20px);
  border-top: 1px solid var(--border-light);
  z-index: 100;
}

.tab-container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 8px 0 max(8px, env(safe-area-inset-bottom));
  max-width: 500px;
  margin: 0 auto;
}

.tab-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: var(--text-secondary);
  min-width: 60px;
  border-radius: 12px;
}

.tab-button:hover {
  background: var(--surface-secondary);
  transform: translateY(-1px);
}

.tab-button.active {
  color: var(--accent-primary);
  background: rgba(102, 126, 234, 0.1);
}

.tab-icon {
  width: 24px;
  height: 24px;
  margin-bottom: 4px;
  transition: transform 0.3s ease;
}

.tab-button.active .tab-icon {
  transform: scale(1.1);
}

.tab-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}

.tab-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}

/* iOS-style safe area handling */
@supports (padding: max(0px)) {
  .tab-container {
    padding-bottom: max(8px, env(safe-area-inset-bottom));
  }
}

/* Mobile responsiveness */
@media (max-width: 480px) {
  .tab-button {
    min-width: 50px;
    padding: 6px 8px;
  }
  
  .tab-icon {
    width: 20px;
    height: 20px;
  }
  
  .tab-label {
    font-size: 10px;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .tab-navigation {
    background: rgba(0, 0, 0, 0.9);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .tab-button {
    color: #999;
  }
  
  .tab-button:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .tab-button.active {
    color: #667eea;
    background: rgba(102, 126, 234, 0.2);
  }
}
</style>
