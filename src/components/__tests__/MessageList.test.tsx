/**
 * Tests for MessageList component (AT-011)
 * Tests empty state rendering, message styling, and scrolling behavior
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageList } from '../MessageList';
import type { Message, ModelSummary } from '../../types';

// Mock the Markdown component to simplify testing
vi.mock('../Markdown', () => ({
  Markdown: ({ content }: { content: string }) => (
    <div data-testid="markdown-content">{content}</div>
  ),
}));

// Mock @tanstack/react-virtual for testing
// We need to return virtual items so messages actually render
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => {
      // Create virtual items for all messages
      return Array.from({ length: count }, (_, index) => ({
        key: index,
        index,
        start: index * 100,
        size: 100,
        end: (index + 1) * 100,
      }));
    },
    getTotalSize: () => count * 100,
    measureElement: vi.fn(),
  }),
}));

// Mock toast store
vi.mock('../../store/toastStore', () => ({
  useToastStore: () => ({
    success: vi.fn(),
  }),
}));

describe('MessageList Component (AT-011)', () => {
  const mockModels: ModelSummary[] = [
    {
      id: 'test-model',
      name: 'Test Model',
      pricing: {
        prompt: '0.001',
        completion: '0.002',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock scrollIntoView and scrollTo
    Element.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  describe('Rendering Empty State (AT-011)', () => {
    it('should render empty state when no messages', () => {
      render(
        <MessageList
          messages={[]}
          availableModels={mockModels}
          isGenerating={false}
        />
      );

      const emptyStateHeading = screen.getByText('Start a conversation');
      expect(emptyStateHeading).toBeTruthy();
    });

    it('should display starter prompts in empty state', () => {
      render(
        <MessageList
          messages={[]}
          availableModels={mockModels}
          isGenerating={false}
        />
      );

      const prompt1 = screen.getByText("Explain quantum computing like I'm 5");
      const prompt2 = screen.getByText('Debug a React useEffect hook');
      expect(prompt1).toBeTruthy();
      expect(prompt2).toBeTruthy();
    });
  });

  describe('Message Styling (AT-011)', () => {
    it('should apply correct styling to user messages', () => {
      const userMessage: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello from user',
        timestamp: Date.now(),
      };

      const { container } = render(
        <MessageList
          messages={[userMessage]}
          availableModels={mockModels}
          isGenerating={false}
        />
      );

      // User messages should have blue background
      const messageContainer = container.querySelector('.bg-blue-600');
      expect(messageContainer).toBeTruthy();
      expect(messageContainer?.textContent).toContain('Hello from user');
    });

    it('should apply correct styling to assistant messages', () => {
      const assistantMessage: Message = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Hello from assistant',
        timestamp: Date.now(),
      };

      const { container } = render(
        <MessageList
          messages={[assistantMessage]}
          availableModels={mockModels}
          isGenerating={false}
        />
      );

      // Assistant messages should have gray background
      const messageContainer = container.querySelector('.bg-gray-100');
      expect(messageContainer).toBeTruthy();
    });

    it('should apply error styling to error messages', () => {
      const errorMessage: Message = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Error occurred',
        timestamp: Date.now(),
        error: true,
      };

      const { container } = render(
        <MessageList
          messages={[errorMessage]}
          availableModels={mockModels}
          isGenerating={false}
        />
      );

      // Error messages should have red background
      const messageContainer = container.querySelector('.bg-red-100');
      expect(messageContainer).toBeTruthy();
      expect(messageContainer?.textContent).toContain('Error occurred');
    });
  });

  describe('Scrolling Behavior (AT-011)', () => {
    it('should auto-scroll when new messages are added', async () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'First message',
          timestamp: Date.now(),
        },
      ];

      const { rerender } = render(
        <MessageList
          messages={messages}
          availableModels={mockModels}
          isGenerating={false}
        />
      );

      // Add a new message
      const updatedMessages: Message[] = [
        ...messages,
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Second message',
          timestamp: Date.now(),
        },
      ];

      rerender(
        <MessageList
          messages={updatedMessages}
          availableModels={mockModels}
          isGenerating={false}
        />
      );

      // Wait for the effect to run
      await waitFor(() => {
        expect(HTMLElement.prototype.scrollTo).toHaveBeenCalled();
      });
    });

    it('should show loading indicator when generating', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'User message',
          timestamp: Date.now(),
        },
      ];

      render(
        <MessageList
          messages={messages}
          availableModels={mockModels}
          isGenerating={true}
        />
      );

      const loadingText = screen.getByText('Waiting for response...');
      expect(loadingText).toBeTruthy();
    });

    it('should show "Scroll to bottom" button when not at bottom while generating', async () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'User message',
          timestamp: Date.now(),
        },
      ];

      const { container } = render(
        <MessageList
          messages={messages}
          availableModels={mockModels}
          isGenerating={true}
        />
      );

      // Simulate scrolling away from bottom by triggering scroll event
      const scrollContainer = container.querySelector('.overflow-y-auto');
      if (scrollContainer) {
        // Set scroll properties to simulate not being at bottom
        Object.defineProperty(scrollContainer, 'scrollTop', { value: 0, writable: true });
        Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, writable: true });
        Object.defineProperty(scrollContainer, 'clientHeight', { value: 500, writable: true });

        // Trigger scroll event wrapped in act
        await userEvent.setup();
        await waitFor(() => {
          scrollContainer.dispatchEvent(new Event('scroll'));
        });

        await waitFor(() => {
          const scrollButton = screen.queryByLabelText('Scroll to new messages');
          // Button should appear when not at bottom while generating
          expect(scrollButton).toBeTruthy();
        });
      }
    });
  });
});
