/**
 * Integration Tests - Abort and Retry Stream
 * Tests aborting a stream and immediately retrying with a new request
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatStore } from '../../store/chatStore';
import * as openRouterModule from '../../services/openRouter';
import type { StreamParams } from '../../types';

// Mock the openRouter module
vi.mock('../../services/openRouter', () => ({
  defaultProvider: {
    streamChat: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  },
}));

describe('Integration - Abort and Retry Stream', () => {
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

  it('should abort stream and immediately retry with new request', async () => {
    const { result } = renderHook(() => useChatStore());

    // Create a conversation
    act(() => {
      result.current.createConversation('Test');
    });

    let secondStreamStarted = false;

    // Mock first stream that will be aborted
    const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      // Simulate slow stream
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check if aborted
      if (params.signal?.aborted) {
        return;
      }

      params.onChunk('First ');
      params.onChunk('response');
      params.onDone();
    });

    // Start first message
    act(() => {
      result.current.sendMessage('First message');
    });

    // Wait for stream to start
    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true);
    });

    // Mock second stream for retry
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      secondStreamStarted = true;
      params.onChunk('Second ');
      params.onChunk('response');
      params.onDone();
    });

    // Abort the first stream
    act(() => {
      result.current.stopGeneration();
    });

    // Verify stream was stopped
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.currentAbortController).toBeNull();

    // Immediately retry with a new message
    await act(async () => {
      await result.current.sendMessage('Second message');
    });

    // Verify second stream started successfully
    expect(secondStreamStarted).toBe(true);
    expect(result.current.isGenerating).toBe(false);

    // Verify messages are correct
    const conversation = result.current.conversations[0];
    const messages = conversation.messages;

    // Should have: first user message, partial first assistant, second user message, second assistant
    expect(messages.length).toBe(4);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('First message');
    expect(messages[1].role).toBe('assistant');
    expect(messages[2].role).toBe('user');
    expect(messages[2].content).toBe('Second message');
    expect(messages[3].role).toBe('assistant');
    expect(messages[3].content).toBe('Second response');
  });

  it('should handle rapid abort-retry cycles without state corruption', async () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.createConversation('Rapid Test');
    });

    const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
    let callCount = 0;

    // Mock multiple streams
    streamChatMock.mockImplementation(async (params: StreamParams) => {
      callCount++;
      const currentCall = callCount;

      // Simulate streaming delay
      await new Promise((resolve) => setTimeout(resolve, 30));

      if (!params.signal?.aborted) {
        params.onChunk(`Response ${currentCall}`);
        params.onDone();
      }
    });

    // Start first stream
    act(() => {
      result.current.sendMessage('Message 1');
    });

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true);
    });

    // Abort and start second stream
    act(() => {
      result.current.stopGeneration();
    });

    act(() => {
      result.current.sendMessage('Message 2');
    });

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true);
    });

    // Abort and start third stream
    act(() => {
      result.current.stopGeneration();
    });

    await act(async () => {
      await result.current.sendMessage('Message 3');
    });

    // Final state should be clean
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.currentAbortController).toBeNull();

    // Verify conversation integrity
    const conversation = result.current.conversations[0];
    expect(conversation.messages.length).toBeGreaterThan(0);
    expect(conversation.messages[0].role).toBe('user');
  });

  it('should properly clean up abort controller after abort-retry', async () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.createConversation('Cleanup Test');
    });

    const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

    // First stream - will be aborted
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (!params.signal?.aborted) {
        params.onChunk('First');
        params.onDone();
      }
    });

    // Start first stream
    act(() => {
      result.current.sendMessage('Message 1');
    });

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true);
      expect(result.current.currentAbortController).not.toBeNull();
    });

    const firstController = result.current.currentAbortController;

    // Abort
    act(() => {
      result.current.stopGeneration();
    });

    expect(result.current.currentAbortController).toBeNull();
    expect(firstController?.signal.aborted).toBe(true);

    // Second stream - should complete successfully
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      params.onChunk('Second');
      params.onDone();
    });

    // Retry
    await act(async () => {
      await result.current.sendMessage('Message 2');
    });

    // Verify new controller was created and cleaned up
    expect(result.current.currentAbortController).toBeNull();
    expect(result.current.isGenerating).toBe(false);
  });

  it('should handle abort during message preparation phase', async () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.createConversation('Preparation Test');
    });

    const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

    // Mock stream that takes time to start
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      // Simulate network delay before stream starts
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (params.signal?.aborted) {
        return;
      }

      params.onChunk('Response');
      params.onDone();
    });

    // Start message
    act(() => {
      result.current.sendMessage('Test message');
    });

    // Abort very quickly (before stream really starts)
    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true);
    });

    act(() => {
      result.current.stopGeneration();
    });

    // Should be in clean state
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.currentAbortController).toBeNull();

    // Now retry should work
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      params.onChunk('Retry response');
      params.onDone();
    });

    await act(async () => {
      await result.current.sendMessage('Retry message');
    });

    expect(result.current.isGenerating).toBe(false);
    const lastMessage = result.current.conversations[0].messages.slice(-1)[0];
    expect(lastMessage.content).toBe('Retry response');
  });

  it('should maintain conversation integrity across multiple abort-retry cycles', async () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.createConversation('Integrity Test');
    });

    const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

    // Perform 5 abort-retry cycles
    for (let i = 1; i <= 5; i++) {
      streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
        await new Promise((resolve) => setTimeout(resolve, 20));

        if (!params.signal?.aborted) {
          params.onChunk(`Response ${i}`);
          params.onDone();
        }
      });

      act(() => {
        result.current.sendMessage(`Message ${i}`);
      });

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true);
      });

      if (i < 5) {
        // Abort all except the last one
        act(() => {
          result.current.stopGeneration();
        });

        // Wait a bit before next attempt
        await new Promise((resolve) => setTimeout(resolve, 10));
      } else {
        // Let the last one complete
        await waitFor(() => {
          expect(result.current.isGenerating).toBe(false);
        }, { timeout: 1000 });
      }
    }

    // Verify conversation state is coherent
    const conversation = result.current.conversations[0];
    expect(conversation.messages.length).toBeGreaterThan(0);

    // All messages should have valid IDs
    conversation.messages.forEach((msg) => {
      expect(msg.id).toBeDefined();
      expect(msg.timestamp).toBeGreaterThan(0);
    });

    // Last message should be the completed one
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    expect(lastMessage.content).toContain('Response 5');
  });

  it('should track timing of abort-retry operations', async () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.createConversation('Timing Test');
    });

    const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

    // First stream
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (!params.signal?.aborted) {
        params.onChunk('First');
        params.onDone();
      }
    });

    const startTime = performance.now();

    // Start first stream
    act(() => {
      result.current.sendMessage('Message 1');
    });

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true);
    });

    const abortTime = performance.now();

    // Abort
    act(() => {
      result.current.stopGeneration();
    });

    const afterAbortTime = performance.now();

    // Abort should be nearly instantaneous (< 50ms)
    const abortDuration = afterAbortTime - abortTime;
    expect(abortDuration).toBeLessThan(50);

    // Second stream
    streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
      params.onChunk('Second');
      params.onDone();
    });

    // Retry
    await act(async () => {
      await result.current.sendMessage('Message 2');
    });

    const endTime = performance.now();

    // Total operation should complete in reasonable time (< 500ms)
    const totalDuration = endTime - startTime;
    expect(totalDuration).toBeLessThan(500);

    // Verify final state
    expect(result.current.isGenerating).toBe(false);
  });
});
