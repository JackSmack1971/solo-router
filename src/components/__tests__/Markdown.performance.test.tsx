/**
 * Performance Tests for Markdown Component
 * Benchmarks rendering performance for large markdown documents
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Markdown } from '../Markdown';

describe('Markdown Component - Performance Benchmarks', () => {
  /**
   * Helper to generate large markdown content
   */
  function generateLargeMarkdown(sizeKB: number): string {
    const targetBytes = sizeKB * 1024;
    let markdown = '';

    // Generate a mix of markdown elements
    const sections = Math.floor(targetBytes / 1024);

    for (let i = 0; i < sections; i++) {
      markdown += `# Section ${i + 1}\n\n`;
      markdown += `This is the introduction to section ${i + 1}. `;
      markdown += `It contains **bold text**, *italic text*, and \`inline code\`.\n\n`;

      // Add a list
      markdown += `## List Example\n\n`;
      for (let j = 0; j < 5; j++) {
        markdown += `- List item ${j + 1} with some descriptive text\n`;
      }
      markdown += `\n`;

      // Add a code block
      markdown += `### Code Example\n\n`;
      markdown += '```javascript\n';
      markdown += `function example${i}() {\n`;
      markdown += `  const value = ${i};\n`;
      markdown += `  return value * 2;\n`;
      markdown += `}\n`;
      markdown += '```\n\n';

      // Add a paragraph
      markdown += `This is a longer paragraph with more content. `;
      markdown += `It demonstrates how the markdown renderer handles regular text flow. `;
      markdown += `We want to make sure it performs well even with substantial content.\n\n`;
    }

    // Pad to exact size if needed
    while (markdown.length < targetBytes) {
      markdown += 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
    }

    return markdown.substring(0, targetBytes);
  }

  /**
   * Helper to generate code-heavy markdown
   */
  function generateCodeHeavyMarkdown(sizeKB: number): string {
    const targetBytes = sizeKB * 1024;
    let markdown = '# Code Examples\n\n';

    while (markdown.length < targetBytes) {
      markdown += '```javascript\n';
      markdown += 'function complexFunction(a, b, c) {\n';
      markdown += '  const result = [];\n';
      markdown += '  for (let i = 0; i < a; i++) {\n';
      markdown += '    for (let j = 0; j < b; j++) {\n';
      markdown += '      result.push(i * j + c);\n';
      markdown += '    }\n';
      markdown += '  }\n';
      markdown += '  return result;\n';
      markdown += '}\n';
      markdown += '```\n\n';
    }

    return markdown.substring(0, targetBytes);
  }

  describe('Initial Render Performance', () => {
    it('should render 10KB markdown within reasonable time', () => {
      const content = generateLargeMarkdown(10);

      const startTime = performance.now();
      const { container } = render(<Markdown content={content} />);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should render quickly (< 100ms)
      expect(duration).toBeLessThan(100);
      expect(container).toBeTruthy();

      console.log(`Render 10KB markdown: ${duration.toFixed(3)}ms`);
    });

    it('should render 50KB markdown within reasonable time', () => {
      const content = generateLargeMarkdown(50);

      const startTime = performance.now();
      const { container } = render(<Markdown content={content} />);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should render in reasonable time (< 500ms)
      expect(duration).toBeLessThan(500);
      expect(container).toBeTruthy();

      console.log(`Render 50KB markdown: ${duration.toFixed(3)}ms`);
    });

    it('should render 100KB markdown within reasonable time', () => {
      const content = generateLargeMarkdown(100);

      const startTime = performance.now();
      const { container } = render(<Markdown content={content} />);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should render in reasonable time (< 1000ms)
      expect(duration).toBeLessThan(1000);
      expect(container).toBeTruthy();

      console.log(`Render 100KB markdown: ${duration.toFixed(3)}ms`);
    });

    it('should benchmark different markdown sizes', () => {
      const sizes = [1, 5, 10, 25, 50];
      const results: Array<{ size: number; duration: number }> = [];

      sizes.forEach((size) => {
        const content = generateLargeMarkdown(size);

        const startTime = performance.now();
        const { unmount } = render(<Markdown content={content} />);
        const endTime = performance.now();

        const duration = endTime - startTime;
        results.push({ size, duration });

        // Clean up
        unmount();
      });

      console.log('Markdown render benchmark:');
      results.forEach(({ size, duration }) => {
        console.log(`  ${size}KB: ${duration.toFixed(3)}ms`);
      });

      // All should complete in reasonable time
      results.forEach(({ duration }) => {
        expect(duration).toBeLessThan(1000);
      });
    });
  });

  describe('Code Block Rendering Performance', () => {
    it('should render code-heavy markdown efficiently', () => {
      const content = generateCodeHeavyMarkdown(50);

      const startTime = performance.now();
      const { container } = render(<Markdown content={content} />);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Code highlighting is expensive but should still be reasonable
      expect(duration).toBeLessThan(1000);

      // Verify code blocks are rendered
      const codeBlocks = container.querySelectorAll('pre code');
      expect(codeBlocks.length).toBeGreaterThan(0);

      console.log(`Render 50KB code-heavy markdown: ${duration.toFixed(3)}ms, ${codeBlocks.length} code blocks`);
    });

    it('should handle multiple small code blocks efficiently', () => {
      let content = '# Code Examples\n\n';

      // Create 100 small code blocks
      for (let i = 0; i < 100; i++) {
        content += '```javascript\n';
        content += `const value${i} = ${i};\n`;
        content += '```\n\n';
      }

      const startTime = performance.now();
      const { container } = render(<Markdown content={content} />);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);

      const codeBlocks = container.querySelectorAll('pre code');
      expect(codeBlocks.length).toBe(100);

      console.log(`Render 100 small code blocks: ${duration.toFixed(3)}ms`);
    });

    it('should handle large single code block efficiently', () => {
      let codeContent = '';
      for (let i = 0; i < 1000; i++) {
        codeContent += `const variable${i} = ${i};\n`;
      }

      const content = '# Large Code Block\n\n```javascript\n' + codeContent + '```';

      const startTime = performance.now();
      const { container } = render(<Markdown content={content} />);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
      expect(container.querySelector('pre code')).toBeTruthy();

      console.log(`Render large single code block (1000 lines): ${duration.toFixed(3)}ms`);
    });
  });

  describe('Complex Markdown Structures', () => {
    it('should render nested lists efficiently', () => {
      let content = '# Nested Lists\n\n';

      for (let i = 0; i < 20; i++) {
        content += `- Item ${i}\n`;
        content += `  - Nested ${i}.1\n`;
        content += `  - Nested ${i}.2\n`;
        content += `    - Deep nested ${i}.2.1\n`;
        content += `    - Deep nested ${i}.2.2\n`;
      }

      const startTime = performance.now();
      const { container } = render(<Markdown content={content} />);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200);
      expect(container.querySelectorAll('ul').length).toBeGreaterThan(0);

      console.log(`Render nested lists: ${duration.toFixed(3)}ms`);
    });

    it('should render tables efficiently', () => {
      let content = '# Tables\n\n';

      // Create 20 tables
      for (let t = 0; t < 20; t++) {
        content += `## Table ${t + 1}\n\n`;
        content += '| Column 1 | Column 2 | Column 3 | Column 4 |\n';
        content += '|----------|----------|----------|----------|\n';

        for (let r = 0; r < 10; r++) {
          content += `| Cell ${r}.1 | Cell ${r}.2 | Cell ${r}.3 | Cell ${r}.4 |\n`;
        }

        content += '\n';
      }

      const startTime = performance.now();
      const { container } = render(<Markdown content={content} />);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);

      const tables = container.querySelectorAll('table');
      expect(tables.length).toBe(20);

      console.log(`Render 20 tables: ${duration.toFixed(3)}ms`);
    });

    it('should render mixed content efficiently', () => {
      let content = '# Mixed Content Document\n\n';

      for (let i = 0; i < 10; i++) {
        // Heading
        content += `## Section ${i + 1}\n\n`;

        // Paragraph
        content += `This is a paragraph with **bold** and *italic* text. `;
        content += `It also contains [a link](https://example.com) and \`inline code\`.\n\n`;

        // List
        content += `- List item 1\n`;
        content += `- List item 2\n`;
        content += `- List item 3\n\n`;

        // Code block
        content += '```python\n';
        content += `def function${i}():\n`;
        content += `    return ${i}\n`;
        content += '```\n\n';

        // Table
        content += '| Col 1 | Col 2 |\n';
        content += '|-------|-------|\n';
        content += `| ${i} | ${i * 2} |\n\n`;

        // Blockquote
        content += `> This is a quote in section ${i + 1}\n\n`;
      }

      const startTime = performance.now();
      const { container } = render(<Markdown content={content} />);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);

      // Verify all elements are rendered
      expect(container.querySelectorAll('h2').length).toBe(10);
      expect(container.querySelectorAll('ul').length).toBeGreaterThan(0);
      expect(container.querySelectorAll('pre code').length).toBe(10);
      expect(container.querySelectorAll('table').length).toBe(10);
      expect(container.querySelectorAll('blockquote').length).toBe(10);

      console.log(`Render mixed content: ${duration.toFixed(3)}ms`);
    });
  });

  describe('Sanitization Performance', () => {
    it('should sanitize large content with potential XSS efficiently', () => {
      let content = '# Security Test\n\n';

      // Mix legitimate content with XSS attempts
      for (let i = 0; i < 50; i++) {
        content += `## Section ${i}\n\n`;
        content += `Normal paragraph with **bold** text.\n\n`;
        content += `<script>alert('xss${i}')</script>\n\n`;
        content += `![alt](javascript:alert('xss${i}'))\n\n`;
        content += `[link](data:text/html,<script>alert('xss${i}')</script>)\n\n`;
      }

      const startTime = performance.now();
      const { container } = render(<Markdown content={content} />);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Sanitization adds overhead but should still be reasonable
      expect(duration).toBeLessThan(1000);

      // Verify no script tags made it through
      const scripts = container.querySelectorAll('script');
      expect(scripts.length).toBe(0);

      console.log(`Render with sanitization (50 sections): ${duration.toFixed(3)}ms`);
    });
  });

  describe('Re-render Performance', () => {
    it('should handle content updates efficiently', () => {
      const initialContent = generateLargeMarkdown(10);

      const { rerender } = render(<Markdown content={initialContent} />);

      // Update content 10 times
      const durations: number[] = [];

      for (let i = 0; i < 10; i++) {
        const newContent = initialContent + `\n\nUpdate ${i}`;

        const startTime = performance.now();
        rerender(<Markdown content={newContent} />);
        const endTime = performance.now();

        durations.push(endTime - startTime);
      }

      // Re-renders should be fast thanks to memoization
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(avgDuration).toBeLessThan(100);

      console.log(`Average re-render time: ${avgDuration.toFixed(3)}ms`);
      console.log(`  Min: ${Math.min(...durations).toFixed(3)}ms`);
      console.log(`  Max: ${Math.max(...durations).toFixed(3)}ms`);
    });

    it('should benefit from memoization on identical content', () => {
      const content = generateLargeMarkdown(50);

      const { rerender } = render(<Markdown content={content} />);

      // Re-render with same content multiple times
      const durations: number[] = [];

      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        rerender(<Markdown content={content} />);
        const endTime = performance.now();

        durations.push(endTime - startTime);
      }

      // Should be very fast with memoization
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(avgDuration).toBeLessThan(50);

      console.log(`Memoized re-render average: ${avgDuration.toFixed(3)}ms`);
    });
  });

  describe('Stress Tests', () => {
    it('should handle streaming-like incremental updates', () => {
      let content = '# Streaming Response\n\n';
      const { rerender } = render(<Markdown content={content} />);

      const durations: number[] = [];
      const chunks = 100;

      // Simulate streaming by adding small chunks
      for (let i = 0; i < chunks; i++) {
        content += `Word ${i} `;

        const startTime = performance.now();
        rerender(<Markdown content={content} />);
        const endTime = performance.now();

        durations.push(endTime - startTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const totalDuration = durations.reduce((a, b) => a + b, 0);

      // Each update should be fast
      expect(avgDuration).toBeLessThan(50);

      // Total time should be reasonable
      expect(totalDuration).toBeLessThan(5000);

      console.log(`Streaming simulation (${chunks} updates):`);
      console.log(`  Average per update: ${avgDuration.toFixed(3)}ms`);
      console.log(`  Total time: ${totalDuration.toFixed(3)}ms`);
    });

    it('should handle extreme content size gracefully', () => {
      const content = generateLargeMarkdown(200);

      const startTime = performance.now();
      const { container } = render(<Markdown content={content} />);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete even for very large content (< 2s)
      expect(duration).toBeLessThan(2000);
      expect(container).toBeTruthy();

      console.log(`Render 200KB markdown: ${duration.toFixed(3)}ms`);
    });
  });
});
