/**
 * Integration Tests - Storage Race Conditions
 * Tests rapid updates vs debounced storage persistence
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatStore } from '../../store/chatStore';
import { loadConversations } from '../../utils/storage';
import * as openRouterModule from '../../services/openRouter';
import type { StreamParams } from '../../types';

// Mock the openRouter module
vi.mock('../../services/openRouter', () => ({
  defaultProvider: {
    streamChat: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  },
}));

describe('Integration - Storage Race Conditions', () => {
  beforeEach(() => {
    // Reset store
    const { result } = renderHook(() => useChatStore());
    act(() => {
      result.current.clearAllData();
    });

    // Clear storage
    localStorage.clear();
    sessionStorage.clear();

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle rapid updates without losing data due to debounce', async () => {
    const { result } = renderHook(() => useChatStore());

    let convId: string = '';

    act(() => {
      convId = result.current.createConversation('Rapid Updates Test');
    });

    // Perform many rapid updates
    act(() => {
      for (let i = 0; i < 20; i++) {
        result.current.addMessage(convId, {
          role: 'user',
          content: `Message ${i}`,
        });
      }
    });

    // Wait for debounced save to complete (500ms debounce + buffer)
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Load from storage
    const savedConversations = loadConversations();

    // Should have all messages
    expect(savedConversations).toHaveLength(1);
    expect(savedConversations[0].messages).toHaveLength(20);

    // Verify message order and content
    savedConversations[0].messages.forEach((msg, index) => {
      expect(msg.content).toBe(`Message ${index}`);
    });
  });

  it('should maintain data integrity with concurrent updates and saves', async () => {
    const { result } = renderHook(() => useChatStore());

    let conv1Id: string = '';
    let conv2Id: string = '';

    act(() => {
      conv1Id = result.current.createConversation('Conv 1');
      conv2Id = result.current.createConversation('Conv 2');
    });

    // Rapidly update both conversations
    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.addMessage(conv1Id, {
          role: 'user',
          content: `Conv1 Message ${i}`,
        });
        result.current.addMessage(conv2Id, {
          role: 'user',
          content: `Conv2 Message ${i}`,
        });
      }
    });

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Load and verify
    const saved = loadConversations();
    expect(saved).toHaveLength(2);

    const savedConv1 = saved.find((c) => c.id === conv1Id);
    const savedConv2 = saved.find((c) => c.id === conv2Id);

    expect(savedConv1?.messages).toHaveLength(10);
    expect(savedConv2?.messages).toHaveLength(10);
  });

  it('should handle race between manual save and debounced save', async () => {
    const { result } = renderHook(() => useChatStore());

    let convId: string = '';

    act(() => {
      convId = result.current.createConversation('Save Race Test');
    });

    // Add messages
    act(() => {
      result.current.addMessage(convId, {
        role: 'user',
        content: 'Message 1',
      });
    });

    // Manually trigger save
    act(() => {
      result.current.saveToStorage();
    });

    // Add more messages (will trigger debounced save)
    act(() => {
      result.current.addMessage(convId, {
        role: 'user',
        content: 'Message 2',
      });
    });

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Verify both messages are saved
    const saved = loadConversations();
    expect(saved[0].messages).toHaveLength(2);
    expect(saved[0].messages[0].content).toBe('Message 1');
    expect(saved[0].messages[1].content).toBe('Message 2');
  });

  it('should handle rapid conversation creation and deletion', async () => {
    const { result } = renderHook(() => useChatStore());

    const convIds: string[] = [];

    // Create many conversations rapidly
    act(() => {
      for (let i = 0; i < 10; i++) {
        convIds.push(result.current.createConversation(`Conv ${i}`));
      }
    });

    // Delete half of them
    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.deleteConversation(convIds[i]);
      }
    });

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Verify correct state in storage
    const saved = loadConversations();
    expect(saved).toHaveLength(5);

    // Remaining conversations should be the last 5
    const remainingIds = saved.map((c) => c.id);
    for (let i = 5; i < 10; i++) {
      expect(remainingIds).toContain(convIds[i]);
    }
  });

  it('should handle storage updates during streaming', async () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.createConversation('Streaming Test');
    });

    const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

    // Mock slow streaming with many chunks
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      for (let i = 0; i < 50; i++) {
        if (params.signal?.aborted) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
        params.onChunk(`word${i} `);
      }
      params.onDone();
    });

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    // Wait for final debounced save after streaming completes
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Verify message is completely saved
    const saved = loadConversations();
    expect(saved[0].messages).toHaveLength(2);

    const assistantMessage = saved[0].messages[1];
    expect(assistantMessage.content).toContain('word0');
    expect(assistantMessage.content).toContain('word49');

    // Should have all 50 words
    const wordCount = (assistantMessage.content.match(/word\d+/g) || []).length;
    expect(wordCount).toBe(50);
  });

  it('should track lastSaved timestamp correctly', async () => {
    const { result } = renderHook(() => useChatStore());

    // Initially null
    expect(result.current.lastSaved).toBeNull();

    act(() => {
      result.current.createConversation('Timestamp Test');
    });

    // Wait for debounced save
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Should have timestamp now
    const firstSaveTime = result.current.lastSaved;
    expect(firstSaveTime).not.toBeNull();
    expect(firstSaveTime).toBeGreaterThan(0);

    // Wait a bit and make another change
    await new Promise((resolve) => setTimeout(resolve, 100));

    act(() => {
      result.current.addMessage(result.current.conversations[0].id, {
        role: 'user',
        content: 'New message',
      });
    });

    // Wait for debounced save
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Timestamp should be updated
    const secondSaveTime = result.current.lastSaved;
    expect(secondSaveTime).toBeGreaterThan(firstSaveTime!);
  });

  it('should handle rapid rename operations without data loss', async () => {
    const { result } = renderHook(() => useChatStore());

    let convId: string = '';

    act(() => {
      convId = result.current.createConversation('Initial Title');
    });

    // Rapidly rename multiple times
    act(() => {
      for (let i = 0; i < 20; i++) {
        result.current.renameConversation(convId, `Title ${i}`);
      }
    });

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Should have the last title
    const saved = loadConversations();
    expect(saved[0].title).toBe('Title 19');
  });

  it('should measure performance of debounced save mechanism', async () => {
    const { result } = renderHook(() => useChatStore());

    let convId: string = '';

    act(() => {
      convId = result.current.createConversation('Performance Test');
    });

    const startTime = performance.now();

    // Perform 100 rapid updates
    act(() => {
      for (let i = 0; i < 100; i++) {
        result.current.addMessage(convId, {
          role: 'user',
          content: `Message ${i}`,
        });
      }
    });

    const updateEndTime = performance.now();
    const updateDuration = updateEndTime - startTime;

    // Updates should be very fast (< 100ms)
    expect(updateDuration).toBeLessThan(100);

    // Wait for debounced save
    await new Promise((resolve) => setTimeout(resolve, 700));

    const saveEndTime = performance.now();
    const totalDuration = saveEndTime - startTime;

    // Total time should be dominated by debounce delay (< 1000ms)
    expect(totalDuration).toBeLessThan(1000);

    // Verify all messages saved
    const saved = loadConversations();
    expect(saved[0].messages).toHaveLength(100);
  });

  it('should handle storage corruption recovery during rapid updates', async () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.createConversation('Corruption Test');
    });

    const convId = result.current.conversations[0].id;

    // Add some messages
    act(() => {
      result.current.addMessage(convId, {
        role: 'user',
        content: 'Message 1',
      });
    });

    // Wait for save
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Simulate storage corruption
    localStorage.setItem('solo_router_conversations_v1', 'invalid json {{{');

    // Try to load - should recover gracefully
    act(() => {
      result.current.loadFromStorage();
    });

    // Should have empty state after recovery
    expect(result.current.conversations).toHaveLength(0);

    // Should be able to create new conversation
    act(() => {
      result.current.createConversation('New After Recovery');
    });

    // Wait for save
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Should save successfully
    const saved = loadConversations();
    expect(saved).toHaveLength(1);
    expect(saved[0].title).toBe('New After Recovery');
  });

  it('should handle concurrent edits from multiple rapid operations', async () => {
    const { result } = renderHook(() => useChatStore());

    let convId: string = '';

    act(() => {
      convId = result.current.createConversation('Concurrent Edits');
    });

    // Add initial message
    act(() => {
      result.current.addMessage(convId, {
        role: 'user',
        content: 'Original message',
      });
    });

    const messageId = result.current.conversations[0].messages[0].id;

    // Perform rapid concurrent operations
    act(() => {
      result.current.updateMessage(convId, messageId, 'Updated 1');
      result.current.renameConversation(convId, 'New Title');
      result.current.updateMessage(convId, messageId, 'Updated 2');
      result.current.updateConversationModel(convId, 'openai/gpt-4');
      result.current.updateMessage(convId, messageId, 'Updated 3');
    });

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Verify final state
    const saved = loadConversations();
    expect(saved[0].title).toBe('New Title');
    expect(saved[0].model).toBe('openai/gpt-4');
    expect(saved[0].messages[0].content).toBe('Updated 3');
  });

  it('should handle stress test of storage with large dataset', async () => {
    const { result } = renderHook(() => useChatStore());

    const startTime = performance.now();

    // Create conversations with many messages
    act(() => {
      for (let i = 0; i < 5; i++) {
        const convId = result.current.createConversation(`Conv ${i}`);
        for (let j = 0; j < 50; j++) {
          result.current.addMessage(convId, {
            role: j % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${j} - with some longer content to simulate real usage. This message contains multiple sentences and represents typical chat content.`,
          });
        }
      }
    });

    const updateEndTime = performance.now();
    const updateDuration = updateEndTime - startTime;

    // Updates should complete reasonably fast (< 500ms)
    expect(updateDuration).toBeLessThan(500);

    // Wait for debounced save
    await new Promise((resolve) => setTimeout(resolve, 700));

    const saveEndTime = performance.now();

    // Load and verify
    const saved = loadConversations();
    expect(saved).toHaveLength(5);

    saved.forEach((conv, index) => {
      expect(conv.messages).toHaveLength(50);
      // Conversations are prepended, so the order is reversed (LIFO)
      // saved[0] is the last created (Conv 4), saved[4] is the first created (Conv 0)
      const originalIndex = 4 - index;
      expect(conv.title).toContain(`Conv ${originalIndex}`);
    });

    const totalDuration = saveEndTime - startTime;
    console.log(`Storage stress test completed in ${totalDuration.toFixed(2)}ms`);
  });
});
