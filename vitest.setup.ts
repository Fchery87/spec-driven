import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables for tests
process.env.JWT_SECRET = 'test-secret-key-for-testing-only-do-not-use-in-production';
// Note: NODE_ENV is read-only, it's set by vitest automatically
process.env.DATABASE_URL = 'file:./test.db';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/'
  })
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn()
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  }
}));
