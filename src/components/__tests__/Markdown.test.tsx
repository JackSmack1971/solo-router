/**
 * Tests for Markdown component
 * Critical: Security (XSS prevention) and rendering correctness
 * Based on CODING_STANDARDS.md Section 7.2
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Markdown } from '../Markdown';

describe('Markdown Component', () => {
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
  });
});
