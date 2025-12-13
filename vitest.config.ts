import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  esbuild: {
    // Next uses its own TS/JSX pipeline; for Vitest we need JSX to compile without requiring React in scope.
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'jsdom',
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
