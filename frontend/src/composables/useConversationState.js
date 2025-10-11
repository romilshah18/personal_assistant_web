import { ref } from 'vue'

// Global state for active conversation
const isConversationActive = ref(false)
const activeConversationCleanup = ref(null)

export function useConversationState() {
  const setConversationActive = (active, cleanupFn = null) => {
    isConversationActive.value = active
    activeConversationCleanup.value = cleanupFn
  }

  const forceStopConversation = async () => {
    if (activeConversationCleanup.value) {
      try {
        await activeConversationCleanup.value()
      } catch (error) {
        console.error('Error stopping conversation:', error)
      }
    }
    isConversationActive.value = false
    activeConversationCleanup.value = null
  }

  return {
    isConversationActive,
    setConversationActive,
    forceStopConversation
  }
}

