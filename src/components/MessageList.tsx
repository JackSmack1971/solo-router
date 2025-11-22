/**
 * MessageList component with virtualization
 * Handles efficient rendering of long message lists
 * Based on CODING_STANDARDS.md Section 11 (Performance)
 */

import React, { useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertCircle, Copy, RefreshCw, Pencil, Check, X, Info } from 'lucide-react';
import { Markdown } from './Markdown';
import type { Message, ModelSummary } from '../types';
import { calculateCost, formatCost } from '../utils/tokenUtils';

/**
 * Individual message bubble component
 */
interface MessageBubbleProps {
  message: Message;
  availableModels: ModelSummary[];
  isLastAssistantMessage?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onEdit?: (newContent: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  availableModels,
  isLastAssistantMessage = false,
  onCopy,
  onRegenerate,
  onEdit,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUser = message.role === 'user';
  const isError = message.error;

  /**
   * Calculate estimated cost for this message
   * Since we only have totalTokens, we estimate the split between prompt and completion
   * For assistant messages, we assume roughly 30% prompt / 70% completion as a heuristic
   */
  const estimatedCost = React.useMemo(() => {
    if (!message.tokenCount || !message.model) {
      return null;
    }

    // Rough heuristic: 30% prompt, 70% completion for assistant messages
    const promptTokens = Math.round(message.tokenCount * 0.3);
    const completionTokens = Math.round(message.tokenCount * 0.7);

    return calculateCost(message.model, promptTokens, completionTokens, availableModels);
  }, [message.tokenCount, message.model, availableModels]);

  /**
   * Handle copy to clipboard
   */
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    onCopy?.();
  };

  /**
   * Handle entering edit mode
   */
  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedContent(message.content);
  };

  /**
   * Handle saving edited message
   */
  const handleSaveEdit = () => {
    if (editedContent.trim() && editedContent !== message.content) {
      onEdit?.(editedContent.trim());
    }
    setIsEditing(false);
  };

  /**
   * Handle canceling edit
   */
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(message.content);
  };

  /**
   * Auto-focus textarea when entering edit mode
   */
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      textareaRef.current.selectionEnd = textareaRef.current.value.length;
    }
  }, [isEditing]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 group`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : isError
            ? 'bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        } relative`}
      >
        {/* Message metadata */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium opacity-70">
            {isUser ? 'You' : message.model || 'Assistant'}
          </span>
          {isError && <AlertCircle size={14} className="text-red-600 dark:text-red-400" />}
        </div>

        {/* Message content */}
        {isEditing ? (
          // Edit mode: show textarea and action buttons
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              onKeyDown={(e) => {
                // Ctrl+Enter or Cmd+Enter to save
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSaveEdit();
                }
                // Escape to cancel
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelEdit();
                }
              }}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                <Check size={14} />
                Save & Regenerate
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded transition-colors"
              >
                <X size={14} />
                Cancel
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ⚠️ Future messages will be removed
              </span>
            </div>
          </div>
        ) : isUser ? (
          // User messages: plain text with line breaks
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          // Assistant messages: rendered markdown
          <Markdown content={message.content} className={isError ? 'prose-p:text-red-900 dark:prose-p:text-red-100' : ''} />
        )}

        {/* Token count and cost (if available) */}
        {message.tokenCount && (
          <div className="mt-2 text-xs opacity-60">
            {message.tokenCount.toLocaleString()} tokens
            {estimatedCost !== null && (
              <span className="ml-2 inline-flex items-center gap-1" title="Estimated based on token heuristic">
                • Est. cost: {formatCost(estimatedCost)}
                <Info size={12} className="opacity-50" />
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!isEditing && (
          <>
            {/* User message actions (FR-005) */}
            {isUser && onEdit && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={handleStartEdit}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-white hover:text-blue-100 transition-colors rounded hover:bg-blue-700"
                  aria-label="Edit message"
                >
                  <Pencil size={14} />
                  Edit
                </button>
              </div>
            )}

            {/* Assistant message actions */}
            {!isUser && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  aria-label="Copy message"
                >
                  <Copy size={14} />
                  {copied ? 'Copied!' : 'Copy'}
                </button>

                {isLastAssistantMessage && onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                    aria-label="Regenerate response"
                  >
                    <RefreshCw size={14} />
                    Regenerate
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Loading indicator component
 */
const LoadingIndicator: React.FC = () => (
  <div className="flex justify-start mb-4">
    <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-800">
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
          <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
          <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
        </div>
        <span className="text-sm">Waiting for response...</span>
      </div>
    </div>
  </div>
);

/**
 * Empty state component (shown when no messages)
 */
interface EmptyStateProps {
  onSendMessage?: (content: string) => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onSendMessage }) => {
  const starterPrompts = [
    "Explain quantum computing like I'm 5",
    "Debug a React useEffect hook",
    "Write a Python script to parse CSV",
    "Help me understand async/await in JavaScript",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 px-4">
      <div className="text-6xl mb-4">💬</div>
      <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
      <p className="text-sm text-center max-w-md mb-6">
        Type a message below or try one of these prompts:
      </p>

      {/* Starter Prompts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
        {starterPrompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => onSendMessage?.(prompt)}
            className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-blue-400 dark:hover:border-blue-500 transition-colors text-left"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * MessageList props
 */
interface MessageListProps {
  messages: Message[];
  availableModels: ModelSummary[];
  isGenerating: boolean;
  onRegenerate?: () => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onSendMessage?: (content: string) => void;
}

/**
 * MessageList component with virtualization
 * Efficiently renders long message lists while maintaining auto-scroll behavior
 */
export const MessageList: React.FC<MessageListProps> = ({
  messages,
  availableModels,
  isGenerating,
  onRegenerate,
  onEditMessage,
  onSendMessage,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Find the last assistant message index
  let lastAssistantMessageIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantMessageIndex = i;
      break;
    }
  }

  // Show loading indicator when generating and last message is from user
  const showLoadingIndicator = isGenerating && messages.length > 0 && messages[messages.length - 1]?.role === 'user';

  // Create virtualizer
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated height of each message
    overscan: 5, // Render 5 extra items above and below viewport
  });

  /**
   * Track scroll position to determine if we should auto-scroll
   */
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = parent;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100; // Within 100px of bottom
      setShouldAutoScroll(isNearBottom);
    };

    parent.addEventListener('scroll', handleScroll);
    return () => parent.removeEventListener('scroll', handleScroll);
  }, []);

  /**
   * Auto-scroll to bottom when new messages arrive or content changes
   * Only if user is already at/near the bottom
   */
  useEffect(() => {
    if (shouldAutoScroll && parentRef.current) {
      // Scroll to bottom
      parentRef.current.scrollTo({
        top: parentRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, shouldAutoScroll]);

  // Show empty state if no messages
  if (messages.length === 0) {
    return <EmptyState onSendMessage={onSendMessage} />;
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto px-6 py-4">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const message = messages[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <MessageBubble
                message={message}
                availableModels={availableModels}
                isLastAssistantMessage={
                  message.role === 'assistant' && virtualItem.index === lastAssistantMessageIndex
                }
                onRegenerate={onRegenerate}
                onEdit={
                  message.role === 'user'
                    ? (newContent) => onEditMessage?.(message.id, newContent)
                    : undefined
                }
              />
            </div>
          );
        })}
      </div>

      {/* Loading Indicator - Phase 6 */}
      {showLoadingIndicator && <LoadingIndicator />}
    </div>
  );
};
