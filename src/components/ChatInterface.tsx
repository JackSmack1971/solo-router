/**
 * Main chat interface component
 * Handles message display, input, and streaming
 * Based on SPEC.md FR-001, FR-002, FR-003
 */

import React, { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { Send, StopCircle, AlertCircle, X, Settings, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { MessageList } from './MessageList';
import { ConversationSettingsModal } from './ConversationSettingsModal';
import type { Message } from '../types';

/**
 * Main chat interface component props
 */
interface ChatInterfaceProps {
  onOpenSettings?: () => void;
}

/**
 * Main chat interface component
 */
export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onOpenSettings }) => {
  const [input, setInput] = useState('');
  const [isConversationSettingsOpen, setIsConversationSettingsOpen] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Connect to store
  const activeConversation = useChatStore((state) => state.getActiveConversation());
  const isGenerating = useChatStore((state) => state.isGenerating);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const stopGeneration = useChatStore((state) => state.stopGeneration);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const editMessageAndRegenerate = useChatStore((state) => state.editMessageAndRegenerate);
  const error = useChatStore((state) => state.error);
  const clearError = useChatStore((state) => state.clearError);
  const availableModels = useChatStore((state) => state.availableModels);
  const lastSaved = useChatStore((state) => state.lastSaved);
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    activeConversation?.messages ?? [],
    (state: Message[], message: Message) => [...state, message]
  );
  const [isPending, startTransition] = useTransition();

  /**
   * Focus input on mount and after sending messages
   */
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeConversation?.id]);

  /**
   * Show "Saved" indicator when lastSaved changes
   */
  useEffect(() => {
    if (lastSaved !== null) {
      // Schedule state update to avoid synchronous setState in effect
      const showTimer = setTimeout(() => {
        setShowSavedIndicator(true);
      }, 0);
      // Hide after 3 seconds
      const hideTimer = setTimeout(() => {
        setShowSavedIndicator(false);
      }, 3000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [lastSaved]);

  /**
   * Handle send message
   */
  const handleSend = async () => {
    if (!input.trim() || isGenerating) {
      return;
    }

    const message = input.trim();
    const tempMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    setInput('');

    startTransition(() => {
      addOptimisticMessage(tempMessage);
    });

    // Send message through store
    await sendMessage(message);

    // Refocus input after sending (A11y requirement)
    inputRef.current?.focus();
  };

  /**
   * Handle stop generation
   */
  const handleStop = () => {
    stopGeneration();
  };

  /**
   * Handle regenerate for the last assistant message (FR-005)
   */
  const handleRegenerate = async () => {
    if (!activeConversation || isGenerating) {
      return;
    }

    const messages = activeConversation.messages;

    // Find the last assistant message and the user message before it
    let lastAssistantIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantIndex = i;
        break;
      }
    }

    if (lastAssistantIndex === -1) {
      return;
    }

    // Find the last user message before the assistant message
    let lastUserMessage = '';
    for (let i = lastAssistantIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessage = messages[i].content;
        break;
      }
    }

    if (!lastUserMessage) {
      return;
    }

    // Delete the last assistant message
    deleteMessage(activeConversation.id, messages[lastAssistantIndex].id);

    // Re-send the user message
    await sendMessage(lastUserMessage);
  };

  /**
   * Handle editing a message and regenerating the response (FR-005)
   */
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!activeConversation || isGenerating) {
      return;
    }

    await editMessageAndRegenerate(activeConversation.id, messageId, newContent);
  };

  /**
   * Handle keyboard shortcuts (FR-009)
   * - Enter: send message
   * - Shift+Enter: new line
   * - Ctrl+Enter (or Cmd+Enter): send message
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to send
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Enter without Shift to send (original behavior)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Shift+Enter allows normal line break (handled by textarea by default)
  };

  /**
   * Auto-resize textarea as user types
   */
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  // Show placeholder if no active conversation
  if (!activeConversation) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-6xl mb-4">👋</div>
          <h2 className="text-xl font-semibold">Welcome to SoloRouter Chat</h2>
          <p className="mt-2 text-sm">Create a new conversation to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {activeConversation.title}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeConversation.model}
            </p>
            {/* Saved indicator */}
            {showSavedIndicator && (
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 animate-fade-in">
                <CheckCircle2 size={12} className="text-green-600 dark:text-green-400" />
                <span>Saved</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setIsConversationSettingsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="Tune conversation settings"
        >
          <SlidersHorizontal size={18} />
          <span className="hidden sm:inline">Tune Chat</span>
        </button>
      </div>

      {/* Error Banner - R-001 */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="flex-shrink-0 text-red-600 dark:text-red-400 mt-0.5" size={20} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-1">
              Error
            </p>
            <p className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
            {/* Show settings button if error is about API key */}
            {(error.toLowerCase().includes('api key') || error.toLowerCase().includes('missing')) && onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="mt-2 flex items-center gap-1 text-sm text-red-800 dark:text-red-200 hover:text-red-900 dark:hover:text-red-100 font-medium underline"
              >
                <Settings size={14} />
                Open Settings
              </button>
            )}
          </div>
          <button
            onClick={clearError}
            className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            aria-label="Dismiss error"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Messages - Now using virtualized MessageList component */}
      <MessageList
        messages={optimisticMessages}
        availableModels={availableModels}
        isGenerating={isGenerating}
        onRegenerate={handleRegenerate}
        onEditMessage={handleEditMessage}
        onSendMessage={sendMessage}
      />

      {/* Input Area - FR-008 Mobile Keyboard Support */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-end gap-2 md:gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            disabled={isGenerating}
            rows={1}
            className="flex-1 px-3 md:px-4 py-2 md:py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-y-auto text-sm md:text-base"
            style={{ minHeight: '44px', maxHeight: '200px' }}
          />

          {/* Send or Stop button */}
          {isGenerating ? (
            <button
              onClick={handleStop}
              className="px-3 md:px-4 py-2 md:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-1 md:gap-2 font-medium text-sm md:text-base flex-shrink-0"
              aria-label="Stop generation"
            >
              <StopCircle size={18} className="md:w-5 md:h-5" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-3 md:px-4 py-2 md:py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-1 md:gap-2 font-medium text-sm md:text-base flex-shrink-0"
              aria-label="Send message"
              aria-busy={isPending}
            >
              <Send size={18} className="md:w-5 md:h-5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          )}
        </div>

        {/* Helper text (FR-009) */}
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 hidden md:block">
          Press Enter or Ctrl+Enter to send, Shift+Enter for new line
        </p>
      </div>

      {/* Conversation Settings Modal */}
      <ConversationSettingsModal
        isOpen={isConversationSettingsOpen}
        onClose={() => setIsConversationSettingsOpen(false)}
        conversation={activeConversation}
      />
    </div>
  );
};
