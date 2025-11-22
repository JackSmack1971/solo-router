/**
 * Vitest setup file
 * Configures the testing environment with jsdom and testing-library
 */

import '@testing-library/jest-dom';

// Mock sessionStorage and localStorage for testing
const createMockStorage = (): Storage => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
};

// Set up mock storage for each test
beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: createMockStorage(),
    writable: true,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: createMockStorage(),
    writable: true,
  });
});

// Clean up after each test
afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
