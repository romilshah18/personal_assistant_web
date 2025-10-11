<template>
  <div id="app">
    <router-view />
    <TabNavigation v-if="showTabNavigation" />
  </div>
</template>

<script>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TabNavigation from './components/TabNavigation.vue'

export default {
  name: 'App',
  components: {
    TabNavigation
  },
  setup() {
    const route = useRoute()
    
    // Show tab navigation on all screens except auth
    const showTabNavigation = computed(() => {
      return route.name !== 'AuthScreen'
    })
    
    return {
      showTabNavigation
    }
  }
}
</script>

<style>
/* Global CSS Custom Properties for Theme Colors */
:root {
  /* Primary Background Colors */
  --bg-primary: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  --bg-light: #f8f9fa;
  --bg-medium: #e9ecef;
  
  /* Text Colors */
  --text-primary: #333;
  --text-secondary: #666;
  --text-muted: #999;
  --text-light: rgba(255, 255, 255, 0.9);
  
  /* Surface Colors */
  --surface-primary: rgba(255, 255, 255, 0.7);
  --surface-secondary: rgba(0, 0, 0, 0.05);
  --surface-hover: rgba(0, 0, 0, 0.1);
  --surface-active: rgba(0, 0, 0, 0.15);
  
  /* Border Colors */
  --border-light: rgba(0, 0, 0, 0.1);
  --border-medium: rgba(0, 0, 0, 0.15);
  
  /* Accent Colors */
  --accent-primary: #667eea;
  --accent-success: #2ed573;
  --accent-warning: #ffa726;
  --accent-error: #ff6b6b;
  
  /* Button Colors */
  --btn-primary-bg: var(--surface-secondary);
  --btn-primary-hover: var(--surface-hover);
  --btn-primary-text: var(--text-secondary);
  
  /* Shadow Colors */
  --shadow-light: rgba(0, 0, 0, 0.1);
  --shadow-medium: rgba(0, 0, 0, 0.15);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: var(--bg-primary);
  min-height: 100vh;
  overflow-x: hidden;
}

#app {
  min-height: 100vh;
  position: relative;
  width: 100%;
}
</style>
