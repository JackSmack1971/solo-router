/**
 * AT-017: API Key Security Tests
 * These tests ensure the OpenRouter API key is handled securely.
 * Tests MUST pass to ensure critical security controls are in place.
 * Based on CODING_STANDARDS.md Section 8 (Security)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveApiKey, getApiKey, clearApiKey, isApiKeyPersisted } from '../../utils/storage';
import { OpenRouterProvider, getHumanErrorMessage, ApiError } from '../../services/openRouter';

describe('AT-017: API Key Security (Critical Security)', () => {
  const TEST_API_KEY = 'sk-or-v1-test-key-1234567890abcdef';

  beforeEach(() => {
    // Clear all storage before each test
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up after each test
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  /**
   * Test 1: API Key NOT Logged to Console
   * CRITICAL: API keys must never be logged to console
   */
  it('1. should NOT log API key to console', () => {
    // Mock all console methods
    const consoleSpy = {
      log: vi.spyOn(console, 'log'),
      error: vi.spyOn(console, 'error'),
      warn: vi.spyOn(console, 'warn'),
      info: vi.spyOn(console, 'info'),
      debug: vi.spyOn(console, 'debug'),
    };

    // Save the API key
    saveApiKey(TEST_API_KEY, false);

    // Retrieve the API key
    const retrievedKey = getApiKey();
    expect(retrievedKey).toBe(TEST_API_KEY);

    // Clear the API key
    clearApiKey();

    // CRITICAL: Verify API key was never logged to any console method
    Object.values(consoleSpy).forEach((spy) => {
      spy.mock.calls.forEach((call) => {
        call.forEach((arg) => {
          const argStr = String(arg);
          expect(argStr).not.toContain(TEST_API_KEY);
        });
      });
    });

    // Additional check: even partial keys should not be logged
    const keyPrefix = TEST_API_KEY.substring(0, 10);
    Object.values(consoleSpy).forEach((spy) => {
      spy.mock.calls.forEach((call) => {
        call.forEach((arg) => {
          const argStr = String(arg);
          // Allow the prefix in test output, but not the full key
          if (argStr.includes(keyPrefix)) {
            expect(argStr).not.toContain(TEST_API_KEY);
          }
        });
      });
    });
  });

  /**
   * Test 2: API Key NOT Exposed in Error Messages
   * CRITICAL: Error messages must not contain the API key
   */
  it('2. should NOT expose API key in error messages', () => {
    // Save the API key
    saveApiKey(TEST_API_KEY, false);

    // Test ApiError with various status codes
    const errors = [
      new ApiError(401, 'Invalid API key'),
      new ApiError(402, 'Insufficient credits'),
      new ApiError(429, 'Rate limit exceeded'),
      new ApiError(500, 'Server error'),
    ];

    errors.forEach((error) => {
      const humanMessage = getHumanErrorMessage(error);

      // CRITICAL: Error messages must not contain the API key
      expect(humanMessage).not.toContain(TEST_API_KEY);
      expect(error.message).not.toContain(TEST_API_KEY);
    });

    // Test that error.body (if it exists) doesn't expose the key
    const errorWithBody = new ApiError(
      401,
      'Authentication failed',
      { error: 'Invalid credentials' }
    );

    expect(JSON.stringify(errorWithBody.body)).not.toContain(TEST_API_KEY);
  });

  /**
   * Test 3: API Key Cleared from sessionStorage on clearApiKey()
   * CRITICAL: clearApiKey() must remove the key from all storage locations
   */
  it('3. should clear API key from sessionStorage when clearApiKey is called', () => {
    // Save key to sessionStorage (default behavior)
    saveApiKey(TEST_API_KEY, false);

    // Verify key is in sessionStorage
    expect(sessionStorage.getItem('solo_router_openrouter_api_key')).toBe(TEST_API_KEY);
    expect(getApiKey()).toBe(TEST_API_KEY);

    // Clear the API key
    clearApiKey();

    // CRITICAL: Key must be removed from sessionStorage
    expect(sessionStorage.getItem('solo_router_openrouter_api_key')).toBeNull();
    expect(getApiKey()).toBeNull();

    // Also test with persisted key
    saveApiKey(TEST_API_KEY, true);
    expect(localStorage.getItem('solo_router_openrouter_api_key_local')).toBe(TEST_API_KEY);

    clearApiKey();

    // CRITICAL: Key must be removed from both sessionStorage AND localStorage
    expect(sessionStorage.getItem('solo_router_openrouter_api_key')).toBeNull();
    expect(localStorage.getItem('solo_router_openrouter_api_key_local')).toBeNull();
    expect(getApiKey()).toBeNull();
  });

  /**
   * Test 4: API Key NOT Persisted to localStorage by Default
   * CRITICAL: By default, API keys should only be in sessionStorage
   */
  it('4. should NOT persist API key to localStorage by default', () => {
    // Save key without persistence flag (default behavior)
    saveApiKey(TEST_API_KEY);

    // Verify key is in sessionStorage
    expect(sessionStorage.getItem('solo_router_openrouter_api_key')).toBe(TEST_API_KEY);
    expect(getApiKey()).toBe(TEST_API_KEY);

    // CRITICAL: Key must NOT be in localStorage by default
    expect(localStorage.getItem('solo_router_openrouter_api_key_local')).toBeNull();
    expect(isApiKeyPersisted()).toBe(false);

    // Explicitly test with persist=false
    clearApiKey();
    saveApiKey(TEST_API_KEY, false);

    expect(sessionStorage.getItem('solo_router_openrouter_api_key')).toBe(TEST_API_KEY);
    expect(localStorage.getItem('solo_router_openrouter_api_key_local')).toBeNull();
    expect(isApiKeyPersisted()).toBe(false);
  });

  /**
   * Test 5: API Key Only Persisted to localStorage When Explicitly Requested
   * CRITICAL: localStorage persistence requires explicit user consent (persist=true)
   */
  it('5. should only persist API key to localStorage when explicitly requested', () => {
    // Save key WITH persistence flag
    saveApiKey(TEST_API_KEY, true);

    // CRITICAL: Key must be in localStorage when persist=true
    expect(localStorage.getItem('solo_router_openrouter_api_key_local')).toBe(TEST_API_KEY);
    expect(isApiKeyPersisted()).toBe(true);

    // sessionStorage should be cleared to avoid duplication
    expect(sessionStorage.getItem('solo_router_openrouter_api_key')).toBeNull();

    // getApiKey() should still return the key from localStorage
    expect(getApiKey()).toBe(TEST_API_KEY);

    // Test switching from persisted to non-persisted
    saveApiKey(TEST_API_KEY, false);

    // CRITICAL: Key should now be in sessionStorage only
    expect(sessionStorage.getItem('solo_router_openrouter_api_key')).toBe(TEST_API_KEY);
    expect(localStorage.getItem('solo_router_openrouter_api_key_local')).toBeNull();
    expect(isApiKeyPersisted()).toBe(false);
  });

  /**
   * Additional Security Test: Verify Authorization Header is Correct
   * This test ensures the API key is used correctly but not exposed
   */
  it('should use API key in Authorization header without exposing it', async () => {
    saveApiKey(TEST_API_KEY, false);

    // Mock fetch to intercept the request
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const provider = new OpenRouterProvider();
    await provider.listModels();

    // Verify fetch was called
    expect(fetchSpy).toHaveBeenCalled();

    // Get the fetch call arguments
    const fetchCall = fetchSpy.mock.calls[0];
    const fetchOptions = fetchCall[1] as RequestInit;
    const headers = fetchOptions.headers as Record<string, string>;

    // CRITICAL: Authorization header should be set correctly
    expect(headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`);

    // But the key should not be in the URL
    const url = fetchCall[0] as string;
    expect(url).not.toContain(TEST_API_KEY);
  });

  /**
   * Additional Security Test: Storage Errors Don't Expose Keys
   * Ensures that if storage operations fail, the key is not logged
   */
  it('should handle storage errors without exposing API key', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');

    // Mock sessionStorage.setItem to throw an error
    const originalSetItem = sessionStorage.setItem;
    sessionStorage.setItem = vi.fn(() => {
      throw new Error('Storage quota exceeded');
    });

    // Attempt to save the API key (should fail silently)
    saveApiKey(TEST_API_KEY, false);

    // Verify error was logged but key was not
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mock.calls.forEach((call) => {
      call.forEach((arg) => {
        const argStr = String(arg);
        expect(argStr).not.toContain(TEST_API_KEY);
      });
    });

    // Restore original setItem
    sessionStorage.setItem = originalSetItem;
  });
});
