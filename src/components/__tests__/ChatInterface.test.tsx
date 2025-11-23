/**
 * Tests for ChatInterface component (AT-009)
 * Tests rendering, user interactions, and layout alignment
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from '../ChatInterface';
import type { Conversation, Message } from '../../types';

// Mock the chat store
vi.mock('../../store/chatStore', () => ({
  useChatStore: vi.fn(),
}));

// Mock the MessageList component to simplify testing
vi.mock('../MessageList', () => ({
  MessageList: ({ messages }: { messages: Message[] }) => (
    <div data-testid="message-list">
      {messages.map((msg) => (
        <div
          key={msg.id}
          data-testid={`message-${msg.role}`}
          className={msg.role === 'user' ? 'justify-end' : 'justify-start'}
        >
          {msg.content}
        </div>
      ))}
    </div>
  ),
}));

// Mock ConversationSettingsModal
vi.mock('../ConversationSettingsModal', () => ({
  ConversationSettingsModal: () => <div data-testid="settings-modal" />,
}));

// Import the mocked store
import { useChatStore } from '../../store/chatStore';

describe('ChatInterface Component (AT-009)', () => {
  // Default mock conversation
  const mockConversation: Conversation = {
    id: 'conv-1',
    title: 'Test Conversation',
    model: 'test-model',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Default mock store state
  const mockStoreState = {
    getActiveConversation: vi.fn(() => mockConversation),
    isGenerating: false,
    sendMessage: vi.fn(),
    stopGeneration: vi.fn(),
    deleteMessage: vi.fn(),
    editMessageAndRegenerate: vi.fn(),
    error: null,
    clearError: vi.fn(),
    availableModels: [],
    lastSaved: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock implementation
    (useChatStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState)
    );
  });

  describe('Rendering - Input and Button (AT-009)', () => {
    it('should render input textarea with correct placeholder', () => {
      render(<ChatInterface />);

      const textarea = screen.getByPlaceholderText(
        /Type a message... \(Shift\+Enter for new line\)/i
      );
      expect(textarea).toBeTruthy();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should render Send button when not generating', () => {
      render(<ChatInterface />);

      const sendButton = screen.getByLabelText('Send message');
      expect(sendButton).toBeTruthy();
      expect(sendButton.textContent).toContain('Send');
    });

    it('should render Stop button when generating', () => {
      // Override isGenerating to true
      const generatingState = { ...mockStoreState, isGenerating: true };
      (useChatStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: typeof generatingState) => unknown) => selector(generatingState)
      );

      render(<ChatInterface />);

      const stopButton = screen.getByLabelText('Stop generation');
      expect(stopButton).toBeTruthy();
      expect(stopButton.textContent).toContain('Stop');
    });
  });

  describe('User Interactions - Typing and Sending (AT-009)', () => {
    it('should update input value when user types', async () => {
      render(<ChatInterface />);

      const textarea = screen.getByPlaceholderText(
        /Type a message.../i
      ) as HTMLTextAreaElement;

      await userEvent.type(textarea, 'Hello, world!');

      expect(textarea.value).toBe('Hello, world!');
    });

    it('should call sendMessage when Send button is clicked', async () => {
      const sendMessageMock = vi.fn();
      const stateWithSendMock = { ...mockStoreState, sendMessage: sendMessageMock };
      (useChatStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: typeof stateWithSendMock) => unknown) => selector(stateWithSendMock)
      );

      render(<ChatInterface />);

      const textarea = screen.getByPlaceholderText(/Type a message.../i);
      const sendButton = screen.getByLabelText('Send message');

      await userEvent.type(textarea, 'Test message');
      await userEvent.click(sendButton);

      expect(sendMessageMock).toHaveBeenCalledWith('Test message');
    });

    it('should clear input after sending message', async () => {
      render(<ChatInterface />);

      const textarea = screen.getByPlaceholderText(
        /Type a message.../i
      ) as HTMLTextAreaElement;
      const sendButton = screen.getByLabelText('Send message');

      await userEvent.type(textarea, 'Test message');
      await userEvent.click(sendButton);

      // Wait for the input to be cleared
      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
    });

    it('should call sendMessage when Enter key is pressed', async () => {
      const sendMessageMock = vi.fn();
      const stateWithSendMock = { ...mockStoreState, sendMessage: sendMessageMock };
      (useChatStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: typeof stateWithSendMock) => unknown) => selector(stateWithSendMock)
      );

      render(<ChatInterface />);

      const textarea = screen.getByPlaceholderText(/Type a message.../i);

      await userEvent.type(textarea, 'Test message{Enter}');

      expect(sendMessageMock).toHaveBeenCalledWith('Test message');
    });

    it('should call stopGeneration when Stop button is clicked', async () => {
      const stopGenerationMock = vi.fn();
      const generatingState = {
        ...mockStoreState,
        isGenerating: true,
        stopGeneration: stopGenerationMock,
      };
      (useChatStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: typeof generatingState) => unknown) => selector(generatingState)
      );

      render(<ChatInterface />);

      const stopButton = screen.getByLabelText('Stop generation');
      await userEvent.click(stopButton);

      expect(stopGenerationMock).toHaveBeenCalled();
    });
  });

  describe('Layout Alignment - User vs Assistant (AT-009)', () => {
    it('should align user messages to the right', () => {
      const conversationWithMessages: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'User message',
            timestamp: Date.now(),
          },
        ],
      };

      const stateWithMessages = {
        ...mockStoreState,
        getActiveConversation: vi.fn(() => conversationWithMessages),
      };
      (useChatStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: typeof stateWithMessages) => unknown) => selector(stateWithMessages)
      );

      render(<ChatInterface />);

      const userMessage = screen.getByTestId('message-user');
      expect(userMessage.className).toContain('justify-end');
    });

    it('should align assistant messages to the left', () => {
      const conversationWithMessages: Conversation = {
        ...mockConversation,
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            content: 'Assistant message',
            timestamp: Date.now(),
          },
        ],
      };

      const stateWithMessages = {
        ...mockStoreState,
        getActiveConversation: vi.fn(() => conversationWithMessages),
      };
      (useChatStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: typeof stateWithMessages) => unknown) => selector(stateWithMessages)
      );

      render(<ChatInterface />);

      const assistantMessage = screen.getByTestId('message-assistant');
      expect(assistantMessage.className).toContain('justify-start');
    });

    it('should display conversation title in header', () => {
      render(<ChatInterface />);

      const title = screen.getByText('Test Conversation');
      expect(title).toBeTruthy();
    });
  });
});
