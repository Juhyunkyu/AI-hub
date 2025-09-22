import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'tests/e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      exclude: [
        'node_modules/',
        'tests/',
        '.next/',
        'src/types/supabase.ts',
        'src/types/database.ts',
        '**/*.config.*',
        '**/*.d.ts',
        'src/lib/supabase/types.ts'
      ]
    },
    alias: {
      '@': resolve(__dirname, './src')
    },
    // Vitest가 React 19와 잘 작동하도록 설정
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    }
  }
})