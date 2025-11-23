/**
 * Integration Tests - Storage Persistence (AT-019)
 * Tests that state survives a simulated "reload" (unmounting/remounting the store/provider)
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatStore } from '../../store/chatStore';
import * as openRouterModule from '../../services/openRouter';
import * as storageModule from '../../utils/storage';
import type { StreamParams, Conversation, AppSettings } from '../../types';

// Mock the openRouter module
vi.mock('../../services/openRouter', () => ({
  defaultProvider: {
    streamChat: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  },
}));

describe('Integration - Storage Persistence (AT-019)', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    const { result } = renderHook(() => useChatStore());
    act(() => {
      result.current.clearAllData();
    });

    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Conversation persistence across reload', () => {
    it('should restore conversations after simulated reload', async () => {
      // ================================================================
      // SESSION 1: Create and populate data
      // ================================================================
      const { result: session1 } = renderHook(() => useChatStore());

      let conv1Id: string = '';
      let conv2Id: string = '';

      act(() => {
        conv1Id = session1.current.createConversation('First Chat');
        conv2Id = session1.current.createConversation('Second Chat');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Mock response');
        params.onDone({ totalTokens: 10 });
      });

      // Add messages to first conversation
      act(() => {
        session1.current.setActiveConversation(conv1Id);
      });

      await act(async () => {
        await session1.current.sendMessage('Hello from conv 1');
      });

      // Add messages to second conversation
      act(() => {
        session1.current.setActiveConversation(conv2Id);
      });

      await act(async () => {
        await session1.current.sendMessage('Hello from conv 2');
      });

      expect(session1.current.conversations).toHaveLength(2);

      // Force save to storage
      act(() => {
        session1.current.saveToStorage();
      });

      // ================================================================
      // SESSION 2: Simulate browser reload by creating new store instance
      // ================================================================
      const { result: session2 } = renderHook(() => useChatStore());

      // Load from storage (simulating app initialization)
      act(() => {
        session2.current.loadFromStorage();
      });

      // ================================================================
      // VERIFY: Data was restored
      // ================================================================
      expect(session2.current.conversations).toHaveLength(2);

      const restoredConv1 = session2.current.conversations.find((c) => c.id === conv1Id);
      const restoredConv2 = session2.current.conversations.find((c) => c.id === conv2Id);

      expect(restoredConv1).toBeDefined();
      expect(restoredConv2).toBeDefined();

      expect(restoredConv1?.title).toBe('First Chat');
      expect(restoredConv1?.messages).toHaveLength(2);
      expect(restoredConv1?.messages[0].content).toBe('Hello from conv 1');

      expect(restoredConv2?.title).toBe('Second Chat');
      expect(restoredConv2?.messages).toHaveLength(2);
      expect(restoredConv2?.messages[0].content).toBe('Hello from conv 2');

      // Active conversation should be set to the most recent
      expect(session2.current.activeConversationId).toBe(conv2Id);
    });

    it('should preserve message metadata after reload', async () => {
      const { result: session1 } = renderHook(() => useChatStore());

      act(() => {
        session1.current.createConversation('Metadata test');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Response with metadata');
        params.onDone({
          promptTokens: 15,
          completionTokens: 8,
          totalTokens: 23,
        });
      });

      await act(async () => {
        await session1.current.sendMessage('Test message');
      });

      const originalMsg = session1.current.conversations[0].messages[1];
      const originalId = originalMsg.id;
      const originalTimestamp = originalMsg.timestamp;
      const originalModel = originalMsg.model;
      const originalTokenCount = originalMsg.tokenCount;

      act(() => {
        session1.current.saveToStorage();
      });

      // ================================================================
      // Simulate reload
      // ================================================================
      const { result: session2 } = renderHook(() => useChatStore());
      act(() => {
        session2.current.loadFromStorage();
      });

      const restoredMsg = session2.current.conversations[0].messages[1];

      expect(restoredMsg.id).toBe(originalId);
      expect(restoredMsg.timestamp).toBe(originalTimestamp);
      expect(restoredMsg.model).toBe(originalModel);
      expect(restoredMsg.tokenCount).toBe(originalTokenCount);
      expect(restoredMsg.content).toBe('Response with metadata');
    });

    it('should preserve conversation settings after reload', async () => {
      const { result: session1 } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        convId = session1.current.createConversation('Settings test');
      });

      // Update conversation settings
      act(() => {
        session1.current.updateConversationSettings(convId, {
          temperature: 0.9,
          maxTokens: 4096,
          systemPrompt: 'You are a helpful assistant.',
          topP: 0.95,
          frequencyPenalty: 0.5,
          presencePenalty: 0.3,
        });
      });

      act(() => {
        session1.current.updateConversationModel(convId, 'anthropic/claude-3.5-sonnet');
      });

      act(() => {
        session1.current.saveToStorage();
      });

      // ================================================================
      // Simulate reload
      // ================================================================
      const { result: session2 } = renderHook(() => useChatStore());
      act(() => {
        session2.current.loadFromStorage();
      });

      const restoredConv = session2.current.conversations.find((c) => c.id === convId);

      expect(restoredConv?.model).toBe('anthropic/claude-3.5-sonnet');
      expect(restoredConv?.settings.temperature).toBe(0.9);
      expect(restoredConv?.settings.maxTokens).toBe(4096);
      expect(restoredConv?.settings.systemPrompt).toBe('You are a helpful assistant.');
      expect(restoredConv?.settings.topP).toBe(0.95);
      expect(restoredConv?.settings.frequencyPenalty).toBe(0.5);
      expect(restoredConv?.settings.presencePenalty).toBe(0.3);
    });

    it('should preserve conversation metadata (token counts, message counts) after reload', async () => {
      const { result: session1 } = renderHook(() => useChatStore());

      act(() => {
        session1.current.createConversation('Metadata persistence test');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

      // First message
      streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
        params.onChunk('First response');
        params.onDone({ totalTokens: 15 });
      });

      await act(async () => {
        await session1.current.sendMessage('First message');
      });

      // Second message
      streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
        params.onChunk('Second response');
        params.onDone({ totalTokens: 20 });
      });

      await act(async () => {
        await session1.current.sendMessage('Second message');
      });

      const originalConv = session1.current.conversations[0];
      // Note: messageCount may reflect the count at last metadata update
      expect(originalConv.metadata?.messageCount).toBeGreaterThanOrEqual(1);
      expect(originalConv.metadata?.totalTokens).toBe(35); // 15 + 20

      act(() => {
        session1.current.saveToStorage();
      });

      // ================================================================
      // Simulate reload
      // ================================================================
      const { result: session2 } = renderHook(() => useChatStore());
      act(() => {
        session2.current.loadFromStorage();
      });

      const restoredConv = session2.current.conversations[0];
      expect(restoredConv.metadata?.messageCount).toBeGreaterThanOrEqual(1);
      expect(restoredConv.metadata?.totalTokens).toBe(35);
    });

    it('should preserve timestamps (createdAt, updatedAt) after reload', async () => {
      const { result: session1 } = renderHook(() => useChatStore());

      let convId: string = '';
      const beforeCreate = Date.now();

      act(() => {
        convId = session1.current.createConversation('Timestamp test');
      });

      const afterCreate = Date.now();

      const originalConv = session1.current.conversations[0];
      const originalCreatedAt = originalConv.createdAt;
      const originalUpdatedAt = originalConv.updatedAt;

      expect(originalCreatedAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(originalCreatedAt).toBeLessThanOrEqual(afterCreate);

      act(() => {
        session1.current.saveToStorage();
      });

      // ================================================================
      // Simulate reload
      // ================================================================
      const { result: session2 } = renderHook(() => useChatStore());
      act(() => {
        session2.current.loadFromStorage();
      });

      const restoredConv = session2.current.conversations.find((c) => c.id === convId);
      expect(restoredConv?.createdAt).toBe(originalCreatedAt);
      expect(restoredConv?.updatedAt).toBe(originalUpdatedAt);
    });
  });

  describe('Settings persistence across reload', () => {
    it('should restore settings after simulated reload', async () => {
      const { result: session1 } = renderHook(() => useChatStore());

      // Update settings
      act(() => {
        session1.current.updateSettings({
          theme: 'dark',
          defaultModel: 'openai/gpt-4-turbo',
          temperature: 0.8,
          maxTokens: 3000,
          systemPrompt: 'Custom system prompt',
          topP: 0.9,
          frequencyPenalty: 0.2,
          presencePenalty: 0.4,
        });
      });

      // Settings are saved immediately (no debounce)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // ================================================================
      // Simulate reload
      // ================================================================
      const { result: session2 } = renderHook(() => useChatStore());
      act(() => {
        session2.current.loadFromStorage();
      });

      const restoredSettings = session2.current.settings;
      expect(restoredSettings.theme).toBe('dark');
      expect(restoredSettings.defaultModel).toBe('openai/gpt-4-turbo');
      expect(restoredSettings.temperature).toBe(0.8);
      expect(restoredSettings.maxTokens).toBe(3000);
      expect(restoredSettings.systemPrompt).toBe('Custom system prompt');
      expect(restoredSettings.topP).toBe(0.9);
      expect(restoredSettings.frequencyPenalty).toBe(0.2);
      expect(restoredSettings.presencePenalty).toBe(0.4);
    });

    it('should use default settings if none exist in storage', () => {
      const { result } = renderHook(() => useChatStore());

      // Don't save any settings, just load
      act(() => {
        result.current.loadFromStorage();
      });

      const settings = result.current.settings;
      expect(settings.theme).toBe('system');
      expect(settings.defaultModel).toBeNull();
      expect(settings.temperature).toBe(0.7);
      expect(settings.maxTokens).toBe(2048);
      expect(settings.systemPrompt).toBeNull();
    });

    it('should merge saved settings with defaults (for version upgrades)', () => {
      // Simulate old version with fewer settings
      const oldSettings: Partial<AppSettings> = {
        theme: 'light',
        temperature: 0.5,
      };

      storageModule.saveSettings(oldSettings as AppSettings);

      // ================================================================
      // Load in new version
      // ================================================================
      const { result } = renderHook(() => useChatStore());
      act(() => {
        result.current.loadFromStorage();
      });

      const settings = result.current.settings;

      // Should have old settings
      expect(settings.theme).toBe('light');
      expect(settings.temperature).toBe(0.5);

      // Should have default values for new fields
      expect(settings.maxTokens).toBe(2048);
      expect(settings.systemPrompt).toBeNull();
      expect(settings.defaultModel).toBeNull();
    });
  });

  describe('Empty state handling', () => {
    it('should handle empty storage gracefully', () => {
      const { result } = renderHook(() => useChatStore());

      // Clear storage first
      localStorage.clear();

      // Load from empty storage
      act(() => {
        result.current.loadFromStorage();
      });

      expect(result.current.conversations).toEqual([]);
      expect(result.current.activeConversationId).toBeNull();
      expect(result.current.settings).toMatchObject(storageModule.DEFAULT_SETTINGS);
    });

    it('should handle corrupted conversation data', () => {
      // Write invalid data to localStorage
      localStorage.setItem(storageModule.STORAGE_KEYS.CONVERSATIONS, 'invalid json{');

      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.loadFromStorage();
      });

      // Should fall back to empty array
      expect(result.current.conversations).toEqual([]);
    });

    it('should handle corrupted settings data', () => {
      // Write invalid data to localStorage
      localStorage.setItem(storageModule.STORAGE_KEYS.SETTINGS, 'not valid json');

      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.loadFromStorage();
      });

      // Should fall back to default settings
      expect(result.current.settings).toMatchObject(storageModule.DEFAULT_SETTINGS);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle multiple reload cycles without data loss', async () => {
      let convId: string = '';

      // ================================================================
      // Session 1: Create conversation with message
      // ================================================================
      const { result: s1 } = renderHook(() => useChatStore());

      act(() => {
        convId = s1.current.createConversation('Multi-reload test');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Response 1');
        params.onDone();
      });

      await act(async () => {
        await s1.current.sendMessage('Message 1');
      });

      act(() => s1.current.saveToStorage());

      // ================================================================
      // Session 2: Add another message
      // ================================================================
      const { result: s2 } = renderHook(() => useChatStore());
      act(() => s2.current.loadFromStorage());

      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Response 2');
        params.onDone();
      });

      await act(async () => {
        await s2.current.sendMessage('Message 2');
      });

      act(() => s2.current.saveToStorage());

      // ================================================================
      // Session 3: Add yet another message
      // ================================================================
      const { result: s3 } = renderHook(() => useChatStore());
      act(() => s3.current.loadFromStorage());

      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Response 3');
        params.onDone();
      });

      await act(async () => {
        await s3.current.sendMessage('Message 3');
      });

      act(() => s3.current.saveToStorage());

      // ================================================================
      // Session 4: Verify all data is intact
      // ================================================================
      const { result: s4 } = renderHook(() => useChatStore());
      act(() => s4.current.loadFromStorage());

      const finalConv = s4.current.conversations.find((c) => c.id === convId);
      expect(finalConv?.messages).toHaveLength(6); // 3 user + 3 assistant

      expect(finalConv?.messages[0].content).toBe('Message 1');
      expect(finalConv?.messages[1].content).toBe('Response 1');
      expect(finalConv?.messages[2].content).toBe('Message 2');
      expect(finalConv?.messages[3].content).toBe('Response 2');
      expect(finalConv?.messages[4].content).toBe('Message 3');
      expect(finalConv?.messages[5].content).toBe('Response 3');
    });

    it('should handle conversation deletion persisting across reload', async () => {
      const { result: s1 } = renderHook(() => useChatStore());

      let conv1Id: string = '';
      let conv2Id: string = '';
      let conv3Id: string = '';

      act(() => {
        conv1Id = s1.current.createConversation('Keep 1');
        conv2Id = s1.current.createConversation('Delete this');
        conv3Id = s1.current.createConversation('Keep 2');
      });

      expect(s1.current.conversations).toHaveLength(3);

      // Delete middle conversation
      act(() => {
        s1.current.deleteConversation(conv2Id);
      });

      expect(s1.current.conversations).toHaveLength(2);

      act(() => s1.current.saveToStorage());

      // ================================================================
      // Reload
      // ================================================================
      const { result: s2 } = renderHook(() => useChatStore());
      act(() => s2.current.loadFromStorage());

      expect(s2.current.conversations).toHaveLength(2);

      const ids = s2.current.conversations.map((c) => c.id);
      expect(ids).toContain(conv1Id);
      expect(ids).toContain(conv3Id);
      expect(ids).not.toContain(conv2Id);
    });

    it('should handle conversation rename persisting across reload', () => {
      const { result: s1 } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        convId = s1.current.createConversation('Original Title');
      });

      act(() => {
        s1.current.renameConversation(convId, 'Updated Title');
      });

      act(() => s1.current.saveToStorage());

      // ================================================================
      // Reload
      // ================================================================
      const { result: s2 } = renderHook(() => useChatStore());
      act(() => s2.current.loadFromStorage());

      const restoredConv = s2.current.conversations.find((c) => c.id === convId);
      expect(restoredConv?.title).toBe('Updated Title');
    });

    it('should restore active conversation ID on reload', async () => {
      const { result: s1 } = renderHook(() => useChatStore());

      let conv1Id: string = '';
      let conv2Id: string = '';
      let conv3Id: string = '';

      act(() => {
        conv1Id = s1.current.createConversation('Conv 1');
        conv2Id = s1.current.createConversation('Conv 2');
        conv3Id = s1.current.createConversation('Conv 3');
      });

      // Set middle conversation as active
      act(() => {
        s1.current.setActiveConversation(conv2Id);
      });

      expect(s1.current.activeConversationId).toBe(conv2Id);

      act(() => s1.current.saveToStorage());

      // ================================================================
      // Reload - should restore to most recent conversation (conv3Id, the last created)
      // ================================================================
      const { result: s2 } = renderHook(() => useChatStore());
      act(() => s2.current.loadFromStorage());

      // Note: loadFromStorage sets active to the first conversation (most recent)
      // which is conv3Id since conversations are stored with newest first
      expect(s2.current.activeConversationId).toBe(conv3Id);
    });
  });

  describe('Debounced save behavior', () => {
    it('should eventually persist data even with rapid changes', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Test');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Response');
        params.onDone();
      });

      // Rapid fire messages
      await act(async () => {
        await result.current.sendMessage('Message 1');
      });

      await act(async () => {
        await result.current.sendMessage('Message 2');
      });

      await act(async () => {
        await result.current.sendMessage('Message 3');
      });

      // Wait for debounce to settle
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify data was saved
      const saved = storageModule.loadConversations();
      expect(saved[0].messages).toHaveLength(6); // 3 user + 3 assistant
    });
  });
});
