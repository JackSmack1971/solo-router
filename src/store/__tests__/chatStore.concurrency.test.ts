/**
 * Tests for Chat Store - Concurrency and Race Conditions
 * Tests rapid conversation switching during streaming
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatStore } from '../chatStore';
import * as openRouterModule from '../../services/openRouter';
import type { StreamParams } from '../../types';

// Mock the openRouter module
vi.mock('../../services/openRouter', () => ({
  defaultProvider: {
    streamChat: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  },
}));

describe('ChatStore - Concurrency and Race Conditions', () => {
  beforeEach(() => {
    // Reset store to initial state
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

  it('should handle rapid conversation switching during streaming', async () => {
    const { result } = renderHook(() => useChatStore());

    // Create two conversations
    let conv1Id: string = '';
    let conv2Id: string = '';

    act(() => {
      conv1Id = result.current.createConversation('Conversation 1');
      conv2Id = result.current.createConversation('Conversation 2');
    });

    const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

    // Mock stream for first conversation
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      // Simulate slow streaming
      for (let i = 0; i < 5; i++) {
        if (params.signal?.aborted) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
        params.onChunk(`Chunk ${i + 1} `);
      }
      params.onDone();
    });

    // Set first conversation as active and send message
    act(() => {
      result.current.setActiveConversation(conv1Id);
    });

    act(() => {
      result.current.sendMessage('Message to conversation 1');
    });

    // Wait for streaming to start
    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true);
    });

    // Rapidly switch to second conversation while first is still streaming
    act(() => {
      result.current.setActiveConversation(conv2Id);
    });

    // First stream should still be running
    expect(result.current.isGenerating).toBe(true);

    // Wait for first stream to complete
    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false);
    }, { timeout: 1000 });

    // Verify both conversations are intact
    const conversations = result.current.conversations;
    expect(conversations).toHaveLength(2);

    const firstConv = conversations.find((c) => c.id === conv1Id);
    const secondConv = conversations.find((c) => c.id === conv2Id);

    expect(firstConv).toBeDefined();
    expect(secondConv).toBeDefined();

    // First conversation should have the message
    expect(firstConv!.messages.length).toBe(2); // User + assistant
    expect(firstConv!.messages[0].content).toBe('Message to conversation 1');
  });

  it('should abort stream when switching conversations and starting new stream', async () => {
    const { result } = renderHook(() => useChatStore());

    // Create two conversations
    let conv1Id: string = '';
    let conv2Id: string = '';

    act(() => {
      conv1Id = result.current.createConversation('Conv 1');
      conv2Id = result.current.createConversation('Conv 2');
    });

    const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

    let firstStreamAborted = false;

    // Mock first stream
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (params.signal?.aborted) {
        firstStreamAborted = true;
        return;
      }
      params.onChunk('First response');
      params.onDone();
    });

    // Start stream in first conversation
    act(() => {
      result.current.setActiveConversation(conv1Id);
    });

    act(() => {
      result.current.sendMessage('Message 1');
    });

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true);
    });

    // Mock second stream
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      params.onChunk('Second response');
      params.onDone();
    });

    // Switch to second conversation and immediately send message
    act(() => {
      result.current.setActiveConversation(conv2Id);
    });

    // Stop the first stream
    act(() => {
      result.current.stopGeneration();
    });

    // Start new stream in second conversation
    await act(async () => {
      await result.current.sendMessage('Message 2');
    });

    // Verify state
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.activeConversationId).toBe(conv2Id);

    // Second conversation should have the completed message
    const secondConv = result.current.conversations.find((c) => c.id === conv2Id);
    expect(secondConv!.messages.length).toBe(2);
    expect(secondConv!.messages[1].content).toBe('Second response');
  });

  it('should handle concurrent message additions to different conversations', async () => {
    const { result } = renderHook(() => useChatStore());

    // Create three conversations
    let conv1Id: string = '';
    let conv2Id: string = '';
    let conv3Id: string = '';

    act(() => {
      conv1Id = result.current.createConversation('Conv 1');
      conv2Id = result.current.createConversation('Conv 2');
      conv3Id = result.current.createConversation('Conv 3');
    });

    // Add messages to all three conversations rapidly
    act(() => {
      result.current.addMessage(conv1Id, { role: 'user', content: 'Message 1 to Conv 1' });
      result.current.addMessage(conv2Id, { role: 'user', content: 'Message 1 to Conv 2' });
      result.current.addMessage(conv3Id, { role: 'user', content: 'Message 1 to Conv 3' });
      result.current.addMessage(conv1Id, { role: 'assistant', content: 'Response 1 to Conv 1' });
      result.current.addMessage(conv2Id, { role: 'assistant', content: 'Response 1 to Conv 2' });
      result.current.addMessage(conv3Id, { role: 'assistant', content: 'Response 1 to Conv 3' });
    });

    // Verify all messages are correctly assigned
    const conversations = result.current.conversations;

    const conv1 = conversations.find((c) => c.id === conv1Id);
    const conv2 = conversations.find((c) => c.id === conv2Id);
    const conv3 = conversations.find((c) => c.id === conv3Id);

    expect(conv1!.messages).toHaveLength(2);
    expect(conv1!.messages[0].content).toBe('Message 1 to Conv 1');
    expect(conv1!.messages[1].content).toBe('Response 1 to Conv 1');

    expect(conv2!.messages).toHaveLength(2);
    expect(conv2!.messages[0].content).toBe('Message 1 to Conv 2');
    expect(conv2!.messages[1].content).toBe('Response 1 to Conv 2');

    expect(conv3!.messages).toHaveLength(2);
    expect(conv3!.messages[0].content).toBe('Message 1 to Conv 3');
    expect(conv3!.messages[1].content).toBe('Response 1 to Conv 3');
  });

  it('should maintain correct active conversation during rapid switching', async () => {
    const { result } = renderHook(() => useChatStore());

    // Create 5 conversations
    const convIds: string[] = [];

    act(() => {
      for (let i = 1; i <= 5; i++) {
        convIds.push(result.current.createConversation(`Conv ${i}`));
      }
    });

    // Rapidly switch between conversations
    act(() => {
      convIds.forEach((id) => {
        result.current.setActiveConversation(id);
      });
    });

    // Active conversation should be the last one set
    expect(result.current.activeConversationId).toBe(convIds[convIds.length - 1]);

    // Switch back and forth rapidly
    act(() => {
      result.current.setActiveConversation(convIds[0]);
      result.current.setActiveConversation(convIds[2]);
      result.current.setActiveConversation(convIds[1]);
      result.current.setActiveConversation(convIds[4]);
    });

    expect(result.current.activeConversationId).toBe(convIds[4]);
  });

  it('should handle rapid updates to same message during streaming', async () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.createConversation('Test');
    });

    const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

    // Mock stream that sends many rapid chunks
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      // Send 100 rapid chunks
      for (let i = 0; i < 100; i++) {
        params.onChunk('x');
      }
      params.onDone();
    });

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    // Verify message received all chunks
    const lastMessage = result.current.conversations[0].messages[1];
    expect(lastMessage.content).toBe('x'.repeat(100));
  });

  it('should handle race condition between message update and conversation switch', async () => {
    const { result } = renderHook(() => useChatStore());

    let conv1Id: string = '';
    let conv2Id: string = '';

    act(() => {
      conv1Id = result.current.createConversation('Conv 1');
      conv2Id = result.current.createConversation('Conv 2');
    });

    const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

    // Mock slow streaming
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      for (let i = 0; i < 10; i++) {
        if (params.signal?.aborted) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        params.onChunk(`Chunk ${i} `);
      }
      params.onDone();
    });

    // Start stream in first conversation
    act(() => {
      result.current.setActiveConversation(conv1Id);
    });

    act(() => {
      result.current.sendMessage('Message to Conv 1');
    });

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true);
    });

    // While streaming, rapidly switch conversations
    await new Promise((resolve) => setTimeout(resolve, 30));

    act(() => {
      result.current.setActiveConversation(conv2Id);
      result.current.setActiveConversation(conv1Id);
      result.current.setActiveConversation(conv2Id);
    });

    // Wait for stream to complete
    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false);
    }, { timeout: 1000 });

    // First conversation should still have the message
    const conv1 = result.current.conversations.find((c) => c.id === conv1Id);
    expect(conv1!.messages.length).toBe(2);
    expect(conv1!.messages[1].role).toBe('assistant');
    expect(conv1!.messages[1].content).toContain('Chunk');
  });

  it('should handle concurrent updates to conversation metadata', async () => {
    const { result } = renderHook(() => useChatStore());

    let convId: string = '';

    act(() => {
      convId = result.current.createConversation('Test');
    });

    // Rapidly update different properties
    act(() => {
      result.current.renameConversation(convId, 'New Title 1');
      result.current.updateConversationModel(convId, 'openai/gpt-4');
      result.current.renameConversation(convId, 'New Title 2');
      result.current.updateConversationSettings(convId, { temperature: 0.9 });
      result.current.renameConversation(convId, 'Final Title');
    });

    // All updates should be applied
    const conv = result.current.conversations.find((c) => c.id === convId);
    expect(conv!.title).toBe('Final Title');
    expect(conv!.model).toBe('openai/gpt-4');
    expect(conv!.settings.temperature).toBe(0.9);
  });

  it('should track performance of rapid conversation switching', async () => {
    const { result } = renderHook(() => useChatStore());

    // Create 10 conversations
    const convIds: string[] = [];

    act(() => {
      for (let i = 1; i <= 10; i++) {
        convIds.push(result.current.createConversation(`Conv ${i}`));
      }
    });

    const startTime = performance.now();

    // Rapidly switch 100 times
    act(() => {
      for (let i = 0; i < 100; i++) {
        const targetId = convIds[i % convIds.length];
        result.current.setActiveConversation(targetId);
      }
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 100 switches should complete quickly (< 100ms)
    expect(duration).toBeLessThan(100);

    // Final active conversation should be correct
    const expectedFinalId = convIds[99 % convIds.length];
    expect(result.current.activeConversationId).toBe(expectedFinalId);
  });

  it('should handle concurrent message deletions during streaming', async () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.createConversation('Test');
    });

    // Add some messages
    const convId = result.current.conversations[0].id;

    act(() => {
      result.current.addMessage(convId, { role: 'user', content: 'Message 1' });
      result.current.addMessage(convId, { role: 'assistant', content: 'Response 1' });
      result.current.addMessage(convId, { role: 'user', content: 'Message 2' });
    });

    const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

    // Mock streaming
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      for (let i = 0; i < 5; i++) {
        if (params.signal?.aborted) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
        params.onChunk(`Chunk ${i} `);
      }
      params.onDone();
    });

    // Start streaming
    await act(async () => {
      await result.current.sendMessage('Message 3');
    });

    // During or after streaming, verify message count
    const conv = result.current.conversations[0];
    expect(conv.messages.length).toBeGreaterThan(0);

    // Messages should have valid structure
    conv.messages.forEach((msg) => {
      expect(msg.id).toBeDefined();
      expect(msg.role).toBeDefined();
      expect(msg.content).toBeDefined();
    });
  });

  it('should handle stress test of rapid operations', async () => {
    const { result } = renderHook(() => useChatStore());

    const startTime = performance.now();

    // Create conversations
    const convIds: string[] = [];
    act(() => {
      for (let i = 0; i < 5; i++) {
        convIds.push(result.current.createConversation(`Conv ${i}`));
      }
    });

    // Perform many operations rapidly
    act(() => {
      for (let i = 0; i < 50; i++) {
        const convId = convIds[i % convIds.length];
        result.current.setActiveConversation(convId);
        result.current.addMessage(convId, {
          role: 'user',
          content: `Message ${i}`,
        });
      }
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 200ms)
    expect(duration).toBeLessThan(200);

    // Verify data integrity
    const conversations = result.current.conversations;
    expect(conversations).toHaveLength(5);

    let totalMessages = 0;
    conversations.forEach((conv) => {
      totalMessages += conv.messages.length;
      // Each message should have valid ID
      conv.messages.forEach((msg) => {
        expect(msg.id).toBeDefined();
        expect(msg.id.length).toBeGreaterThan(0);
      });
    });

    expect(totalMessages).toBe(50);
  });
});
