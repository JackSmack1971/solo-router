/**
 * StreamingMessage component
 * Subscribes directly to the streamStore and mutates a ref-backed element to display
 * streaming assistant content without forcing React re-renders.
 */

import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useStreamStore } from '../store/streamStore';

marked.setOptions({
  breaks: true,
  gfm: true,
});

interface StreamingMessageProps {
  /**
   * The message id currently being streamed. Rendering is no-op when store's
   * activeMessageId does not match.
   */
  messageId: string;

  /**
   * Optional label (e.g., model name) to show alongside the stream indicator.
   */
  label?: string;

  /**
   * Callback for virtualization measurement so height adjustments caused by
   * streaming text are reflected immediately.
   */
  onHeightChange?: (element: HTMLElement) => void;
}

const MARKDOWN_THROTTLE_MS = 48;

const sanitizeMarkdown = (content: string): string => {
  const parsed = marked.parse(content, { async: false }) as string;

  return DOMPurify.sanitize(parsed, {
    ADD_ATTR: ['class', 'data-code', 'target', 'rel'],
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
  });
};

/**
 * Throttled markdown renderer to avoid parsing on every token and keep streaming
 * responsive. Markdown parsing is deferred to a 48ms window (~20fps) and uses
 * DOM sanitization to mitigate XSS.
 */
export const StreamingMessage: React.FC<StreamingMessageProps> = ({
  messageId,
  label,
  onHeightChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pendingHtmlRef = useRef<string>('');
  const throttleHandleRef = useRef<number | null>(null);

  const renderContent = (html: string) => {
    if (!contentRef.current) {
      return;
    }

    contentRef.current.innerHTML = html;

    if (onHeightChange && containerRef.current) {
      window.requestAnimationFrame(() => {
        if (containerRef.current) {
          onHeightChange(containerRef.current);
        }
      });
    }
  };

  useEffect(() => {
    const renderMarkdown = (markdownText: string) => {
      pendingHtmlRef.current = sanitizeMarkdown(markdownText);

      if (throttleHandleRef.current !== null) {
        return;
      }

      throttleHandleRef.current = window.setTimeout(() => {
        throttleHandleRef.current = null;
        renderContent(pendingHtmlRef.current);
      }, MARKDOWN_THROTTLE_MS);
    };

    const unsubscribe = useStreamStore.subscribe(
      (state) => ({
        activeMessageId: state.activeMessageId,
        currentStream: state.currentStream,
      }),
      (state) => {
        if (state.activeMessageId !== messageId) {
          return;
        }

        renderMarkdown(state.currentStream);
      }
    );

    // Render any existing stream value immediately on mount
    const snapshot = useStreamStore.getState();
    if (snapshot.activeMessageId === messageId && snapshot.currentStream) {
      renderMarkdown(snapshot.currentStream);
    }

    return () => {
      unsubscribe();
      if (throttleHandleRef.current !== null) {
        window.clearTimeout(throttleHandleRef.current);
        throttleHandleRef.current = null;
      }
    };
  }, [messageId]);

  return (
    <div className="flex justify-start mb-4" ref={containerRef}>
      <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 relative">
        <div className="flex items-center gap-2 mb-1 text-xs font-medium opacity-70">
          <span>{label || 'Assistant'}</span>
          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" aria-hidden="true" />
            Streaming
          </span>
        </div>
        <div
          ref={contentRef}
          className="prose prose-slate max-w-none dark:prose-invert prose-pre:bg-gray-900 prose-pre:text-gray-100"
          aria-live="polite"
          aria-atomic="false"
        />
      </div>
    </div>
  );
};

StreamingMessage.displayName = 'StreamingMessage';
