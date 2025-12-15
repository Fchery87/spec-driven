import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  esbuild: {
    // Next uses its own TS/JSX pipeline; for Vitest we need JSX to compile without requiring React in scope.
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 15000,
    hookTimeout: 15000,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', 'dist', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'backend/**/*.ts'],
      exclude: [
        'node_modules/',
        'src/**/*.d.ts',
        '**/*.test.ts',
        '**/types/**'
      ]
    }
  },
  resolve: {
    alias: [
      // IMPORTANT: keep the more specific backend alias before the general "@" alias.
      { find: /^@\/backend\/(.*)$/, replacement: path.resolve(__dirname, './backend/$1') },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, './src/$1') },
    ]
  }
})
