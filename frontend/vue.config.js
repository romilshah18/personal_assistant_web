const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  pwa: {
    name: 'Personal Assistant',
    short_name: 'Assistant',
    description: 'AI-powered personal assistant with voice interaction',
    theme_color: '#4A90E2',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      {
        src: 'img/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: 'img/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ],
    workboxPluginMode: 'GenerateSW',
    workboxOptions: {
      skipWaiting: true,
      clientsClaim: true,
      runtimeCaching: [
        {
          urlPattern: new RegExp('^https://api\\.openai\\.com/'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            networkTimeoutSeconds: 10
          }
        }
      ]
    }
  },
  devServer: {
    port: 8080,
    host: '0.0.0.0',
    allowedHosts: 'all',
    https: true,
    client: {
      webSocketURL: 'wss://0.0.0.0:8080/ws'
    }
  }
})
