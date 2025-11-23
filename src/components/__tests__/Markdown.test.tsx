/**
 * Tests for Markdown component
 * Critical: Security (XSS prevention) and rendering correctness
 * Based on CODING_STANDARDS.md Section 7.2
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Markdown } from '../Markdown';

describe('Markdown Component', () => {
  /**
   * AT-016: Markdown XSS Prevention Tests
   * These 5 tests MUST pass to ensure critical security controls are in place.
   * If any of these tests fail, it indicates a security vulnerability.
   */
  describe('AT-016: Markdown XSS Prevention (Critical Security)', () => {
    it('1. should strip <script> tags from rendered output', () => {
      const maliciousContent = 'Hello <script>alert("XSS")</script> World';

      const { container } = render(<Markdown content={maliciousContent} />);

      // CRITICAL: Script tags must never appear in the DOM
      const scriptTags = container.querySelectorAll('script');
      expect(scriptTags.length).toBe(0);

      // Verify safe content is still rendered
      expect(container.textContent).toContain('Hello');
      expect(container.textContent).toContain('World');

      // Ensure script content is not executed or visible
      expect(container.textContent).not.toContain('alert');
    });

    it('2. should strip <iframe> tags from rendered output', () => {
      const maliciousContent = 'Test <iframe src="https://evil.com"></iframe> content';

      const { container } = render(<Markdown content={maliciousContent} />);

      // CRITICAL: iframes must be stripped to prevent embedding malicious content
      const iframeTags = container.querySelectorAll('iframe');
      expect(iframeTags.length).toBe(0);

      // Verify safe content is rendered
      expect(container.textContent).toContain('Test');
      expect(container.textContent).toContain('content');
    });

    it('3. should strip onerror and other event handler attributes', () => {
      const maliciousContent = `
        <img src="invalid.jpg" onerror="alert('XSS')">
        <div onload="alert('XSS')">Test</div>
        <a href="#" onclick="alert('XSS')">Link</a>
      `;

      const { container } = render(<Markdown content={maliciousContent} />);

      // CRITICAL: No element should have event handler attributes
      const allElements = container.querySelectorAll('*');
      allElements.forEach((el) => {
        expect(el.hasAttribute('onerror')).toBe(false);
        expect(el.hasAttribute('onload')).toBe(false);
        expect(el.hasAttribute('onclick')).toBe(false);
        expect(el.hasAttribute('onmouseover')).toBe(false);
        expect(el.hasAttribute('onmouseout')).toBe(false);
      });
    });

    it('4. should strip javascript: protocol from links', () => {
      const maliciousContent = '[Click me](javascript:alert("XSS"))';

      const { container } = render(<Markdown content={maliciousContent} />);

      const link = container.querySelector('a');

      // CRITICAL: javascript: URLs must be removed or neutralized
      if (link) {
        const href = link.getAttribute('href');
        // Either href is null or doesn't contain javascript:
        expect(href === null || !href.includes('javascript:')).toBe(true);
      }
    });

    it('5. should strip dangerous data: URIs from links and images', () => {
      const maliciousLinkContent = '[Click](data:text/html,<script>alert("XSS")</script>)';
      const maliciousImageContent = '![alt](data:text/html,<script>alert("XSS")</script>)';

      const { container: linkContainer } = render(<Markdown content={maliciousLinkContent} />);
      const { container: imageContainer } = render(<Markdown content={maliciousImageContent} />);

      // CRITICAL: Dangerous data: URIs must be stripped
      const link = linkContainer.querySelector('a');
      if (link) {
        const href = link.getAttribute('href');
        // Should not contain dangerous HTML data URL
        expect(href === null || !href.includes('data:text/html')).toBe(true);
      }

      const img = imageContainer.querySelector('img');
      if (img) {
        const src = img.getAttribute('src');
        // Should not contain script tags in data URL
        expect(src === null || !src.includes('<script>')).toBe(true);
      }
    });
  });

  describe('Security - XSS Prevention (FR-003)', () => {
    it('should strip <script> tags from rendered output', () => {
      const maliciousContent = 'Hello <script>alert("XSS")</script> World';

      const { container } = render(<Markdown content={maliciousContent} />);

      // Verify script tag is not present in the DOM
      const scriptTags = container.querySelectorAll('script');
      expect(scriptTags.length).toBe(0);

      // Verify the safe content is still rendered
      expect(container.textContent).toContain('Hello');
      expect(container.textContent).toContain('World');

      // Ensure the script content is not executed or rendered
      expect(container.textContent).not.toContain('alert');
    });

    it('should sanitize onclick and other event handlers', () => {
      const maliciousContent = '<a href="#" onclick="alert(\'XSS\')">Click me</a>';

      const { container } = render(<Markdown content={maliciousContent} />);

      // Find the link element
      const link = container.querySelector('a');
      expect(link).toBeTruthy();

      // Verify onclick attribute is removed
      expect(link?.hasAttribute('onclick')).toBe(false);
    });

    it('should sanitize javascript: URLs', () => {
      const maliciousContent = '[Click me](javascript:alert("XSS"))';

      const { container } = render(<Markdown content={maliciousContent} />);

      // Find the link element
      const link = container.querySelector('a');

      // Verify link exists but javascript: URL is removed or nullified
      if (link) {
        const href = link.getAttribute('href');
        // Either href is removed (null) or it doesn't contain javascript:
        expect(href === null || !href.includes('javascript:')).toBe(true);
      }
    });

    it('should allow safe HTML elements through sanitization', () => {
      const safeContent = '<strong>Bold</strong> and <em>italic</em>';

      const { container } = render(<Markdown content={safeContent} />);

      // Verify safe HTML is rendered
      expect(container.querySelector('strong')).toBeTruthy();
      expect(container.querySelector('em')).toBeTruthy();
      expect(container.textContent).toContain('Bold');
      expect(container.textContent).toContain('italic');
    });

    it('should strip <img> tags with onerror event handlers', () => {
      const maliciousContent = '<img src="invalid.jpg" onerror="alert(\'XSS\')">';

      const { container } = render(<Markdown content={maliciousContent} />);

      // Find img element (it may exist but without the onerror)
      const img = container.querySelector('img');

      // If img exists, verify onerror is not present
      if (img) {
        expect(img.hasAttribute('onerror')).toBe(false);
      }
    });

    it('should strip <svg> tags with onload event handlers', () => {
      const maliciousContent = '<svg onload="alert(\'XSS\')"><circle r="10"/></svg>';

      const { container } = render(<Markdown content={maliciousContent} />);

      // Find svg element (it may exist but without the onload)
      const svg = container.querySelector('svg');

      // If svg exists, verify onload is not present
      if (svg) {
        expect(svg.hasAttribute('onload')).toBe(false);
      }
    });

    it('should sanitize data: URLs in links', () => {
      const maliciousContent = '[Click](data:text/html,<script>alert("XSS")</script>)';

      const { container } = render(<Markdown content={maliciousContent} />);

      const link = container.querySelector('a');

      // Verify data: URL is sanitized or link is removed
      if (link) {
        const href = link.getAttribute('href');
        // DOMPurify should strip dangerous data: URLs
        expect(href === null || !href.includes('data:text/html')).toBe(true);
      }
    });

    it('should sanitize data: URLs in images', () => {
      const maliciousContent = '![alt](data:text/html,<script>alert("XSS")</script>)';

      const { container } = render(<Markdown content={maliciousContent} />);

      const img = container.querySelector('img');

      // Verify dangerous data: URL is sanitized
      if (img) {
        const src = img.getAttribute('src');
        // Should not contain dangerous HTML data URL
        expect(src === null || !src.includes('<script>')).toBe(true);
      }
    });

    it('should sanitize vbscript: URLs', () => {
      const maliciousContent = '<a href="vbscript:msgbox">Click</a>';

      const { container } = render(<Markdown content={maliciousContent} />);

      const link = container.querySelector('a');

      if (link) {
        const href = link.getAttribute('href');
        expect(href === null || !href.includes('vbscript:')).toBe(true);
      }
    });

    it('should strip onmouseover and other event attributes', () => {
      const maliciousContent = '<div onmouseover="alert(\'XSS\')">Hover me</div>';

      const { container } = render(<Markdown content={maliciousContent} />);

      const div = container.querySelector('div.prose'); // The wrapper div

      // Check all elements don't have event handlers
      const allElements = container.querySelectorAll('*');
      allElements.forEach((el) => {
        expect(el.hasAttribute('onmouseover')).toBe(false);
        expect(el.hasAttribute('onmouseout')).toBe(false);
        expect(el.hasAttribute('onerror')).toBe(false);
        expect(el.hasAttribute('onload')).toBe(false);
      });
    });
  });

  describe('Markdown Rendering Correctness', () => {
    it('should render bold text correctly', () => {
      const content = 'This is **bold** text';

      const { container } = render(<Markdown content={content} />);

      // Verify bold tag is rendered
      const strong = container.querySelector('strong');
      expect(strong).toBeTruthy();
      expect(strong?.textContent).toBe('bold');
    });

    it('should render italic text correctly', () => {
      const content = 'This is *italic* text';

      const { container } = render(<Markdown content={content} />);

      // Verify em tag is rendered
      const em = container.querySelector('em');
      expect(em).toBeTruthy();
      expect(em?.textContent).toBe('italic');
    });

    it('should render unordered lists correctly', () => {
      const content = `
- Item 1
- Item 2
- Item 3
      `.trim();

      const { container } = render(<Markdown content={content} />);

      // Verify list is rendered
      const ul = container.querySelector('ul');
      expect(ul).toBeTruthy();

      // Verify list items
      const items = container.querySelectorAll('li');
      expect(items.length).toBe(3);
      expect(items[0].textContent).toContain('Item 1');
      expect(items[1].textContent).toContain('Item 2');
      expect(items[2].textContent).toContain('Item 3');
    });

    it('should render ordered lists correctly', () => {
      const content = `
1. First
2. Second
3. Third
      `.trim();

      const { container } = render(<Markdown content={content} />);

      // Verify ordered list is rendered
      const ol = container.querySelector('ol');
      expect(ol).toBeTruthy();

      // Verify list items
      const items = container.querySelectorAll('li');
      expect(items.length).toBe(3);
      expect(items[0].textContent).toContain('First');
      expect(items[1].textContent).toContain('Second');
      expect(items[2].textContent).toContain('Third');
    });

    it('should render code blocks with proper structure', () => {
      const content = '```javascript\nconst x = 42;\n```';

      const { container } = render(<Markdown content={content} />);

      // Verify code block structure
      const pre = container.querySelector('pre');
      expect(pre).toBeTruthy();

      const code = container.querySelector('code');
      expect(code).toBeTruthy();

      // Verify code content is present
      expect(container.textContent).toContain('const x = 42;');
    });

    it('should render inline code correctly', () => {
      const content = 'Use the `console.log()` function';

      const { container } = render(<Markdown content={content} />);

      // Verify inline code is rendered
      const code = container.querySelector('code');
      expect(code).toBeTruthy();
      expect(code?.textContent).toContain('console.log()');
    });

    it('should render links correctly', () => {
      const content = '[OpenRouter](https://openrouter.ai)';

      const { container } = render(<Markdown content={content} />);

      // Verify link is rendered
      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      expect(link?.textContent).toBe('OpenRouter');
      expect(link?.getAttribute('href')).toBe('https://openrouter.ai');
    });

    it('should handle mixed markdown correctly', () => {
      const content = `
# Header

This is **bold** and *italic* text.

- List item 1
- List item 2

\`inline code\`
      `.trim();

      const { container } = render(<Markdown content={content} />);

      // Verify all elements are rendered
      expect(container.querySelector('h1')).toBeTruthy();
      expect(container.querySelector('strong')).toBeTruthy();
      expect(container.querySelector('em')).toBeTruthy();
      expect(container.querySelector('ul')).toBeTruthy();
      expect(container.querySelector('code')).toBeTruthy();
    });
  });

  describe('Syntax Highlighting', () => {
    it('should apply hljs classes to code blocks', () => {
      const content = '```javascript\nconst x = 42;\n```';

      const { container } = render(<Markdown content={content} />);

      const code = container.querySelector('code');
      expect(code).toBeTruthy();

      // Verify hljs class is present (highlight.js applies this)
      expect(code?.classList.contains('hljs')).toBe(true);
    });

    it('should apply language-specific class to code blocks', () => {
      const content = '```python\ndef hello():\n    print("world")\n```';

      const { container } = render(<Markdown content={content} />);

      const code = container.querySelector('code');
      expect(code).toBeTruthy();

      // Verify language class is present
      expect(code?.className).toContain('language-python');
    });

    it('should handle code blocks without specified language', () => {
      const content = '```\nplain code\n```';

      const { container } = render(<Markdown content={content} />);

      const code = container.querySelector('code');
      expect(code).toBeTruthy();

      // Should still have hljs class from auto-detection
      expect(code?.classList.contains('hljs')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const { container } = render(<Markdown content="" />);

      // Should render without errors
      expect(container).toBeTruthy();
    });

    it('should handle plain text without markdown', () => {
      const content = 'Just plain text';

      const { container } = render(<Markdown content={content} />);

      // Should render the text
      expect(container.textContent).toContain('Just plain text');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <Markdown content="Test" className="custom-class" />
      );

      // Verify custom class is applied
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('custom-class');
    });

    it('should render tables correctly', () => {
      const content = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
      `.trim();

      const { container } = render(<Markdown content={content} />);

      // Verify table structure
      const table = container.querySelector('table');
      expect(table).toBeTruthy();

      const headers = container.querySelectorAll('th');
      expect(headers.length).toBe(2);
      expect(headers[0].textContent).toContain('Header 1');
      expect(headers[1].textContent).toContain('Header 2');

      const cells = container.querySelectorAll('td');
      expect(cells.length).toBe(4);
      expect(cells[0].textContent).toContain('Cell 1');
    });

    it('should render nested lists correctly', () => {
      const content = `
- Item 1
  - Nested 1.1
  - Nested 1.2
- Item 2
  - Nested 2.1
      `.trim();

      const { container } = render(<Markdown content={content} />);

      // Verify nested list structure
      const outerList = container.querySelector('ul');
      expect(outerList).toBeTruthy();

      const nestedLists = container.querySelectorAll('ul ul');
      expect(nestedLists.length).toBeGreaterThan(0);

      // Verify content
      expect(container.textContent).toContain('Item 1');
      expect(container.textContent).toContain('Nested 1.1');
      expect(container.textContent).toContain('Nested 2.1');
    });

    it('should handle Unicode and emoji correctly', () => {
      const content = 'Hello 👋 World 🌍 with Chinese: 你好';

      const { container } = render(<Markdown content={content} />);

      // Verify Unicode and emoji are rendered correctly
      expect(container.textContent).toContain('👋');
      expect(container.textContent).toContain('🌍');
      expect(container.textContent).toContain('你好');
    });

    it('should handle mixed nested markdown structures', () => {
      const content = `
# Title

Here's a list with **bold** and *italic*:

- First item with \`code\`
- Second item with [link](https://example.com)
  - Nested with **bold**

\`\`\`javascript
const x = 42;
\`\`\`
      `.trim();

      const { container } = render(<Markdown content={content} />);

      // Verify all elements are present
      expect(container.querySelector('h1')).toBeTruthy();
      expect(container.querySelector('strong')).toBeTruthy();
      expect(container.querySelector('em')).toBeTruthy();
      expect(container.querySelector('code')).toBeTruthy();
      expect(container.querySelector('a')).toBeTruthy();
      expect(container.querySelector('ul')).toBeTruthy();
      expect(container.querySelector('pre')).toBeTruthy();
    });

    it('should handle very long text without crashing', () => {
      const longText = 'Lorem ipsum '.repeat(1000);
      const content = `# Long Content\n\n${longText}`;

      const { container } = render(<Markdown content={content} />);

      // Should render without errors
      expect(container).toBeTruthy();
      expect(container.textContent).toContain('Lorem ipsum');
    });

    it('should handle blockquotes correctly', () => {
      const content = '> This is a quote\n> with multiple lines';

      const { container } = render(<Markdown content={content} />);

      const blockquote = container.querySelector('blockquote');
      expect(blockquote).toBeTruthy();
      expect(blockquote?.textContent).toContain('This is a quote');
      expect(blockquote?.textContent).toContain('with multiple lines');
    });

    it('should handle horizontal rules', () => {
      const content = 'Before\n\n---\n\nAfter';

      const { container } = render(<Markdown content={content} />);

      const hr = container.querySelector('hr');
      expect(hr).toBeTruthy();
    });
  });
});
