/**
 * Markdown rendering component with syntax highlighting
 * Uses marked for parsing, DOMPurify for sanitization, and highlight.js for code blocks
 * Based on CODING_STANDARDS.md Section 7 and SPEC.md FR-003
 */

import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

/**
 * Custom renderer for code blocks with syntax highlighting
 */
const renderer = new marked.Renderer();

renderer.code = function({ text, lang }: { text: string; lang?: string; escaped?: boolean }): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const highlighted = hljs.highlight(text, { language: lang }).value;
      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
    } catch (err) {
      console.warn('[Markdown] Failed to highlight code:', err);
    }
  }
  // Auto-detect language if not specified or invalid
  const highlighted = hljs.highlightAuto(text).value;
  return `<pre><code class="hljs">${highlighted}</code></pre>`;
};

/**
 * Configure marked options
 */
marked.setOptions({
  renderer,
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
});

interface MarkdownProps {
  /**
   * The markdown content to render
   */
  content: string;

  /**
   * Optional className to apply to the container
   */
  className?: string;
}

/**
 * Markdown component - renders markdown content with syntax highlighting
 * Memoized to prevent unnecessary re-renders
 */
export const Markdown: React.FC<MarkdownProps> = React.memo(({ content, className = '' }) => {
  // Parse and sanitize markdown
  const html = useMemo(() => {
    // Parse markdown to HTML
    const rawHtml = marked.parse(content, { async: false }) as string;

    // Sanitize HTML to prevent XSS attacks
    // CRITICAL: Never skip sanitization for user or model-generated content
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      // Allow code blocks with class attributes for syntax highlighting
      ADD_ATTR: ['class'],
      // Allow target="_blank" for links
      ADD_TAGS: ['iframe'],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
    });

    return cleanHtml;
  }, [content]);

  return (
    <div
      className={`prose prose-slate max-w-none dark:prose-invert prose-pre:bg-gray-900 prose-pre:text-gray-100 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

Markdown.displayName = 'Markdown';
