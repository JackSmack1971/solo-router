/**
 * Tests for Chat Store - Message CRUD Operations (AT-004)
 * Tests message management: add, update, delete
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatStore } from '../chatStore';

describe('ChatStore - Message CRUD (AT-004)', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    const { result } = renderHook(() => useChatStore());
    act(() => {
      result.current.clearAllData();
    });

    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('addMessage', () => {
    it('should add message with generated ID and timestamp', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        convId = result.current.createConversation('Test');
      });

      const beforeAdd = Date.now();

      act(() => {
        result.current.addMessage(convId, {
          role: 'user',
          content: 'Hello, world!',
        });
      });

      const afterAdd = Date.now();
      const conversation = result.current.conversations.find(c => c.id === convId);
      const message = conversation?.messages[0];

      expect(message).toBeTruthy();
      expect(message?.id).toBeTruthy();
      expect(message?.role).toBe('user');
      expect(message?.content).toBe('Hello, world!');
      expect(message?.timestamp).toBeGreaterThanOrEqual(beforeAdd);
      expect(message?.timestamp).toBeLessThanOrEqual(afterAdd);
    });

    it('should update conversation updatedAt timestamp', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        convId = result.current.createConversation('Test');
      });

      const originalUpdatedAt = result.current.conversations[0].updatedAt;

      // Wait a bit to ensure timestamp changes
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      act(() => {
        result.current.addMessage(convId, {
          role: 'user',
          content: 'New message',
        });
      });

      vi.useRealTimers();

      const conversation = result.current.conversations.find(c => c.id === convId);
      expect(conversation?.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should update conversation metadata messageCount', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        convId = result.current.createConversation('Test');
      });

      const conversation1 = result.current.conversations.find(c => c.id === convId);
      expect(conversation1?.metadata?.messageCount).toBe(0);

      act(() => {
        result.current.addMessage(convId, {
          role: 'user',
          content: 'First message',
        });
      });

      const conversation2 = result.current.conversations.find(c => c.id === convId);
      expect(conversation2?.metadata?.messageCount).toBe(1);

      act(() => {
        result.current.addMessage(convId, {
          role: 'assistant',
          content: 'Second message',
        });
      });

      const conversation3 = result.current.conversations.find(c => c.id === convId);
      expect(conversation3?.metadata?.messageCount).toBe(2);
    });

    it('should auto-generate conversation title from first user message', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        convId = result.current.createConversation(); // Default title: 'New Conversation'
      });

      expect(result.current.conversations[0].title).toBe('New Conversation');

      act(() => {
        result.current.addMessage(convId, {
          role: 'user',
          content: 'What is the meaning of life?',
        });
      });

      const conversation = result.current.conversations.find(c => c.id === convId);
      expect(conversation?.title).toBe('What is the meaning of life?');
    });

    it('should truncate long first messages for title', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        convId = result.current.createConversation();
      });

      const longMessage = 'A'.repeat(100); // 100 characters

      act(() => {
        result.current.addMessage(convId, {
          role: 'user',
          content: longMessage,
        });
      });

      const conversation = result.current.conversations.find(c => c.id === convId);
      expect(conversation?.title).toBe('A'.repeat(50) + '...');
      expect(conversation?.title.length).toBe(53); // 50 + '...'
    });

    it('should not change title if conversation already has a custom title', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        convId = result.current.createConversation('My Custom Title');
      });

      act(() => {
        result.current.addMessage(convId, {
          role: 'user',
          content: 'This should not become the title',
        });
      });

      const conversation = result.current.conversations.find(c => c.id === convId);
      expect(conversation?.title).toBe('My Custom Title');
    });
  });

  describe('updateMessage', () => {
    it('should update message content', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      let messageId: string = '';

      act(() => {
        convId = result.current.createConversation('Test');
        result.current.addMessage(convId, {
          role: 'user',
          content: 'Original content',
        });
      });

      const conversation1 = result.current.conversations.find(c => c.id === convId);
      messageId = conversation1?.messages[0].id || '';

      act(() => {
        result.current.updateMessage(convId, messageId, 'Updated content');
      });

      const conversation2 = result.current.conversations.find(c => c.id === convId);
      const message = conversation2?.messages.find(m => m.id === messageId);

      expect(message?.content).toBe('Updated content');
    });

    it('should update conversation updatedAt timestamp', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      let messageId: string = '';

      act(() => {
        convId = result.current.createConversation('Test');
        result.current.addMessage(convId, {
          role: 'user',
          content: 'Original',
        });
      });

      const conversation1 = result.current.conversations.find(c => c.id === convId);
      messageId = conversation1?.messages[0].id || '';
      const originalUpdatedAt = conversation1?.updatedAt || 0;

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      act(() => {
        result.current.updateMessage(convId, messageId, 'Updated');
      });

      vi.useRealTimers();

      const conversation2 = result.current.conversations.find(c => c.id === convId);
      expect(conversation2?.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should not affect other messages in the conversation', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      let messageId: string = '';

      act(() => {
        convId = result.current.createConversation('Test');
        result.current.addMessage(convId, {
          role: 'user',
          content: 'First message',
        });
        result.current.addMessage(convId, {
          role: 'assistant',
          content: 'Second message',
        });
      });

      const conversation1 = result.current.conversations.find(c => c.id === convId);
      messageId = conversation1?.messages[0].id || '';

      act(() => {
        result.current.updateMessage(convId, messageId, 'Updated first');
      });

      const conversation2 = result.current.conversations.find(c => c.id === convId);
      expect(conversation2?.messages[0].content).toBe('Updated first');
      expect(conversation2?.messages[1].content).toBe('Second message');
    });
  });

  describe('deleteMessage', () => {
    it('should remove message from conversation', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      let messageId: string = '';

      act(() => {
        convId = result.current.createConversation('Test');
        result.current.addMessage(convId, {
          role: 'user',
          content: 'To delete',
        });
        result.current.addMessage(convId, {
          role: 'assistant',
          content: 'To keep',
        });
      });

      const conversation1 = result.current.conversations.find(c => c.id === convId);
      messageId = conversation1?.messages[0].id || '';

      expect(conversation1?.messages).toHaveLength(2);

      act(() => {
        result.current.deleteMessage(convId, messageId);
      });

      const conversation2 = result.current.conversations.find(c => c.id === convId);
      expect(conversation2?.messages).toHaveLength(1);
      expect(conversation2?.messages.find(m => m.id === messageId)).toBeUndefined();
    });

    it('should update conversation metadata messageCount', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      let messageId: string = '';

      act(() => {
        convId = result.current.createConversation('Test');
        result.current.addMessage(convId, {
          role: 'user',
          content: 'Message 1',
        });
        result.current.addMessage(convId, {
          role: 'assistant',
          content: 'Message 2',
        });
      });

      const conversation1 = result.current.conversations.find(c => c.id === convId);
      messageId = conversation1?.messages[0].id || '';

      expect(conversation1?.metadata?.messageCount).toBe(2);

      act(() => {
        result.current.deleteMessage(convId, messageId);
      });

      const conversation2 = result.current.conversations.find(c => c.id === convId);
      expect(conversation2?.metadata?.messageCount).toBe(1);
    });

    it('should update conversation updatedAt timestamp', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      let messageId: string = '';

      act(() => {
        convId = result.current.createConversation('Test');
        result.current.addMessage(convId, {
          role: 'user',
          content: 'To delete',
        });
      });

      const conversation1 = result.current.conversations.find(c => c.id === convId);
      messageId = conversation1?.messages[0].id || '';
      const originalUpdatedAt = conversation1?.updatedAt || 0;

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      act(() => {
        result.current.deleteMessage(convId, messageId);
      });

      vi.useRealTimers();

      const conversation2 = result.current.conversations.find(c => c.id === convId);
      expect(conversation2?.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });
  });
});
