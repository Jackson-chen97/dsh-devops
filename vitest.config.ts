import { defineConfig } from 'vitest/config'

import { clientCssPlugin } from './tsdown.config.ts'

export default defineConfig({
  plugins: [clientCssPlugin(false) as never],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
})
