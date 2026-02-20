import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Raised from 500kB default to accommodate app size
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor: React ecosystem
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          // Vendor: Supabase
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          // Vendor: Icons
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // Vendor: Date utilities
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-date';
          }
          // App: Admin/Super Admin pages into their own chunk
          if (id.includes('/pages/admin') || id.includes('/pages/SuperAdmin') || id.includes('/pages/donations')) {
            return 'app-admin';
          }
          // App: Church pages
          if (id.includes('/pages/churches')) {
            return 'app-churches';
          }
        },
      },
    },
  },
})
