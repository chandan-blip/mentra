import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // env.ts validates process.env at import and exits on failure — give it
    // satisfying dummy values so pure-logic tests can import modules freely.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'mysql://test:test@localhost:3306/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'x'.repeat(48),
      JWT_REFRESH_COOKIE_SECRET: 'y'.repeat(48),
      AI_API_KEY: 'test-ai-key',
    },
  },
});
