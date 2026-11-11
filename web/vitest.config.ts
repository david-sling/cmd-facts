import { defineConfig } from 'vitest/config'

// The site's vite.config.ts brings the whole app server along; the registry tests need only its path aliases.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
