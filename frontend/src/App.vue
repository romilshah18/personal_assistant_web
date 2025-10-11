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
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  overflow-x: hidden;
}

#app {
  min-height: 100vh;
  position: relative;
  width: 100%;
}
</style>
