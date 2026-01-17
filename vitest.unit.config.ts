/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

/**
 * Unit-test config (separate from Storybook browser tests).
 * Run with: `npx vitest run -c vitest.unit.config.ts`
 */
export default defineConfig({
  test: {
    // Pure unit tests (no DOM needed). Keeps setup lightweight (no jsdom dependency).
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.stories.*', 'src/**/*.mdx', 'node_modules/**', 'dist/**'],
  },
});

