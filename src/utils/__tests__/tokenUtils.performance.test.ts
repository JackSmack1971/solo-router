/**
 * Performance Tests for Token Utilities
 * Benchmarks token estimation for large text inputs
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTokenCount,
  estimateConversationTokens,
  prepareMessagesForApi,
  isNearContextLimit,
} from '../tokenUtils';
import type { Message } from '../../types';

describe('TokenUtils - Performance Benchmarks', () => {
  /**
   * Helper to generate large text content
   */
  function generateLargeText(charCount: number): string {
    const words = [
      'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog',
      'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
    ];

    let text = '';
    let wordIndex = 0;

    while (text.length < charCount) {
      text += words[wordIndex % words.length] + ' ';
      wordIndex++;
    }

    return text.substring(0, charCount);
  }

  describe('estimateTokenCount - Performance', () => {
    it('should estimate tokens for 100k characters within reasonable time', () => {
      const largeText = generateLargeText(100_000);

      const startTime = performance.now();
      const tokenCount = estimateTokenCount(largeText);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete in less than 10ms
      expect(duration).toBeLessThan(10);

      // Should return reasonable token count (roughly length/4)
      expect(tokenCount).toBeGreaterThan(20_000);
      expect(tokenCount).toBeLessThan(30_000);

      console.log(`estimateTokenCount for 100k chars: ${duration.toFixed(3)}ms, ${tokenCount} tokens`);
    });

    it('should estimate tokens for 1M characters within reasonable time', () => {
      const veryLargeText = generateLargeText(1_000_000);

      const startTime = performance.now();
      const tokenCount = estimateTokenCount(veryLargeText);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete in less than 50ms even for 1M chars
      expect(duration).toBeLessThan(50);

      // Should return reasonable token count
      expect(tokenCount).toBeGreaterThan(200_000);
      expect(tokenCount).toBeLessThan(300_000);

      console.log(`estimateTokenCount for 1M chars: ${duration.toFixed(3)}ms, ${tokenCount} tokens`);
    });

    it('should handle empty string efficiently', () => {
      const startTime = performance.now();
      const tokenCount = estimateTokenCount('');
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(tokenCount).toBe(0);
      expect(duration).toBeLessThan(1);
    });

    it('should benchmark different text sizes', () => {
      const sizes = [1000, 10_000, 50_000, 100_000, 500_000];
      const results: Array<{ size: number; duration: number; tokens: number }> = [];

      sizes.forEach((size) => {
        const text = generateLargeText(size);

        const startTime = performance.now();
        const tokens = estimateTokenCount(text);
        const endTime = performance.now();

        const duration = endTime - startTime;

        results.push({ size, duration, tokens });

        // All should complete quickly
        expect(duration).toBeLessThan(100);
      });

      console.log('Token estimation benchmark:');
      results.forEach(({ size, duration, tokens }) => {
        console.log(`  ${size.toLocaleString()} chars: ${duration.toFixed(3)}ms, ${tokens.toLocaleString()} tokens`);
      });
    });

    it('should handle special characters efficiently', () => {
      // Text with lots of special characters
      const specialText = '🚀'.repeat(10_000) + '中文字符'.repeat(5_000);

      const startTime = performance.now();
      const tokenCount = estimateTokenCount(specialText);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(20);
      expect(tokenCount).toBeGreaterThan(0);

      console.log(`estimateTokenCount for special chars: ${duration.toFixed(3)}ms, ${tokenCount} tokens`);
    });
  });

  describe('estimateConversationTokens - Performance', () => {
    it('should estimate tokens for large conversation within reasonable time', () => {
      const messages: Array<{ role: string; content: string }> = [];

      // Generate 100 messages with varying sizes
      for (let i = 0; i < 100; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: generateLargeText(1000 + (i * 100)),
        });
      }

      const startTime = performance.now();
      const totalTokens = estimateConversationTokens(messages);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete quickly even for large conversations
      expect(duration).toBeLessThan(50);
      expect(totalTokens).toBeGreaterThan(0);

      console.log(`estimateConversationTokens for 100 messages: ${duration.toFixed(3)}ms, ${totalTokens} tokens`);
    });

    it('should handle conversation with system prompt efficiently', () => {
      const messages: Array<{ role: string; content: string }> = [];

      for (let i = 0; i < 50; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: generateLargeText(500),
        });
      }

      const systemPrompt = generateLargeText(1000);

      const startTime = performance.now();
      const totalTokens = estimateConversationTokens(messages, systemPrompt);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(30);
      expect(totalTokens).toBeGreaterThan(0);

      console.log(`estimateConversationTokens with system prompt: ${duration.toFixed(3)}ms`);
    });

    it('should benchmark different conversation sizes', () => {
      const sizes = [10, 50, 100, 200, 500];
      const results: Array<{ messageCount: number; duration: number; tokens: number }> = [];

      sizes.forEach((size) => {
        const messages: Array<{ role: string; content: string }> = [];

        for (let i = 0; i < size; i++) {
          messages.push({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: generateLargeText(500),
          });
        }

        const startTime = performance.now();
        const tokens = estimateConversationTokens(messages);
        const endTime = performance.now();

        const duration = endTime - startTime;

        results.push({ messageCount: size, duration, tokens });

        // Should scale linearly and remain fast
        expect(duration).toBeLessThan(100);
      });

      console.log('Conversation token estimation benchmark:');
      results.forEach(({ messageCount, duration, tokens }) => {
        console.log(`  ${messageCount} messages: ${duration.toFixed(3)}ms, ${tokens.toLocaleString()} tokens`);
      });
    });

    it('should handle very long single message efficiently', () => {
      const messages = [
        {
          role: 'user',
          content: generateLargeText(100_000),
        },
      ];

      const startTime = performance.now();
      const tokens = estimateConversationTokens(messages);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(20);
      expect(tokens).toBeGreaterThan(20_000);

      console.log(`estimateConversationTokens for single 100k char message: ${duration.toFixed(3)}ms`);
    });
  });

  describe('prepareMessagesForApi - Performance', () => {
    it('should prepare large message array efficiently', () => {
      const messages: Message[] = [];

      for (let i = 0; i < 100; i++) {
        messages.push({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: generateLargeText(500),
          timestamp: Date.now(),
        });
      }

      const startTime = performance.now();
      const prepared = prepareMessagesForApi(messages, 'You are a helpful assistant.');
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should be very fast (just array operations)
      expect(duration).toBeLessThan(10);

      // Should have system message prepended
      expect(prepared.length).toBe(101);
      expect(prepared[0].role).toBe('system');
      expect(prepared[0].content).toBe('You are a helpful assistant.');

      console.log(`prepareMessagesForApi for 100 messages: ${duration.toFixed(3)}ms`);
    });

    it('should handle messages without system prompt efficiently', () => {
      const messages: Message[] = [];

      for (let i = 0; i < 100; i++) {
        messages.push({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: generateLargeText(500),
          timestamp: Date.now(),
        });
      }

      const startTime = performance.now();
      const prepared = prepareMessagesForApi(messages, null);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10);
      expect(prepared.length).toBe(100);

      console.log(`prepareMessagesForApi without system prompt: ${duration.toFixed(3)}ms`);
    });
  });

  describe('isNearContextLimit - Performance', () => {
    it('should check context limit efficiently', () => {
      const iterations = 10_000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        isNearContextLimit(8000, 10000, 0.9);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be extremely fast (simple math operation)
      expect(duration).toBeLessThan(10);

      const avgDuration = duration / iterations;
      console.log(`isNearContextLimit: ${avgDuration.toFixed(6)}ms per call (${iterations} calls)`);
    });

    it('should handle various threshold checks efficiently', () => {
      const testCases = [
        { tokens: 1000, limit: 10000, threshold: 0.9 },
        { tokens: 9500, limit: 10000, threshold: 0.9 },
        { tokens: 50000, limit: 100000, threshold: 0.8 },
        { tokens: 190000, limit: 200000, threshold: 0.95 },
      ];

      const startTime = performance.now();

      testCases.forEach(({ tokens, limit, threshold }) => {
        const result = isNearContextLimit(tokens, limit, threshold);
        expect(typeof result).toBe('boolean');
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1);
    });
  });

  describe('End-to-End Performance', () => {
    it('should handle complete token estimation workflow efficiently', () => {
      // Simulate a realistic workflow
      const messages: Message[] = [];

      // Build up a conversation
      for (let i = 0; i < 50; i++) {
        messages.push({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: generateLargeText(200 + i * 50),
          timestamp: Date.now(),
        });
      }

      const systemPrompt = 'You are a helpful AI assistant.';
      const contextLength = 128000;

      const startTime = performance.now();

      // Prepare messages
      const prepared = prepareMessagesForApi(messages, systemPrompt);

      // Estimate tokens
      const estimatedTokens = estimateConversationTokens(
        prepared.map((m) => ({ role: m.role, content: m.content })),
        null // system prompt already included in prepared
      );

      // Check context limit
      const nearLimit = isNearContextLimit(estimatedTokens, contextLength, 0.9);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Complete workflow should be fast
      expect(duration).toBeLessThan(50);
      expect(prepared.length).toBeGreaterThan(0);
      expect(estimatedTokens).toBeGreaterThan(0);
      expect(typeof nearLimit).toBe('boolean');

      console.log(`Complete token workflow: ${duration.toFixed(3)}ms`);
      console.log(`  Messages: ${messages.length}`);
      console.log(`  Estimated tokens: ${estimatedTokens}`);
      console.log(`  Near limit: ${nearLimit}`);
    });

    it('should handle stress test of repeated estimations', () => {
      const messages: Array<{ role: string; content: string }> = [];

      for (let i = 0; i < 100; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: generateLargeText(1000),
        });
      }

      const iterations = 100;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        estimateConversationTokens(messages);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      const avgDuration = duration / iterations;

      // Should handle repeated calls efficiently
      expect(avgDuration).toBeLessThan(10);

      console.log(`Stress test: ${iterations} estimations in ${duration.toFixed(3)}ms`);
      console.log(`  Average: ${avgDuration.toFixed(3)}ms per estimation`);
    });
  });
});
