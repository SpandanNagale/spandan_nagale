import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.ts', 'api/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
