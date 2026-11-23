import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      manifest: {
        name: 'Fluxi — Personal Finance',
        short_name: 'Fluxi',
        description: 'Reparte tu nómina en sobres y apunta tus gastos.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        // Mantener pulsado el icono de la app: «Nuevo gasto» abre directamente el formulario
        shortcuts: [{ name: 'Nuevo gasto', short_name: 'Gasto', url: '/?nuevo=1', icons: [{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png' }] }],
        background_color: '#07090e',
        theme_color: '#07090e',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Avisos en el móvil (public/push-sw.js)
        importScripts: ['push-sw.js'],
        // La versión nueva entra en cuanto se descarga (y main.tsx recarga la página una vez). Sin esto se quedaba
        // «en espera» hasta cerrar todas las pestañas o la app, y se seguía viendo la versión vieja
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('googleapis.com'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('/node_modules/firebase/') || id.includes('/node_modules/@firebase/')) {
            return 'firebase'
          }
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
            return 'react'
          }
        },
      },
    },
  },
})
