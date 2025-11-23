/**
 * Tests for Chat Store - Streaming Logic (AT-005)
 * Tests the streaming chat functionality and abort handling
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

describe('ChatStore - Streaming Logic (AT-005)', () => {
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

  describe('sendMessage - isGenerating flag', () => {
    it('should set isGenerating to true when starting generation', async () => {
      const { result } = renderHook(() => useChatStore());

      // Create a conversation first
      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to never resolve (keeps it generating)
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(() => new Promise(() => {}));

      // Initial state
      expect(result.current.isGenerating).toBe(false);

      // Start message send
      act(() => {
        result.current.sendMessage('Hello');
      });

      // Should be generating now
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true);
      });
    });

    it('should set isGenerating to false when generation completes', async () => {
      const { result } = renderHook(() => useChatStore());

      // Create a conversation
      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to call onDone immediately
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Hello');
        params.onDone();
      });

      // Send message
      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      // Should be done generating
      expect(result.current.isGenerating).toBe(false);
    });

    it('should set isGenerating to false when generation errors', async () => {
      const { result } = renderHook(() => useChatStore());

      // Create a conversation
      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to call onError
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onError(new Error('Test error'));
      });

      // Send message
      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      // Should be done generating
      expect(result.current.isGenerating).toBe(false);
    });
  });

  describe('sendMessage - message appending via onChunk', () => {
    it('should append chunks to assistant message progressively', async () => {
      const { result } = renderHook(() => useChatStore());

      // Create a conversation
      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to deliver chunks
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Hello');
        params.onChunk(' ');
        params.onChunk('world');
        params.onChunk('!');
        params.onDone();
      });

      // Initial message count
      expect(result.current.conversations[0].messages).toHaveLength(0);

      // Send message
      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      const conversation = result.current.conversations[0];
      const messages = conversation.messages;

      // Should have user message + assistant message
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Test message');
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].content).toBe('Hello world!');
    });

    it('should add user message before starting stream', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to check state when called
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        // When streamChat is called, the user message should already be there
        const conv = result.current.conversations[0];
        expect(conv.messages.length).toBeGreaterThanOrEqual(1);
        expect(conv.messages[0].role).toBe('user');
        expect(conv.messages[0].content).toBe('User input');

        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('User input');
      });
    });

    it('should create assistant message placeholder before streaming', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to check state when called
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        // When streamChat is called, placeholder should exist
        const conv = result.current.conversations[0];
        expect(conv.messages.length).toBe(2); // user + empty assistant
        expect(conv.messages[1].role).toBe('assistant');
        expect(conv.messages[1].content).toBe('');

        params.onChunk('Response');
        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('Test');
      });
    });
  });

  describe('sendMessage - currentAbortController management', () => {
    it('should create AbortController when starting generation', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to never resolve
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(() => new Promise(() => {}));

      // Initial state
      expect(result.current.currentAbortController).toBeNull();

      // Start message send
      act(() => {
        result.current.sendMessage('Hello');
      });

      // Should have an abort controller now
      await waitFor(() => {
        expect(result.current.currentAbortController).toBeInstanceOf(AbortController);
      });
    });

    it('should clear AbortController when generation completes', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to complete immediately
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Done');
        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      // Controller should be cleared
      expect(result.current.currentAbortController).toBeNull();
    });

    it('should pass abort signal to streamChat', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Test');
      });

      let capturedSignal: AbortSignal | undefined;

      // Mock streamChat to capture the signal
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        capturedSignal = params.signal;
        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      // Should have received a valid abort signal
      expect(capturedSignal).toBeDefined();
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('sendMessage - error handling', () => {
    it('should handle errors and set error state', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to trigger error
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onError(new Error('Network error'));
      });

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      // Should have error set
      expect(result.current.error).toBeTruthy();
      expect(result.current.isGenerating).toBe(false);
    });

    it('should not send message when no active conversation', async () => {
      const { result } = renderHook(() => useChatStore());

      // No conversation created
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      // streamChat should not have been called
      expect(streamChatMock).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No active conversation')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('stopGeneration', () => {
    it('should abort the current request', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to hang
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(() => new Promise(() => {}));

      // Start generation
      act(() => {
        result.current.sendMessage('Test');
      });

      // Wait for generation to start
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true);
        expect(result.current.currentAbortController).not.toBeNull();
      });

      // Capture the abort controller
      const abortController = result.current.currentAbortController!;
      const abortSpy = vi.spyOn(abortController, 'abort');

      // Stop generation
      act(() => {
        result.current.stopGeneration();
      });

      // Should have called abort
      expect(abortSpy).toHaveBeenCalledTimes(1);
    });

    it('should reset isGenerating flag', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to hang
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(() => new Promise(() => {}));

      // Start generation
      act(() => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true);
      });

      // Stop generation
      act(() => {
        result.current.stopGeneration();
      });

      // Should be reset
      expect(result.current.isGenerating).toBe(false);
    });

    it('should clear currentAbortController', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to hang
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(() => new Promise(() => {}));

      // Start generation
      act(() => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.currentAbortController).not.toBeNull();
      });

      // Stop generation
      act(() => {
        result.current.stopGeneration();
      });

      // Should be cleared
      expect(result.current.currentAbortController).toBeNull();
    });

    it('should do nothing if no generation is in progress', () => {
      const { result } = renderHook(() => useChatStore());

      // No generation started
      expect(result.current.currentAbortController).toBeNull();
      expect(result.current.isGenerating).toBe(false);

      // Call stopGeneration
      act(() => {
        result.current.stopGeneration();
      });

      // Should still be null/false
      expect(result.current.currentAbortController).toBeNull();
      expect(result.current.isGenerating).toBe(false);
    });
  });

  describe('sendMessage - token usage tracking', () => {
    it('should update message with token count from onDone', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to provide usage data
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Response');
        params.onDone({
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        });
      });

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      const messages = result.current.conversations[0].messages;
      const assistantMessage = messages.find(m => m.role === 'assistant');

      expect(assistantMessage?.tokenCount).toBe(15);
    });

    it('should update conversation metadata with total tokens', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Test');
      });

      // Mock streamChat to provide usage data
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Response');
        params.onDone({
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        });
      });

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      const conversation = result.current.conversations[0];
      expect(conversation.metadata?.totalTokens).toBe(15);
    });
  });
});
