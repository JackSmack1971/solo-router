/**
 * Markdown rendering component with syntax highlighting
 * Uses marked for parsing, DOMPurify for sanitization, and highlight.js for code blocks
 * Based on CODING_STANDARDS.md Section 7 and SPEC.md FR-003
 */

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { Copy, Check } from 'lucide-react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Custom renderer for code blocks with syntax highlighting
 */
const renderer = new marked.Renderer();

renderer.code = function({ text, lang }: { text: string; lang?: string; escaped?: boolean }): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const highlighted = hljs.highlight(text, { language: lang }).value;
      return `<pre class="code-block-wrapper"><code class="hljs language-${lang}" data-code="${encodeURIComponent(text)}">${highlighted}</code></pre>`;
    } catch (err) {
      console.warn('[Markdown] Failed to highlight code:', err);
    }
  }
  // Auto-detect language if not specified or invalid
  const highlighted = hljs.highlightAuto(text).value;
  return `<pre class="code-block-wrapper"><code class="hljs" data-code="${encodeURIComponent(text)}">${highlighted}</code></pre>`;
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
 * Copy button component for code blocks
 */
const CopyButton: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors opacity-0 group-hover:opacity-100"
      aria-label="Copy code"
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
};

/**
 * Markdown component - renders markdown content with syntax highlighting
 * Memoized to prevent unnecessary re-renders
 */
export const Markdown: React.FC<MarkdownProps> = React.memo(({ content, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const copyButtonRootsRef = useRef<Map<Element, Root>>(new Map());

  // Parse and sanitize markdown
  const html = useMemo(() => {
    // Parse markdown to HTML
    const rawHtml = marked.parse(content, { async: false }) as string;

    // Sanitize HTML to prevent XSS attacks
    // CRITICAL: Never skip sanitization for user or model-generated content
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      // Allow code blocks with class attributes for syntax highlighting
      ADD_ATTR: ['class', 'data-code'],
      // Allow target="_blank" for links
      ADD_TAGS: ['iframe'],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
    });

    return cleanHtml;
  }, [content]);

  // Add copy buttons to code blocks after rendering
  useEffect(() => {
    if (!containerRef.current) return;

    const codeBlocks = containerRef.current.querySelectorAll('pre.code-block-wrapper');
    const currentRoots = copyButtonRootsRef.current;

    codeBlocks.forEach((pre) => {
      const code = pre.querySelector('code');
      if (!code) return;

      const encodedCode = code.getAttribute('data-code');
      if (!encodedCode) return;

      const decodedCode = decodeURIComponent(encodedCode);

      // Add relative positioning and group class to pre element
      pre.classList.add('relative', 'group');

      // Check if copy button already exists
      if (pre.querySelector('.copy-button-container')) return;

      // Create a container for the copy button
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'copy-button-container';
      pre.appendChild(buttonContainer);

      // Create React root and render copy button
      const root = createRoot(buttonContainer);
      root.render(<CopyButton code={decodedCode} />);

      // Store root for cleanup
      currentRoots.set(buttonContainer, root);
    });

    // Cleanup function
    return () => {
      currentRoots.forEach((root) => {
        root.unmount();
      });
      currentRoots.clear();
    };
  }, [html]);

  return (
    <div
      ref={containerRef}
      className={`prose prose-slate max-w-none dark:prose-invert prose-pre:bg-gray-900 prose-pre:text-gray-100 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

Markdown.displayName = 'Markdown';
