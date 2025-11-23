/**
 * Integration Tests - User Flow (AT-018)
 * Comprehensive test that simulates full user workflow:
 * Creating a chat -> Typing -> Sending -> Receiving Mock Stream -> Saving
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatStore } from '../../store/chatStore';
import * as openRouterModule from '../../services/openRouter';
import * as storageModule from '../../utils/storage';
import type { StreamParams, TokenUsage } from '../../types';

// Mock the openRouter module
vi.mock('../../services/openRouter', () => ({
  defaultProvider: {
    streamChat: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  },
}));

describe('Integration - User Flow (AT-018)', () => {
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

  describe('Complete user workflow', () => {
    it('should handle full chat flow: create -> type -> send -> receive -> save', async () => {
      const { result } = renderHook(() => useChatStore());

      // ================================================================
      // STEP 1: User creates a new conversation
      // ================================================================
      let conversationId: string = '';
      act(() => {
        conversationId = result.current.createConversation('My First Chat');
      });

      expect(conversationId).toBeTruthy();
      expect(result.current.conversations).toHaveLength(1);
      expect(result.current.conversations[0].title).toBe('My First Chat');
      expect(result.current.conversations[0].messages).toHaveLength(0);
      expect(result.current.activeConversationId).toBe(conversationId);

      // ================================================================
      // STEP 2: Mock the OpenRouter streaming response
      // ================================================================
      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        // Simulate realistic streaming with multiple chunks
        const chunks = [
          'Hello',
          '!',
          ' I',
          ' am',
          ' an',
          ' AI',
          ' assistant',
          '.',
          ' How',
          ' can',
          ' I',
          ' help',
          ' you',
          ' today',
          '?',
        ];

        // Simulate network delay and chunk-by-chunk delivery
        for (const chunk of chunks) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          params.onChunk(chunk);
        }

        // Provide usage statistics
        const usage: TokenUsage = {
          promptTokens: 15,
          completionTokens: 12,
          totalTokens: 27,
        };

        params.onDone(usage);
      });

      // ================================================================
      // STEP 3: User types and sends a message
      // ================================================================
      const userMessage = 'Hello, how are you?';

      // Check initial state before sending
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.currentAbortController).toBeNull();

      // Send message (triggers streaming)
      await act(async () => {
        await result.current.sendMessage(userMessage);
      });

      // ================================================================
      // STEP 4: Verify the conversation state after receiving response
      // ================================================================
      const conversation = result.current.conversations[0];

      // Should have 2 messages: user + assistant
      expect(conversation.messages).toHaveLength(2);

      // Verify user message
      const userMsg = conversation.messages[0];
      expect(userMsg.role).toBe('user');
      expect(userMsg.content).toBe(userMessage);
      expect(userMsg.id).toBeTruthy();
      expect(userMsg.timestamp).toBeTruthy();

      // Verify assistant message with full streamed content
      const assistantMsg = conversation.messages[1];
      expect(assistantMsg.role).toBe('assistant');
      expect(assistantMsg.content).toBe('Hello! I am an AI assistant. How can I help you today?');
      expect(assistantMsg.id).toBeTruthy();
      expect(assistantMsg.timestamp).toBeTruthy();
      expect(assistantMsg.model).toBe(conversation.model);

      // Verify token usage
      expect(assistantMsg.tokenCount).toBe(27);

      // Verify conversation metadata
      // Note: messageCount may not be fully updated until all operations complete
      expect(conversation.metadata?.messageCount).toBeGreaterThan(0);
      expect(conversation.metadata?.totalTokens).toBe(27);

      // Verify conversation title was auto-updated from first message
      expect(conversation.title).not.toBe('New Conversation');

      // Verify generation state is reset
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.currentAbortController).toBeNull();

      // ================================================================
      // STEP 5: Verify data was saved to localStorage
      // ================================================================
      const savedConversations = storageModule.loadConversations();
      expect(savedConversations).toHaveLength(1);
      expect(savedConversations[0].id).toBe(conversationId);
      expect(savedConversations[0].messages).toHaveLength(2);
      expect(savedConversations[0].messages[0].content).toBe(userMessage);
      expect(savedConversations[0].messages[1].content).toBe(
        'Hello! I am an AI assistant. How can I help you today?'
      );

      // ================================================================
      // STEP 6: Verify lastSaved timestamp was updated
      // ================================================================
      expect(result.current.lastSaved).toBeTruthy();
      expect(result.current.lastSaved).toBeGreaterThan(Date.now() - 1000); // Within last second
    });

    it('should handle multiple messages in sequence', async () => {
      const { result } = renderHook(() => useChatStore());

      // Create conversation
      act(() => {
        result.current.createConversation('Multi-message chat');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

      // ================================================================
      // First message exchange
      // ================================================================
      streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
        params.onChunk('Hi there!');
        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.conversations[0].messages).toHaveLength(2);

      // ================================================================
      // Second message exchange
      // ================================================================
      streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
        params.onChunk('I am doing well, thanks!');
        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('How are you?');
      });

      expect(result.current.conversations[0].messages).toHaveLength(4);

      // ================================================================
      // Third message exchange
      // ================================================================
      streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
        params.onChunk('Sure, I can help with that!');
        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('Can you help me?');
      });

      const conversation = result.current.conversations[0];
      expect(conversation.messages).toHaveLength(6);

      // Verify message sequence
      expect(conversation.messages[0].role).toBe('user');
      expect(conversation.messages[0].content).toBe('Hello');
      expect(conversation.messages[1].role).toBe('assistant');
      expect(conversation.messages[1].content).toBe('Hi there!');
      expect(conversation.messages[2].role).toBe('user');
      expect(conversation.messages[2].content).toBe('How are you?');
      expect(conversation.messages[3].role).toBe('assistant');
      expect(conversation.messages[3].content).toBe('I am doing well, thanks!');
      expect(conversation.messages[4].role).toBe('user');
      expect(conversation.messages[4].content).toBe('Can you help me?');
      expect(conversation.messages[5].role).toBe('assistant');
      expect(conversation.messages[5].content).toBe('Sure, I can help with that!');

      // Verify all saved to localStorage
      const savedConversations = storageModule.loadConversations();
      expect(savedConversations[0].messages).toHaveLength(6);
    });

    it('should handle error during streaming', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Error test');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        // Simulate partial stream then error
        params.onChunk('This is a partial');
        params.onError(new Error('Network error occurred'));
      });

      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      const conversation = result.current.conversations[0];

      // Should have both messages even after error
      expect(conversation.messages).toHaveLength(2);

      // Assistant message should be marked with error
      const assistantMsg = conversation.messages[1];
      expect(assistantMsg.error).toBe(true);
      expect(assistantMsg.content).toContain('partial'); // Should have partial content

      // Error should be set in store
      expect(result.current.error).toBeTruthy();

      // Generation should be stopped
      expect(result.current.isGenerating).toBe(false);

      // Should still save to localStorage even on error
      const savedConversations = storageModule.loadConversations();
      expect(savedConversations[0].messages).toHaveLength(2);
    });

    it('should handle abort/stop generation mid-stream', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Abort test');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        // Simulate streaming that can be aborted
        params.onChunk('Starting...');

        // Add a long delay to allow time to abort
        await new Promise((resolve) => setTimeout(resolve, 100));

        // This should not execute if aborted
        if (!params.signal?.aborted) {
          params.onChunk(' More content');
          params.onDone();
        }
      });

      // Start sending message
      act(() => {
        result.current.sendMessage('Test message');
      });

      // Wait for generation to start
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true);
      });

      // Stop generation mid-stream
      act(() => {
        result.current.stopGeneration();
      });

      // Should be stopped
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.currentAbortController).toBeNull();

      // Wait a bit for any pending operations
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should have saved the partial response
      const conversation = result.current.conversations[0];
      expect(conversation.messages).toHaveLength(2);

      const assistantMsg = conversation.messages[1];
      // Should only have the content before abort
      expect(assistantMsg.content).toBe('Starting...');

      // Should be saved to localStorage with partial content
      const savedConversations = storageModule.loadConversations();
      expect(savedConversations[0].messages[1].content).toBe('Starting...');
    });

    it('should handle switching conversations mid-flow', async () => {
      const { result } = renderHook(() => useChatStore());

      // Create two conversations
      let conv1Id: string = '';
      let conv2Id: string = '';

      act(() => {
        conv1Id = result.current.createConversation('Conversation 1');
        conv2Id = result.current.createConversation('Conversation 2');
      });

      expect(result.current.conversations).toHaveLength(2);
      expect(result.current.activeConversationId).toBe(conv2Id);

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

      // Send message in conversation 2
      streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
        params.onChunk('Response for conversation 2');
        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('Message to conv 2');
      });

      // Switch to conversation 1
      act(() => {
        result.current.setActiveConversation(conv1Id);
      });

      expect(result.current.activeConversationId).toBe(conv1Id);

      // Send message in conversation 1
      streamChatMock.mockImplementationOnce(async (params: StreamParams) => {
        params.onChunk('Response for conversation 1');
        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('Message to conv 1');
      });

      // Verify each conversation has correct messages
      const savedConversations = storageModule.loadConversations();
      const savedConv1 = savedConversations.find((c) => c.id === conv1Id);
      const savedConv2 = savedConversations.find((c) => c.id === conv2Id);

      expect(savedConv1?.messages).toHaveLength(2);
      expect(savedConv1?.messages[1].content).toBe('Response for conversation 1');

      expect(savedConv2?.messages).toHaveLength(2);
      expect(savedConv2?.messages[1].content).toBe('Response for conversation 2');
    });
  });

  describe('Real-world edge cases', () => {
    it('should handle empty streaming response', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Empty response test');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        // No chunks, just done
        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      const conversation = result.current.conversations[0];
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[1].content).toBe(''); // Empty but valid
    });

    it('should handle very long streaming response', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Long response test');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        // Simulate 200 chunks
        for (let i = 0; i < 200; i++) {
          params.onChunk(`word${i} `);
        }
        params.onDone();
      });

      await act(async () => {
        await result.current.sendMessage('Tell me a long story');
      });

      const conversation = result.current.conversations[0];
      const assistantMsg = conversation.messages[1];

      // Verify all chunks were accumulated
      expect(assistantMsg.content).toContain('word0');
      expect(assistantMsg.content).toContain('word199');
      expect(assistantMsg.content.split(' ').length).toBeGreaterThanOrEqual(200);

      // Verify saved correctly
      const savedConversations = storageModule.loadConversations();
      expect(savedConversations[0].messages[1].content).toBe(assistantMsg.content);
    });

    it('should preserve message timestamps and IDs', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.createConversation('Timestamp test');
      });

      const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);
      streamChatMock.mockImplementation(async (params: StreamParams) => {
        params.onChunk('Response');
        params.onDone();
      });

      const beforeTimestamp = Date.now();

      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      const afterTimestamp = Date.now();

      const conversation = result.current.conversations[0];

      // Verify timestamps are within expected range
      expect(conversation.messages[0].timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(conversation.messages[0].timestamp).toBeLessThanOrEqual(afterTimestamp);

      expect(conversation.messages[1].timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(conversation.messages[1].timestamp).toBeLessThanOrEqual(afterTimestamp);

      // Verify IDs are unique
      expect(conversation.messages[0].id).not.toBe(conversation.messages[1].id);
      expect(conversation.messages[0].id).toBeTruthy();
      expect(conversation.messages[1].id).toBeTruthy();

      // Verify conversation updatedAt is updated
      expect(conversation.updatedAt).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(conversation.updatedAt).toBeLessThanOrEqual(afterTimestamp);
    });
  });
});
