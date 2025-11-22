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
});
