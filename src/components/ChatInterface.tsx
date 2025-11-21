/**
 * Main chat interface component
 * Handles message display, input, and streaming
 * Based on SPEC.md FR-001, FR-002, FR-003
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, StopCircle, AlertCircle } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { Markdown } from './Markdown';
import type { Message } from '../types';

/**
 * Individual message bubble component
 */
const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.error;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : isError
            ? 'bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        }`}
      >
        {/* Message metadata */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium opacity-70">
            {isUser ? 'You' : message.model || 'Assistant'}
          </span>
          {isError && <AlertCircle size={14} className="text-red-600 dark:text-red-400" />}
        </div>

        {/* Message content */}
        {isUser ? (
          // User messages: plain text with line breaks
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          // Assistant messages: rendered markdown
          <Markdown content={message.content} className={isError ? 'prose-p:text-red-900 dark:prose-p:text-red-100' : ''} />
        )}

        {/* Token count (if available) */}
        {message.tokenCount && (
          <div className="mt-2 text-xs opacity-60">
            {message.tokenCount.toLocaleString()} tokens
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Empty state component (shown when no messages)
 */
const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
    <div className="text-6xl mb-4">💬</div>
    <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
    <p className="text-sm text-center max-w-md">
      Type a message below to begin chatting with your selected AI model.
    </p>
  </div>
);

/**
 * Main chat interface component
 */
export const ChatInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Connect to store
  const activeConversation = useChatStore((state) => state.getActiveConversation());
  const isGenerating = useChatStore((state) => state.isGenerating);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const stopGeneration = useChatStore((state) => state.stopGeneration);

  /**
   * Auto-scroll to bottom when new messages arrive
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  /**
   * Focus input on mount
   */
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeConversation?.id]);

  /**
   * Handle send message
   */
  const handleSend = async () => {
    if (!input.trim() || isGenerating) {
      return;
    }

    const message = input.trim();
    setInput('');

    // Send message through store
    await sendMessage(message);
  };

  /**
   * Handle stop generation
   */
  const handleStop = () => {
    stopGeneration();
  };

  /**
   * Handle Enter key (Shift+Enter for new line)
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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

  const messages = activeConversation.messages;
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {activeConversation.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeConversation.model}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {hasMessages ? (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-6 py-4">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            disabled={isGenerating}
            rows={1}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-y-auto"
            style={{ minHeight: '52px', maxHeight: '200px' }}
          />

          {/* Send or Stop button */}
          {isGenerating ? (
            <button
              onClick={handleStop}
              className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
              aria-label="Stop generation"
            >
              <StopCircle size={20} />
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
              aria-label="Send message"
            >
              <Send size={20} />
              Send
            </button>
          )}
        </div>

        {/* Helper text */}
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
