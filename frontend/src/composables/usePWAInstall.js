import { ref } from 'vue'

export function usePWAInstall() {
  const isInstallable = ref(false)
  const isInstalled = ref(false)
  const showInstallPrompt = ref(false)
  let deferredPrompt = null

  // Check if app is already installed
  const checkInstallStatus = () => {
    // Check if running in standalone mode (installed)
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      isInstalled.value = true
      return
    }

    // Check if running in PWA mode
    if (window.navigator && window.navigator.standalone) {
      isInstalled.value = true
      return
    }

    // Check for related applications
    if ('getInstalledRelatedApps' in navigator) {
      navigator.getInstalledRelatedApps().then(apps => {
        if (apps.length > 0) {
          isInstalled.value = true
        }
      })
    }
  }

  // Listen for install prompt
  const setupInstallPrompt = () => {
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('PWA install prompt available')
      e.preventDefault()
      deferredPrompt = e
      isInstallable.value = true
      showInstallPrompt.value = true
    })

    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully')
      isInstalled.value = true
      isInstallable.value = false
      showInstallPrompt.value = false
      deferredPrompt = null
    })
  }

  // Trigger install prompt
  const installApp = async () => {
    if (!deferredPrompt) {
      console.log('No install prompt available')
      return false
    }

    try {
      // Show the install prompt
      deferredPrompt.prompt()
      
      // Wait for user choice
      const { outcome } = await deferredPrompt.userChoice
      
      console.log(`User ${outcome} the install prompt`)
      
      if (outcome === 'accepted') {
        isInstalled.value = true
      }
      
      // Clear the deferred prompt
      deferredPrompt = null
      isInstallable.value = false
      showInstallPrompt.value = false
      
      return outcome === 'accepted'
    } catch (error) {
      console.error('Error during app installation:', error)
      return false
    }
  }

  // Hide install prompt
  const hideInstallPrompt = () => {
    showInstallPrompt.value = false
  }

  // Check if PWA features are supported
  const isPWASupported = () => {
    return 'serviceWorker' in navigator && 'PushManager' in window
  }

  // Get install instructions for different browsers
  const getInstallInstructions = () => {
    const userAgent = navigator.userAgent.toLowerCase()
    
    if (userAgent.includes('chrome') && userAgent.includes('mobile')) {
      return {
        browser: 'Chrome Mobile',
        steps: [
          'Tap the menu button (3 dots) in Chrome',
          'Select "Add to Home screen"',
          'Tap "Add" to install'
        ]
      }
    } else if (userAgent.includes('safari') && userAgent.includes('mobile')) {
      return {
        browser: 'Safari iOS',
        steps: [
          'Tap the Share button in Safari',
          'Scroll down and tap "Add to Home Screen"',
          'Tap "Add" to install'
        ]
      }
    } else if (userAgent.includes('chrome')) {
      return {
        browser: 'Chrome Desktop',
        steps: [
          'Look for the install icon in the address bar',
          'Or use Chrome menu → "Install Personal Assistant"',
          'Click "Install" to add to your apps'
        ]
      }
    } else {
      return {
        browser: 'Other Browser',
        steps: [
          'Look for "Add to Home Screen" or "Install" option',
          'Usually found in the browser menu',
          'Follow the prompts to install'
        ]
      }
    }
  }

  // Initialize
  const init = () => {
    checkInstallStatus()
    setupInstallPrompt()
  }

  return {
    isInstallable,
    isInstalled,
    showInstallPrompt,
    installApp,
    hideInstallPrompt,
    isPWASupported,
    getInstallInstructions,
    init
  }
}
