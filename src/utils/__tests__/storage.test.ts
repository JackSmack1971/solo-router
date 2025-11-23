/**
 * Tests for storage utilities
 * Critical: Verify correct storage mechanism (localStorage vs sessionStorage)
 * Based on CODING_STANDARDS.md Section 5.2 (FR-002)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveApiKey,
  getApiKey,
  clearApiKey,
  hasApiKey,
  saveConversations,
  loadConversations,
  clearConversations,
  saveSettings,
  loadSettings,
  clearSettings,
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
} from '../storage';
import type { Conversation, AppSettings } from '../../types';

describe('Storage Utilities', () => {
  beforeEach(() => {
    // Clear all storage before each test
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('API Key Storage (CRITICAL - sessionStorage only)', () => {
    it('should save API key to sessionStorage, NOT localStorage', () => {
      const testKey = 'sk-test-key-12345';

      saveApiKey(testKey);

      // CRITICAL: Verify key is in sessionStorage
      expect(sessionStorage.getItem('solo_router_openrouter_api_key')).toBe(testKey);

      // CRITICAL: Verify key is NOT in localStorage
      expect(localStorage.getItem('solo_router_openrouter_api_key')).toBeNull();

      // Also verify none of the localStorage keys contain the API key
      for (const key of Object.keys(STORAGE_KEYS)) {
        const value = localStorage.getItem(STORAGE_KEYS[key as keyof typeof STORAGE_KEYS]);
        if (value) {
          expect(value).not.toContain(testKey);
        }
      }
    });

    it('should retrieve API key from sessionStorage', () => {
      const testKey = 'sk-test-key-67890';

      saveApiKey(testKey);
      const retrieved = getApiKey();

      expect(retrieved).toBe(testKey);
    });

    it('should return null when no API key is stored', () => {
      const retrieved = getApiKey();
      expect(retrieved).toBeNull();
    });

    it('should clear API key from sessionStorage', () => {
      const testKey = 'sk-test-key-clear';

      saveApiKey(testKey);
      expect(getApiKey()).toBe(testKey);

      clearApiKey();
      expect(getApiKey()).toBeNull();
    });

    it('should correctly check if API key exists', () => {
      expect(hasApiKey()).toBe(false);

      saveApiKey('sk-test-key');
      expect(hasApiKey()).toBe(true);

      clearApiKey();
      expect(hasApiKey()).toBe(false);
    });

    it('should handle sessionStorage errors gracefully', () => {
      // Mock sessionStorage to throw an error
      const originalSetItem = sessionStorage.setItem;
      sessionStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() => saveApiKey('test-key')).not.toThrow();

      // Restore original
      sessionStorage.setItem = originalSetItem;
    });
  });

  describe('Conversation Storage (localStorage)', () => {
    it('should save conversations to localStorage', () => {
      const conversations: Conversation[] = [
        {
          id: 'conv-1',
          title: 'Test Conversation',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'Hello',
              timestamp: Date.now(),
            },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: 'anthropic/claude-3.5-sonnet',
          settings: {
            temperature: 0.7,
            maxTokens: 2048,
            systemPrompt: null,
          },
          metadata: {
            messageCount: 1,
          },
        },
      ];

      saveConversations(conversations);

      // Verify it's in localStorage
      const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      expect(stored).toBeTruthy();

      // Verify it can be parsed back
      const parsed = JSON.parse(stored!);
      expect(parsed).toEqual(conversations);
    });

    it('should load conversations from localStorage', () => {
      const conversations: Conversation[] = [
        {
          id: 'conv-2',
          title: 'Another Conversation',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: 'openai/gpt-4',
          settings: {
            temperature: 0.5,
            maxTokens: 1024,
            systemPrompt: 'You are a helpful assistant',
          },
          metadata: {
            messageCount: 0,
          },
        },
      ];

      saveConversations(conversations);
      const loaded = loadConversations();

      expect(loaded).toEqual(conversations);
    });

    it('should return empty array when no conversations exist', () => {
      const loaded = loadConversations();
      expect(loaded).toEqual([]);
    });

    it('should handle corrupted conversation data gracefully', () => {
      // Store invalid JSON
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, 'invalid json {]');

      const loaded = loadConversations();

      // Should return empty array instead of throwing
      expect(loaded).toEqual([]);

      // Should also clear the corrupted data
      expect(localStorage.getItem(STORAGE_KEYS.CONVERSATIONS)).toBeNull();
    });

    it('should validate conversation structure', () => {
      // Store data that is not an array
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify({ not: 'array' }));

      const loaded = loadConversations();

      expect(loaded).toEqual([]);
    });

    it('should clear conversations from localStorage', () => {
      const conversations: Conversation[] = [
        {
          id: 'conv-3',
          title: 'Test',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: 'test',
          settings: {
            temperature: 0.7,
            maxTokens: 2048,
            systemPrompt: null,
          },
          metadata: {
            messageCount: 0,
          },
        },
      ];

      saveConversations(conversations);
      expect(loadConversations().length).toBe(1);

      clearConversations();
      expect(loadConversations()).toEqual([]);
    });
  });

  describe('Settings Storage (localStorage)', () => {
    it('should save settings to localStorage', () => {
      const settings: AppSettings = {
        theme: 'dark',
        defaultModel: 'anthropic/claude-3.5-sonnet',
        temperature: 0.8,
        maxTokens: 4096,
        systemPrompt: 'Custom prompt',
      };

      saveSettings(settings);

      // Verify it's in localStorage
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed).toEqual(settings);
    });

    it('should load settings from localStorage', () => {
      const settings: AppSettings = {
        theme: 'light',
        defaultModel: 'openai/gpt-4',
        temperature: 0.5,
        maxTokens: 2048,
        systemPrompt: null,
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
      };

      saveSettings(settings);
      const loaded = loadSettings();

      expect(loaded).toEqual(settings);
    });

    it('should return default settings when none exist', () => {
      const loaded = loadSettings();
      expect(loaded).toEqual(DEFAULT_SETTINGS);
    });

    it('should merge with defaults for partial settings (version upgrades)', () => {
      // Simulate old settings missing new fields
      const oldSettings = {
        theme: 'dark',
        temperature: 0.9,
      };

      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(oldSettings));

      const loaded = loadSettings();

      // Should have old settings merged with defaults
      expect(loaded.theme).toBe('dark');
      expect(loaded.temperature).toBe(0.9);
      expect(loaded.defaultModel).toBe(DEFAULT_SETTINGS.defaultModel);
      expect(loaded.maxTokens).toBe(DEFAULT_SETTINGS.maxTokens);
    });

    it('should handle corrupted settings data gracefully', () => {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, 'invalid json');

      const loaded = loadSettings();

      expect(loaded).toEqual(DEFAULT_SETTINGS);
      expect(localStorage.getItem(STORAGE_KEYS.SETTINGS)).toBeNull();
    });

    it('should clear settings from localStorage', () => {
      const settings: AppSettings = {
        theme: 'system',
        defaultModel: 'test',
        temperature: 0.7,
        maxTokens: 2048,
        systemPrompt: 'test',
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
      };

      saveSettings(settings);
      expect(loadSettings()).toEqual(settings);

      clearSettings();
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('Storage Security', () => {
    it('should never store API key in localStorage', () => {
      const apiKey = 'sk-secret-key';
      const conversations: Conversation[] = [
        {
          id: 'conv-1',
          title: 'Test',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'Hello',
              timestamp: Date.now(),
            },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: 'test',
          settings: {
            temperature: 0.7,
            maxTokens: 2048,
            systemPrompt: null,
          },
          metadata: {
            messageCount: 1,
          },
        },
      ];

      // Save both API key and conversations
      saveApiKey(apiKey);
      saveConversations(conversations);

      // Verify API key is only in sessionStorage
      expect(sessionStorage.getItem('solo_router_openrouter_api_key')).toBe(apiKey);

      // Verify localStorage does not contain the API key
      const allLocalStorageData = Object.keys(localStorage).map(key =>
        localStorage.getItem(key)
      );

      for (const data of allLocalStorageData) {
        if (data) {
          expect(data).not.toContain(apiKey);
        }
      }
    });
  });

  describe('Import/Export Functionality (AT-008)', () => {
    it('should validate export data structure', () => {
      const conversations: Conversation[] = [
        {
          id: 'conv-1',
          title: 'Test Conversation',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'Test message',
              timestamp: Date.now(),
            },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: 'test-model',
          settings: {
            temperature: 0.7,
            maxTokens: 2048,
            systemPrompt: null,
          },
          metadata: {
            messageCount: 1,
          },
        },
      ];

      const settings: AppSettings = {
        theme: 'dark',
        defaultModel: 'test',
        temperature: 0.8,
        maxTokens: 4096,
        systemPrompt: 'Test prompt',
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
      };

      saveConversations(conversations);
      saveSettings(settings);

      // Verify by checking localStorage directly since export uses loadConversations/loadSettings
      const exportedConvs = loadConversations();
      const exportedSettings = loadSettings();

      expect(exportedConvs).toEqual(conversations);
      expect(exportedSettings).toEqual(settings);
    });

    it('should import valid JSON data successfully', async () => {
      const exportData = {
        version: '1.0',
        exportedAt: Date.now(),
        conversations: [
          {
            id: 'import-conv-1',
            title: 'Imported Conversation',
            messages: [
              {
                id: 'msg-1',
                role: 'user' as const,
                content: 'Imported message',
                timestamp: Date.now(),
              },
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            model: 'test-model',
            settings: {
              temperature: 0.7,
              maxTokens: 2048,
              systemPrompt: null,
            },
            metadata: {
              messageCount: 1,
            },
          },
        ],
        settings: {
          theme: 'light' as const,
          defaultModel: 'imported-model',
          temperature: 0.6,
          maxTokens: 3000,
          systemPrompt: 'Imported prompt',
        },
      };

      const jsonString = JSON.stringify(exportData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'backup.json', { type: 'application/json' });

      const { importData } = await import('../storage');
      const result = await importData(file, 'replace');

      expect(result.conversations).toBe(1);
      expect(result.settings).toBe(true);

      const loadedConversations = loadConversations();
      const loadedSettings = loadSettings();

      expect(loadedConversations).toHaveLength(1);
      expect(loadedConversations[0].id).toBe('import-conv-1');
      expect(loadedSettings.theme).toBe('light');
      expect(loadedSettings.defaultModel).toBe('imported-model');
    });

    it('should merge imported conversations with existing ones', async () => {
      const existing: Conversation[] = [
        {
          id: 'existing-1',
          title: 'Existing',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: 'test',
          settings: {
            temperature: 0.7,
            maxTokens: 2048,
            systemPrompt: null,
          },
          metadata: {
            messageCount: 0,
          },
        },
      ];

      saveConversations(existing);

      const exportData = {
        version: '1.0',
        exportedAt: Date.now(),
        conversations: [
          {
            id: 'imported-1',
            title: 'Imported',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            model: 'test',
            settings: {
              temperature: 0.7,
              maxTokens: 2048,
              systemPrompt: null,
            },
            metadata: {
              messageCount: 0,
            },
          },
        ],
        settings: DEFAULT_SETTINGS,
      };

      const jsonString = JSON.stringify(exportData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'backup.json', { type: 'application/json' });

      const { importData } = await import('../storage');
      await importData(file, 'merge');

      const loaded = loadConversations();
      expect(loaded).toHaveLength(2);
      expect(loaded.find(c => c.id === 'existing-1')).toBeDefined();
      expect(loaded.find(c => c.id === 'imported-1')).toBeDefined();
    });

    it('should reject invalid import file format', async () => {
      const invalidData = {
        invalidKey: 'value',
        // Missing required fields
      };

      const jsonString = JSON.stringify(invalidData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'invalid.json', { type: 'application/json' });

      const { importData } = await import('../storage');

      await expect(importData(file)).rejects.toThrow('Invalid backup file format');
    });

    it('should reject empty import file', async () => {
      const blob = new Blob([''], { type: 'application/json' });
      const file = new File([blob], 'empty.json', { type: 'application/json' });

      const { importData } = await import('../storage');

      await expect(importData(file)).rejects.toThrow();
    });

    it('should reject malformed JSON in import file', async () => {
      const blob = new Blob(['{ invalid json }'], { type: 'application/json' });
      const file = new File([blob], 'malformed.json', { type: 'application/json' });

      const { importData } = await import('../storage');

      await expect(importData(file)).rejects.toThrow();
    });

    it('should filter duplicate conversations during merge import', async () => {
      const existing: Conversation[] = [
        {
          id: 'duplicate-id',
          title: 'Original',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: 'test',
          settings: {
            temperature: 0.7,
            maxTokens: 2048,
            systemPrompt: null,
          },
          metadata: {
            messageCount: 0,
          },
        },
      ];

      saveConversations(existing);

      const exportData = {
        version: '1.0',
        exportedAt: Date.now(),
        conversations: [
          {
            id: 'duplicate-id', // Same ID
            title: 'Duplicate',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            model: 'test',
            settings: {
              temperature: 0.7,
              maxTokens: 2048,
              systemPrompt: null,
            },
            metadata: {
              messageCount: 0,
            },
          },
        ],
        settings: DEFAULT_SETTINGS,
      };

      const jsonString = JSON.stringify(exportData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'backup.json', { type: 'application/json' });

      const { importData } = await import('../storage');
      await importData(file, 'merge');

      const loaded = loadConversations();
      // Should still have only 1 conversation (no duplicates)
      expect(loaded).toHaveLength(1);
      // Should keep the original
      expect(loaded[0].title).toBe('Original');
    });
  });

  describe('Error Handling - QuotaExceededError (AT-008)', () => {
    it('should handle QuotaExceededError when saving conversations', () => {
      const largeConversations: Conversation[] = Array.from({ length: 100 }, (_, i) => ({
        id: `conv-${i}`,
        title: `Conversation ${i}`,
        messages: Array.from({ length: 100 }, (_, j) => ({
          id: `msg-${i}-${j}`,
          role: 'user' as const,
          content: 'A'.repeat(1000), // Large content
          timestamp: Date.now(),
        })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: 'test',
        settings: {
          temperature: 0.7,
          maxTokens: 2048,
          systemPrompt: null,
        },
        metadata: {
          messageCount: 100,
        },
      }));

      // Mock localStorage to throw QuotaExceededError
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      // Should not throw - error should be handled gracefully
      expect(() => saveConversations(largeConversations)).not.toThrow();

      // Restore
      localStorage.setItem = originalSetItem;
    });

    it('should handle QuotaExceededError when saving settings', () => {
      const largeSettings: AppSettings = {
        theme: 'dark',
        defaultModel: 'test',
        temperature: 0.7,
        maxTokens: 2048,
        systemPrompt: 'A'.repeat(10000), // Very large system prompt
      };

      // Mock localStorage to throw QuotaExceededError
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      // Should not throw
      expect(() => saveSettings(largeSettings)).not.toThrow();

      // Restore
      localStorage.setItem = originalSetItem;
    });

    it('should handle localStorage being disabled/unavailable', () => {
      const originalGetItem = localStorage.getItem;
      const originalSetItem = localStorage.setItem;

      // Mock localStorage methods to throw
      localStorage.getItem = vi.fn(() => {
        throw new Error('localStorage is not available');
      });
      localStorage.setItem = vi.fn(() => {
        throw new Error('localStorage is not available');
      });

      // All operations should handle errors gracefully
      expect(() => saveConversations([])).not.toThrow();
      expect(() => loadConversations()).not.toThrow();
      expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
      expect(() => loadSettings()).not.toThrow();

      // Restore
      localStorage.getItem = originalGetItem;
      localStorage.setItem = originalSetItem;
    });
  });

  describe('Edge Cases (AT-008)', () => {
    it('should handle empty localStorage gracefully', () => {
      // Ensure storage is empty
      localStorage.clear();

      const conversations = loadConversations();
      const settings = loadSettings();

      expect(conversations).toEqual([]);
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should handle non-string values in localStorage', () => {
      // Directly set non-string values (simulating corruption)
      const originalGetItem = localStorage.getItem;

      // Mock to return various non-string types
      localStorage.getItem = vi.fn((key: string) => {
        if (key === STORAGE_KEYS.CONVERSATIONS) {
          // Return a number instead of string
          return 12345 as any;
        }
        if (key === STORAGE_KEYS.SETTINGS) {
          // Return an object instead of string
          return { broken: true } as any;
        }
        return null;
      });

      // Should handle gracefully
      const conversations = loadConversations();
      const settings = loadSettings();

      expect(conversations).toEqual([]);
      expect(settings).toEqual(DEFAULT_SETTINGS);

      // Restore
      localStorage.getItem = originalGetItem;
    });

    it('should handle conversations with invalid message structure', () => {
      const invalidConversations = [
        {
          id: 'valid-id',
          title: 'Valid title',
          messages: [
            // Missing required fields
            { content: 'No role or timestamp' },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(invalidConversations));

      const loaded = loadConversations();

      // The validation only checks for id and messages array existence, not message content
      // So this will actually pass validation and load the conversation
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('valid-id');
    });

    it('should handle settings with null values', () => {
      const settingsWithNulls = {
        theme: null,
        defaultModel: null,
        temperature: null,
        maxTokens: null,
        systemPrompt: null,
      };

      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settingsWithNulls));

      const loaded = loadSettings();

      // Should merge with defaults, which means null values override defaults
      expect(loaded.systemPrompt).toBeNull();
      expect(loaded.defaultModel).toBeNull();
      // Temperature and maxTokens are also null because they override defaults
      expect(loaded.temperature).toBeNull();
      expect(loaded.maxTokens).toBeNull();
      // Theme should be null as well
      expect(loaded.theme).toBeNull();
    });

    it('should handle extremely large conversation arrays', () => {
      const largeArray: Conversation[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `conv-${i}`,
        title: `Conversation ${i}`,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: 'test',
        settings: {
          temperature: 0.7,
          maxTokens: 2048,
          systemPrompt: null,
        },
        metadata: {
          messageCount: 0,
        },
      }));

      // Should handle large arrays without errors
      expect(() => saveConversations(largeArray)).not.toThrow();

      const loaded = loadConversations();
      expect(loaded).toHaveLength(1000);
    });

    it('should handle conversations array with missing required fields', () => {
      const incompleteConversations = [
        {
          id: 'conv-1',
          // Missing title
          messages: [],
        },
        {
          // Missing id
          title: 'No ID',
          messages: [],
        },
        {
          id: 'conv-3',
          title: 'No messages field',
          // Missing messages array
        },
      ];

      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(incompleteConversations));

      const loaded = loadConversations();

      // Should detect invalid structure and return empty array
      expect(loaded).toEqual([]);
    });

    it('should handle settings with extra unknown fields', () => {
      const settingsWithExtras = {
        ...DEFAULT_SETTINGS,
        unknownField1: 'value1',
        unknownField2: 123,
        nestedObject: { a: 1, b: 2 },
      };

      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settingsWithExtras));

      const loaded = loadSettings();

      // Should load successfully, extra fields will be preserved
      expect(loaded.theme).toBe(DEFAULT_SETTINGS.theme);
      expect(loaded.temperature).toBe(DEFAULT_SETTINGS.temperature);
      // Extra fields are included due to spread operator
      expect((loaded as any).unknownField1).toBe('value1');
    });

    it('should handle concurrent saves to the same key', () => {
      const conv1: Conversation[] = [
        {
          id: 'conv-1',
          title: 'First',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: 'test',
          settings: {
            temperature: 0.7,
            maxTokens: 2048,
            systemPrompt: null,
          },
          metadata: {
            messageCount: 0,
          },
        },
      ];

      const conv2: Conversation[] = [
        {
          id: 'conv-2',
          title: 'Second',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: 'test',
          settings: {
            temperature: 0.7,
            maxTokens: 2048,
            systemPrompt: null,
          },
          metadata: {
            messageCount: 0,
          },
        },
      ];

      // Simulate concurrent saves
      saveConversations(conv1);
      saveConversations(conv2);

      const loaded = loadConversations();

      // Last write wins
      expect(loaded).toEqual(conv2);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('conv-2');
    });

    it('should handle API key with special characters', () => {
      const specialKey = 'sk-test!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

      saveApiKey(specialKey);
      const retrieved = getApiKey();

      expect(retrieved).toBe(specialKey);
    });

    it('should handle very long API keys', () => {
      const longKey = 'sk-' + 'a'.repeat(1000);

      saveApiKey(longKey);
      const retrieved = getApiKey();

      expect(retrieved).toBe(longKey);
      expect(retrieved?.length).toBe(1003);
    });
  });
});
