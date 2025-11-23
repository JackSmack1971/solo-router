/**
 * Integration Tests - Export/Import Roundtrip (AT-021)
 * Tests that exporting data and immediately importing it results in an identical state
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatStore } from '../../store/chatStore';
import * as openRouterModule from '../../services/openRouter';
import * as storageModule from '../../utils/storage';
import type { StreamParams, ExportData, Conversation, AppSettings } from '../../types';

// Mock the openRouter module
vi.mock('../../services/openRouter', () => ({
  defaultProvider: {
    streamChat: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  },
}));

describe('Integration - Export/Import Roundtrip (AT-021)', () => {
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

  /**
   * Helper to perform export/import roundtrip
   */
  async function performRoundtrip(
    conversations: Conversation[],
    settings: AppSettings,
    mode: 'merge' | 'replace' = 'replace'
  ): Promise<{ conversations: Conversation[]; settings: AppSettings }> {
    // Save to storage
    storageModule.saveConversations(conversations);
    storageModule.saveSettings(settings);

    // Load from storage to get the export data
    const loadedConversations = storageModule.loadConversations();
    const loadedSettings = storageModule.loadSettings();

    // Create export data
    const exportData: ExportData = {
      version: '1.0',
      exportedAt: Date.now(),
      conversations: loadedConversations,
      settings: loadedSettings,
    };

    // Simulate file creation and reading
    const jsonString = JSON.stringify(exportData);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], 'test-export.json', { type: 'application/json' });

    // Clear storage before import (if replace mode)
    if (mode === 'replace') {
      localStorage.clear();
    }

    // Import the data
    await storageModule.importData(file, mode);

    // Load imported data
    const importedConversations = storageModule.loadConversations();
    const importedSettings = storageModule.loadSettings();

    return {
      conversations: importedConversations,
      settings: importedSettings,
    };
  }

  describe('Basic roundtrip tests', () => {
    it('should preserve conversations in export/import roundtrip', async () => {
      const { result } = renderHook(() => useChatStore());

      // Create conversations
      let conv1Id: string = '';
      let conv2Id: string = '';

      act(() => {
        conv1Id = result.current.createConversation('Test Chat 1');
        conv2Id = result.current.createConversation('Test Chat 2');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Mock response');
        params.onDone({ totalTokens: 15 });
      });

      // Add messages
      act(() => {
        result.current.setActiveConversation(conv1Id);
      });
      await act(async () => {
        await result.current.sendMessage('Hello in conv 1');
      });

      act(() => {
        result.current.setActiveConversation(conv2Id);
      });
      await act(async () => {
        await result.current.sendMessage('Hello in conv 2');
      });

      const originalConversations = result.current.conversations;
      const originalSettings = result.current.settings;

      // ================================================================
      // Perform export/import roundtrip
      // ================================================================
      const { conversations: importedConversations, settings: importedSettings } =
        await performRoundtrip(originalConversations, originalSettings);

      // ================================================================
      // VERIFY: Data is identical
      // ================================================================
      expect(importedConversations).toHaveLength(2);

      const importedConv1 = importedConversations.find((c) => c.id === conv1Id);
      const importedConv2 = importedConversations.find((c) => c.id === conv2Id);

      expect(importedConv1).toBeDefined();
      expect(importedConv2).toBeDefined();

      // Deep equality check for conversation 1
      expect(importedConv1?.id).toBe(conv1Id);
      expect(importedConv1?.title).toBe('Test Chat 1');
      expect(importedConv1?.messages).toHaveLength(2);
      expect(importedConv1?.messages[0].content).toBe('Hello in conv 1');
      expect(importedConv1?.messages[1].content).toBe('Mock response');

      // Deep equality check for conversation 2
      expect(importedConv2?.id).toBe(conv2Id);
      expect(importedConv2?.title).toBe('Test Chat 2');
      expect(importedConv2?.messages).toHaveLength(2);
      expect(importedConv2?.messages[0].content).toBe('Hello in conv 2');
      expect(importedConv2?.messages[1].content).toBe('Mock response');

      // Verify settings
      expect(importedSettings).toEqual(originalSettings);
    });

    it('should preserve all message properties in roundtrip', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Message properties test');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Detailed response');
        params.onDone({
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        });
      });

      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      const originalConv = result.current.conversations[0];
      const originalUserMsg = originalConv.messages[0];
      const originalAssistantMsg = originalConv.messages[1];

      // ================================================================
      // Perform roundtrip
      // ================================================================
      const { conversations: importedConversations } = await performRoundtrip(
        result.current.conversations,
        result.current.settings
      );

      const importedConv = importedConversations[0];
      const importedUserMsg = importedConv.messages[0];
      const importedAssistantMsg = importedConv.messages[1];

      // ================================================================
      // VERIFY: All properties preserved
      // ================================================================

      // User message
      expect(importedUserMsg.id).toBe(originalUserMsg.id);
      expect(importedUserMsg.role).toBe(originalUserMsg.role);
      expect(importedUserMsg.content).toBe(originalUserMsg.content);
      expect(importedUserMsg.timestamp).toBe(originalUserMsg.timestamp);

      // Assistant message
      expect(importedAssistantMsg.id).toBe(originalAssistantMsg.id);
      expect(importedAssistantMsg.role).toBe(originalAssistantMsg.role);
      expect(importedAssistantMsg.content).toBe(originalAssistantMsg.content);
      expect(importedAssistantMsg.timestamp).toBe(originalAssistantMsg.timestamp);
      expect(importedAssistantMsg.model).toBe(originalAssistantMsg.model);
      expect(importedAssistantMsg.tokenCount).toBe(originalAssistantMsg.tokenCount);
    });

    it('should preserve conversation metadata in roundtrip', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Metadata test');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Response');
        params.onDone({ totalTokens: 25 });
      });

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      const originalConv = result.current.conversations[0];
      const originalMetadata = originalConv.metadata;

      // ================================================================
      // Perform roundtrip
      // ================================================================
      const { conversations: importedConversations } = await performRoundtrip(
        result.current.conversations,
        result.current.settings
      );

      const importedConv = importedConversations[0];

      expect(importedConv.metadata?.messageCount).toBe(originalMetadata?.messageCount);
      expect(importedConv.metadata?.totalTokens).toBe(originalMetadata?.totalTokens);
    });

    it('should preserve conversation settings in roundtrip', async () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        convId = result.current.createConversation('Settings test');
      });

      // Update conversation settings
      act(() => {
        result.current.updateConversationSettings(convId, {
          temperature: 0.95,
          maxTokens: 4096,
          systemPrompt: 'Custom prompt',
          topP: 0.85,
          frequencyPenalty: 0.6,
          presencePenalty: 0.7,
        });
        result.current.updateConversationModel(convId, 'anthropic/claude-3.5-sonnet');
      });

      const originalConv = result.current.conversations[0];

      // ================================================================
      // Perform roundtrip
      // ================================================================
      const { conversations: importedConversations } = await performRoundtrip(
        result.current.conversations,
        result.current.settings
      );

      const importedConv = importedConversations[0];

      expect(importedConv.model).toBe(originalConv.model);
      expect(importedConv.settings.temperature).toBe(originalConv.settings.temperature);
      expect(importedConv.settings.maxTokens).toBe(originalConv.settings.maxTokens);
      expect(importedConv.settings.systemPrompt).toBe(originalConv.settings.systemPrompt);
      expect(importedConv.settings.topP).toBe(originalConv.settings.topP);
      expect(importedConv.settings.frequencyPenalty).toBe(originalConv.settings.frequencyPenalty);
      expect(importedConv.settings.presencePenalty).toBe(originalConv.settings.presencePenalty);
    });

    it('should preserve timestamps (createdAt, updatedAt) in roundtrip', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Timestamp test');
      });

      const originalConv = result.current.conversations[0];
      const originalCreatedAt = originalConv.createdAt;
      const originalUpdatedAt = originalConv.updatedAt;

      // ================================================================
      // Perform roundtrip
      // ================================================================
      const { conversations: importedConversations } = await performRoundtrip(
        result.current.conversations,
        result.current.settings
      );

      const importedConv = importedConversations[0];

      expect(importedConv.createdAt).toBe(originalCreatedAt);
      expect(importedConv.updatedAt).toBe(originalUpdatedAt);
    });

    it('should preserve app settings in roundtrip', async () => {
      const { result } = renderHook(() => useChatStore());

      // Update settings
      act(() => {
        result.current.updateSettings({
          theme: 'dark',
          defaultModel: 'openai/gpt-4-turbo',
          temperature: 0.85,
          maxTokens: 3500,
          systemPrompt: 'You are a helpful assistant',
          topP: 0.92,
          frequencyPenalty: 0.3,
          presencePenalty: 0.4,
        });
      });

      const originalSettings = result.current.settings;

      // ================================================================
      // Perform roundtrip
      // ================================================================
      const { settings: importedSettings } = await performRoundtrip(
        result.current.conversations,
        result.current.settings
      );

      expect(importedSettings).toEqual(originalSettings);
      expect(importedSettings.theme).toBe('dark');
      expect(importedSettings.defaultModel).toBe('openai/gpt-4-turbo');
      expect(importedSettings.temperature).toBe(0.85);
      expect(importedSettings.maxTokens).toBe(3500);
      expect(importedSettings.systemPrompt).toBe('You are a helpful assistant');
      expect(importedSettings.topP).toBe(0.92);
      expect(importedSettings.frequencyPenalty).toBe(0.3);
      expect(importedSettings.presencePenalty).toBe(0.4);
    });
  });

  describe('Complex data scenarios', () => {
    it('should handle empty conversations in roundtrip', async () => {
      const { result } = renderHook(() => useChatStore());

      // Create conversations without messages
      act(() => {
        result.current.createConversation('Empty 1');
        result.current.createConversation('Empty 2');
        result.current.createConversation('Empty 3');
      });

      const originalConversations = result.current.conversations;

      // ================================================================
      // Perform roundtrip
      // ================================================================
      const { conversations: importedConversations } = await performRoundtrip(
        originalConversations,
        result.current.settings
      );

      expect(importedConversations).toHaveLength(3);
      expect(importedConversations[0].messages).toHaveLength(0);
      expect(importedConversations[1].messages).toHaveLength(0);
      expect(importedConversations[2].messages).toHaveLength(0);
    });

    it('should handle conversations with many messages in roundtrip', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Many messages test');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Response');
        params.onDone();
      });

      // Add 20 message exchanges (40 messages total)
      for (let i = 0; i < 20; i++) {
        await act(async () => {
          await result.current.sendMessage(`Message ${i + 1}`);
        });
      }

      const originalConv = result.current.conversations[0];
      expect(originalConv.messages).toHaveLength(40);

      // ================================================================
      // Perform roundtrip
      // ================================================================
      const { conversations: importedConversations } = await performRoundtrip(
        result.current.conversations,
        result.current.settings
      );

      const importedConv = importedConversations[0];
      expect(importedConv.messages).toHaveLength(40);

      // Verify order is preserved
      for (let i = 0; i < 20; i++) {
        expect(importedConv.messages[i * 2].content).toBe(`Message ${i + 1}`);
        expect(importedConv.messages[i * 2 + 1].content).toBe('Response');
      }
    });

    it('should handle very long message content in roundtrip', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Long content test');
      });

      // Create a very long message (10KB of text)
      const longMessage = 'Lorem ipsum dolor sit amet. '.repeat(400); // ~10KB

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk(longMessage);
        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('Generate long response');
      });

      const originalConv = result.current.conversations[0];
      const originalLongContent = originalConv.messages[1].content;

      // ================================================================
      // Perform roundtrip
      // ================================================================
      const { conversations: importedConversations } = await performRoundtrip(
        result.current.conversations,
        result.current.settings
      );

      const importedConv = importedConversations[0];
      const importedLongContent = importedConv.messages[1].content;

      expect(importedLongContent).toBe(originalLongContent);
      expect(importedLongContent.length).toBeGreaterThan(10000);
    });

    it('should handle special characters and unicode in roundtrip', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Unicode test 你好 🎉');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Response with unicode: 你好世界 🌍 emoji 🎨 and symbols: ≠ ≤ ≥ ∑');
        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('Test with special chars: < > & " \' `');
      });

      // ================================================================
      // Perform roundtrip
      // ================================================================
      const { conversations: importedConversations } = await performRoundtrip(
        result.current.conversations,
        result.current.settings
      );

      const importedConv = importedConversations[0];

      expect(importedConv.title).toBe('Unicode test 你好 🎉');
      expect(importedConv.messages[0].content).toBe('Test with special chars: < > & " \' `');
      expect(importedConv.messages[1].content).toBe(
        'Response with unicode: 你好世界 🌍 emoji 🎨 and symbols: ≠ ≤ ≥ ∑'
      );
    });

    it('should handle code blocks and markdown in roundtrip', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Code test');
      });

      const codeResponse = `Here's a code example:

\`\`\`javascript
function hello(name) {
  console.log(\`Hello, \${name}!\`);
  return true;
}
\`\`\`

And some **bold** and *italic* text.`;

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk(codeResponse);
        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('Show me code');
      });

      const originalConv = result.current.conversations[0];
      const originalCode = originalConv.messages[1].content;

      // ================================================================
      // Perform roundtrip
      // ================================================================
      const { conversations: importedConversations } = await performRoundtrip(
        result.current.conversations,
        result.current.settings
      );

      const importedConv = importedConversations[0];
      const importedCode = importedConv.messages[1].content;

      expect(importedCode).toBe(originalCode);
      expect(importedCode).toContain('```javascript');
      expect(importedCode).toContain('function hello');
      expect(importedCode).toContain('**bold**');
    });
  });

  describe('Import modes', () => {
    it('should replace all data in replace mode', async () => {
      const { result: s1 } = renderHook(() => useChatStore());

      // Create initial data
      act(() => {
        s1.current.createConversation('Original 1');
        s1.current.createConversation('Original 2');
      });

      // Save to storage
      storageModule.saveConversations(s1.current.conversations);

      // Create new data for import
      const { result: s2 } = renderHook(() => useChatStore());
      act(() => {
        s2.current.clearAllData();
        s2.current.createConversation('Import 1');
        s2.current.createConversation('Import 2');
      });

      const importConversations = s2.current.conversations;

      // ================================================================
      // Perform import in replace mode
      // ================================================================
      const { conversations: finalConversations } = await performRoundtrip(
        importConversations,
        s2.current.settings,
        'replace'
      );

      // Should only have import data, original data replaced
      expect(finalConversations).toHaveLength(2);
      expect(finalConversations.some((c) => c.title === 'Original 1')).toBe(false);
      expect(finalConversations.some((c) => c.title === 'Original 2')).toBe(false);
      expect(finalConversations.some((c) => c.title === 'Import 1')).toBe(true);
      expect(finalConversations.some((c) => c.title === 'Import 2')).toBe(true);
    });

    it('should merge data in merge mode', async () => {
      // Create initial data
      const { result: s1 } = renderHook(() => useChatStore());

      act(() => {
        s1.current.createConversation('Original 1');
        s1.current.createConversation('Original 2');
      });

      const originalConversations = s1.current.conversations;

      // Create new conversations to import (with different IDs)
      const { result: s2 } = renderHook(() => useChatStore());

      act(() => {
        s2.current.clearAllData();
        s2.current.createConversation('Import 1');
        s2.current.createConversation('Import 2');
      });

      // Create export data from the import conversations
      const exportData: storageModule.ExportData = {
        version: '1.0',
        exportedAt: Date.now(),
        conversations: s2.current.conversations,
        settings: s2.current.settings,
      };

      const jsonString = JSON.stringify(exportData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'import-data.json', { type: 'application/json' });

      // Save the original conversations to storage (simulating existing data)
      storageModule.saveConversations(originalConversations);

      // Now import the new conversations in merge mode
      await storageModule.importData(file, 'merge');

      const finalConversations = storageModule.loadConversations();

      // Should have all 4 conversations merged
      expect(finalConversations).toHaveLength(4);

      const titles = finalConversations.map((c) => c.title);
      expect(titles).toContain('Original 1');
      expect(titles).toContain('Original 2');
      expect(titles).toContain('Import 1');
      expect(titles).toContain('Import 2');
    });

    it('should not duplicate conversations with same ID in merge mode', async () => {
      // Create initial data
      const { result: s1 } = renderHook(() => useChatStore());
      let convId: string = '';

      act(() => {
        convId = s1.current.createConversation('Test Conversation');
      });

      // Save to storage
      storageModule.saveConversations(s1.current.conversations);

      // Try to import same conversation again
      const sameConversations = s1.current.conversations;

      // ================================================================
      // Perform import in merge mode
      // ================================================================
      const { conversations: finalConversations } = await performRoundtrip(
        sameConversations,
        s1.current.settings,
        'merge'
      );

      // Should still only have 1 conversation (no duplicate)
      expect(finalConversations).toHaveLength(1);
      expect(finalConversations[0].id).toBe(convId);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty export data', async () => {
      const emptyExportData: ExportData = {
        version: '1.0',
        exportedAt: Date.now(),
        conversations: [],
        settings: storageModule.DEFAULT_SETTINGS,
      };

      const jsonString = JSON.stringify(emptyExportData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'empty-export.json', { type: 'application/json' });

      localStorage.clear();

      await storageModule.importData(file, 'replace');

      const importedConversations = storageModule.loadConversations();
      const importedSettings = storageModule.loadSettings();

      expect(importedConversations).toEqual([]);
      expect(importedSettings).toMatchObject(storageModule.DEFAULT_SETTINGS);
    });

    it('should reject invalid JSON file', async () => {
      const invalidJson = 'not valid json{{{';
      const blob = new Blob([invalidJson], { type: 'application/json' });
      const file = new File([blob], 'invalid.json', { type: 'application/json' });

      await expect(storageModule.importData(file)).rejects.toThrow();
    });

    it('should reject file with invalid structure', async () => {
      const invalidStructure = {
        version: '1.0',
        // Missing conversations and settings
      };

      const jsonString = JSON.stringify(invalidStructure);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'invalid-structure.json', { type: 'application/json' });

      await expect(storageModule.importData(file)).rejects.toThrow('Invalid backup file format');
    });

    it('should handle null and undefined values gracefully', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Null test');
        result.current.updateSettings({
          theme: 'light',
          defaultModel: null, // Explicit null
          temperature: 0.7,
          maxTokens: 2048,
          systemPrompt: null, // Explicit null
        });
      });

      // ================================================================
      // Perform roundtrip
      // ================================================================
      const { conversations: importedConversations, settings: importedSettings } =
        await performRoundtrip(result.current.conversations, result.current.settings);

      expect(importedSettings.defaultModel).toBeNull();
      expect(importedSettings.systemPrompt).toBeNull();
      expect(importedConversations).toHaveLength(1);
    });
  });

  describe('Version compatibility', () => {
    it('should handle export data with version field', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Version test');
      });

      const exportData: ExportData = {
        version: '1.0',
        exportedAt: Date.now(),
        conversations: result.current.conversations,
        settings: result.current.settings,
      };

      const jsonString = JSON.stringify(exportData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'versioned-export.json', { type: 'application/json' });

      localStorage.clear();
      await storageModule.importData(file);

      const importedConversations = storageModule.loadConversations();
      expect(importedConversations).toHaveLength(1);
      expect(importedConversations[0].title).toBe('Version test');
    });

    it('should include exportedAt timestamp in export', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Timestamp test');
      });

      const beforeExport = Date.now();

      const exportData: ExportData = {
        version: '1.0',
        exportedAt: Date.now(),
        conversations: result.current.conversations,
        settings: result.current.settings,
      };

      const afterExport = Date.now();

      expect(exportData.exportedAt).toBeGreaterThanOrEqual(beforeExport);
      expect(exportData.exportedAt).toBeLessThanOrEqual(afterExport);
    });
  });
});
