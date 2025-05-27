import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Ensure proper resolution of lodash modules
      'lodash/get': 'lodash/get.js',
      'lodash/isString': 'lodash/isString.js',
      'lodash/isNaN': 'lodash/isNaN.js',
      'lodash/isNumber': 'lodash/isNumber.js'
    }
  },
  build: {
    // Optimize chunk sizes
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['react-router-dom'],
          'clerk-vendor': ['@clerk/clerk-react'],
          'sentry-vendor': ['@sentry/browser', '@sentry/react', '@sentry/integrations'],
          'chart-vendor': ['recharts'],
          'ui-vendor': ['@headlessui/react', 'phosphor-react'],
          'utils-vendor': ['axios', 'date-fns', 'loglevel']
        },
        // Optimize asset file names for better caching
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const extType = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType || '')) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/css/i.test(extType || '')) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js'
      }
    },
    // Enable source maps for production debugging (optional)
    sourcemap: false,
    // Optimize for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'] // Remove specific console methods
      }
    },
    // CSS code splitting
    cssCodeSplit: true,
    // Asset optimization
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    // Target modern browsers for smaller bundles
    target: 'es2020'
  },
  // Optimize dev server
  server: {
    hmr: {
      overlay: false
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@clerk/clerk-react',
      'lodash/get',
      'lodash/isString',
      'lodash/isNaN',
      'lodash/isNumber'
    ],
    exclude: [
      '@sentry/browser',
      '@sentry/react'
    ]
  },
  // Enable experimental features for better performance
  esbuild: {
    // Remove console.logs in production
    drop: ['console', 'debugger'],
    // Target modern browsers
    target: 'es2020'
  }
})
