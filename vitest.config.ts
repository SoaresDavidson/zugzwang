import { defineConfig } from 'vitest/config'

// Ambiente padrão é Node. Testes que renderizam React começam com
// `// @vitest-environment jsdom`.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
})
