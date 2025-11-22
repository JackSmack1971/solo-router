/**
 * Tests for Chat Store - Conversation CRUD Operations (AT-003)
 * Tests the core conversation management: create, read, update, delete
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatStore } from '../chatStore';
import type { Conversation } from '../../types';

describe('ChatStore - Conversation CRUD (AT-003)', () => {
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

  describe('createConversation', () => {
    it('should create a conversation with default title', () => {
      const { result } = renderHook(() => useChatStore());

      let conversationId: string = '';
      act(() => {
        conversationId = result.current.createConversation();
      });

      expect(conversationId).toBeTruthy();
      expect(result.current.conversations).toHaveLength(1);
      expect(result.current.conversations[0].title).toBe('New Conversation');
      expect(result.current.conversations[0].id).toBe(conversationId);
    });

    it('should create a conversation with custom title', () => {
      const { result } = renderHook(() => useChatStore());

      let conversationId: string = '';
      act(() => {
        conversationId = result.current.createConversation('My Custom Title');
      });

      expect(result.current.conversations).toHaveLength(1);
      expect(result.current.conversations[0].title).toBe('My Custom Title');
    });

    it('should set newly created conversation as active', () => {
      const { result } = renderHook(() => useChatStore());

      let conversationId: string = '';
      act(() => {
        conversationId = result.current.createConversation('Test');
      });

      expect(result.current.activeConversationId).toBe(conversationId);
    });

    it('should add conversation to the beginning of the list', () => {
      const { result } = renderHook(() => useChatStore());

      let firstId: string = '';
      let secondId: string = '';

      act(() => {
        firstId = result.current.createConversation('First');
      });

      act(() => {
        secondId = result.current.createConversation('Second');
      });

      expect(result.current.conversations).toHaveLength(2);
      expect(result.current.conversations[0].id).toBe(secondId);
      expect(result.current.conversations[1].id).toBe(firstId);
    });

    it('should initialize conversation with timestamps', () => {
      const { result } = renderHook(() => useChatStore());

      const beforeCreate = Date.now();

      act(() => {
        result.current.createConversation('Test');
      });

      const afterCreate = Date.now();
      const conversation = result.current.conversations[0];

      expect(conversation.createdAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(conversation.createdAt).toBeLessThanOrEqual(afterCreate);
      expect(conversation.updatedAt).toBe(conversation.createdAt);
    });
  });

  describe('setActiveConversation', () => {
    it('should set active conversation ID when conversation exists', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        convId = result.current.createConversation('Test 1');
        result.current.createConversation('Test 2');
      });

      act(() => {
        result.current.setActiveConversation(convId);
      });

      expect(result.current.activeConversationId).toBe(convId);
    });

    it('should not change active ID when conversation does not exist', () => {
      const { result } = renderHook(() => useChatStore());

      let existingId: string = '';
      act(() => {
        existingId = result.current.createConversation('Test');
      });

      // Try to set a non-existent conversation as active
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      act(() => {
        result.current.setActiveConversation('non-existent-id');
      });

      // Should still be the existing one
      expect(result.current.activeConversationId).toBe(existingId);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Conversation non-existent-id not found')
      );

      consoleSpy.mockRestore();
    });

    it('should not modify the conversations list', () => {
      const { result } = renderHook(() => useChatStore());

      let conv1Id: string = '';
      let conv2Id: string = '';

      act(() => {
        conv1Id = result.current.createConversation('Test 1');
        conv2Id = result.current.createConversation('Test 2');
      });

      const conversationsBefore = result.current.conversations;

      act(() => {
        result.current.setActiveConversation(conv1Id);
      });

      expect(result.current.conversations).toEqual(conversationsBefore);
    });
  });

  describe('renameConversation', () => {
    it('should update conversation title', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        convId = result.current.createConversation('Original Title');
      });

      act(() => {
        result.current.renameConversation(convId, 'New Title');
      });

      const conversation = result.current.conversations.find(c => c.id === convId);
      expect(conversation?.title).toBe('New Title');
    });

    it('should update the updatedAt timestamp', () => {
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
        result.current.renameConversation(convId, 'Renamed');
      });

      vi.useRealTimers();

      const conversation = result.current.conversations.find(c => c.id === convId);
      expect(conversation?.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });
  });

  describe('deleteConversation', () => {
    it('should remove conversation from the list', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        convId = result.current.createConversation('To Delete');
        result.current.createConversation('To Keep');
      });

      expect(result.current.conversations).toHaveLength(2);

      act(() => {
        result.current.deleteConversation(convId);
      });

      expect(result.current.conversations).toHaveLength(1);
      expect(result.current.conversations.find(c => c.id === convId)).toBeUndefined();
    });

    it('should set new active conversation when deleting the active one', () => {
      const { result } = renderHook(() => useChatStore());

      let firstId: string = '';
      let secondId: string = '';

      act(() => {
        firstId = result.current.createConversation('First');
        secondId = result.current.createConversation('Second');
      });

      // Second should be active (most recently created)
      expect(result.current.activeConversationId).toBe(secondId);

      act(() => {
        result.current.deleteConversation(secondId);
      });

      // Should now be the first one
      expect(result.current.activeConversationId).toBe(firstId);
    });

    it('should set active to null when deleting the last conversation', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        convId = result.current.createConversation('Only One');
      });

      act(() => {
        result.current.deleteConversation(convId);
      });

      expect(result.current.conversations).toHaveLength(0);
      expect(result.current.activeConversationId).toBeNull();
    });

    it('should not change active ID when deleting a non-active conversation', () => {
      const { result } = renderHook(() => useChatStore());

      let firstId: string = '';
      let secondId: string = '';

      act(() => {
        firstId = result.current.createConversation('First');
        secondId = result.current.createConversation('Second');
      });

      // Second is active
      expect(result.current.activeConversationId).toBe(secondId);

      act(() => {
        result.current.deleteConversation(firstId);
      });

      // Should still be second
      expect(result.current.activeConversationId).toBe(secondId);
    });
  });

  describe('getActiveConversation', () => {
    it('should return the active conversation', () => {
      const { result } = renderHook(() => useChatStore());

      let convId: string = '';
      act(() => {
        result.current.createConversation('Other');
        convId = result.current.createConversation('Active One');
      });

      const active = result.current.getActiveConversation();

      expect(active).toBeTruthy();
      expect(active?.id).toBe(convId);
      expect(active?.title).toBe('Active One');
    });

    it('should return null when no conversation is active', () => {
      const { result } = renderHook(() => useChatStore());

      const active = result.current.getActiveConversation();

      expect(active).toBeNull();
    });

    it('should return null when active ID points to non-existent conversation', () => {
      const { result } = renderHook(() => useChatStore());

      // Manually set an invalid active ID
      act(() => {
        useChatStore.setState({ activeConversationId: 'invalid-id' });
      });

      const active = result.current.getActiveConversation();

      expect(active).toBeNull();
    });
  });
});
