/**
 * Tests for token utility functions
 * Priority: P1 (Important for cost estimation)
 * Based on SPEC.md FR-004
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTokenCount,
  estimateConversationTokens,
  prepareMessagesForApi,
  calculateCost,
  formatCost,
  formatPricing,
  isNearContextLimit,
  pruneMessagesToFitContext,
} from '../tokenUtils';
import type { Message, ModelSummary } from '../../types';

describe('Token Utils', () => {
  describe('estimateTokenCount', () => {
    it('should estimate tokens for empty string', () => {
      const result = estimateTokenCount('');
      expect(result).toBe(0);
    });

    it('should estimate tokens for simple English text', () => {
      // Rough estimate: 1 token ≈ 4 characters
      const text = 'Hello world';
      const result = estimateTokenCount(text);

      // "Hello world" is 11 chars, so ~3 tokens
      expect(result).toBe(Math.ceil(11 / 4));
      expect(result).toBe(3);
    });

    it('should estimate tokens for long text', () => {
      const text = 'a'.repeat(1000);
      const result = estimateTokenCount(text);

      // 1000 chars / 4 = 250 tokens
      expect(result).toBe(250);
    });

    it('should handle emoji and Unicode correctly', () => {
      const text = '👋🌍你好';
      const result = estimateTokenCount(text);

      // Should return some positive number of tokens
      expect(result).toBeGreaterThan(0);
    });

    it('should handle text with mixed content', () => {
      const text = 'Hello 👋 世界! This is a test.';
      const result = estimateTokenCount(text);

      expect(result).toBeGreaterThan(0);
      // Rough check based on character count
      expect(result).toBeGreaterThanOrEqual(Math.ceil(text.length / 4));
    });

    it('should estimate more tokens for longer text', () => {
      const shortText = 'Hello';
      const longText = 'Hello world, this is a much longer piece of text';

      const shortResult = estimateTokenCount(shortText);
      const longResult = estimateTokenCount(longText);

      expect(longResult).toBeGreaterThan(shortResult);
    });
  });

  describe('estimateConversationTokens', () => {
    it('should estimate tokens for empty conversation', () => {
      const result = estimateConversationTokens([]);

      // Should include overhead for API formatting (~3 tokens)
      expect(result).toBe(3);
    });

    it('should estimate tokens for single message', () => {
      const messages = [
        { role: 'user', content: 'Hello world' },
      ];

      const result = estimateConversationTokens(messages);

      // Message content (~3 tokens) + message overhead (4) + API overhead (3) = 10
      expect(result).toBe(10);
    });

    it('should estimate tokens for multiple messages', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];

      const result = estimateConversationTokens(messages);

      // Each message has content tokens + 4 overhead, plus 3 API overhead
      expect(result).toBeGreaterThan(0);

      // Should be roughly: ceil(5/4) + 4 + ceil(9/4) + 4 + ceil(13/4) + 4 + 3
      // = 2 + 4 + 3 + 4 + 4 + 4 + 3 = 23 (note: "Hi there!" is 9 chars which is ceil(9/4)=3)
      expect(result).toBe(23);
    });

    it('should include system prompt tokens when provided', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
      ];

      const systemPrompt = 'You are a helpful assistant';

      const withoutSystem = estimateConversationTokens(messages);
      const withSystem = estimateConversationTokens(messages, systemPrompt);

      // With system should have more tokens
      expect(withSystem).toBeGreaterThan(withoutSystem);

      // Difference should be system prompt tokens + overhead
      const systemTokens = estimateTokenCount(systemPrompt);
      expect(withSystem).toBe(withoutSystem + systemTokens + 4);
    });

    it('should handle null system prompt', () => {
      const messages = [
        { role: 'user', content: 'Test' },
      ];

      const result = estimateConversationTokens(messages, null);

      // Should work the same as no system prompt
      expect(result).toBeGreaterThan(0);
    });

    it('should handle undefined system prompt', () => {
      const messages = [
        { role: 'user', content: 'Test' },
      ];

      const result = estimateConversationTokens(messages, undefined);

      expect(result).toBeGreaterThan(0);
    });
  });

  describe('prepareMessagesForApi', () => {
    it('should convert Message objects to API format', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hi there',
          timestamp: Date.now(),
        },
      ];

      const result = prepareMessagesForApi(messages, null);

      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ]);
    });

    it('should prepend system prompt when provided', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        },
      ];

      const systemPrompt = 'You are helpful';
      const result = prepareMessagesForApi(messages, systemPrompt);

      expect(result).toEqual([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ]);
    });

    it('should not prepend system prompt when null', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        },
      ];

      const result = prepareMessagesForApi(messages, null);

      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
      ]);
    });

    it('should not prepend system prompt when undefined', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        },
      ];

      const result = prepareMessagesForApi(messages, undefined);

      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
      ]);
    });

    it('should handle empty messages array', () => {
      const result = prepareMessagesForApi([], null);

      expect(result).toEqual([]);
    });

    it('should preserve message order', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'First',
          timestamp: 1,
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Second',
          timestamp: 2,
        },
        {
          id: '3',
          role: 'user',
          content: 'Third',
          timestamp: 3,
        },
      ];

      const result = prepareMessagesForApi(messages, 'System');

      expect(result).toEqual([
        { role: 'system', content: 'System' },
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Second' },
        { role: 'user', content: 'Third' },
      ]);
    });

    it('should strip extra properties from Message objects', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
          model: 'gpt-4',
          tokenCount: 10,
          error: false,
        },
      ];

      const result = prepareMessagesForApi(messages, null);

      // Should only have role and content
      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
      ]);

      // Verify no extra properties
      expect(Object.keys(result[0])).toEqual(['role', 'content']);
    });
  });

  describe('calculateCost', () => {
    const mockModels: ModelSummary[] = [
      {
        id: 'model-1',
        name: 'Model 1',
        pricing: {
          prompt: 3.0,      // $3 per 1M tokens
          completion: 15.0,  // $15 per 1M tokens
        },
      },
      {
        id: 'model-2',
        name: 'Model 2',
        pricing: {
          prompt: 0.5,
          completion: 1.5,
        },
      },
      {
        id: 'model-3',
        name: 'Model 3',
        // No pricing
      },
    ];

    it('should calculate cost correctly for model with pricing', () => {
      const cost = calculateCost('model-1', 1000, 500, mockModels);

      // Prompt: (1000 / 1,000,000) * 3 = 0.003
      // Completion: (500 / 1,000,000) * 15 = 0.0075
      // Total: 0.0105
      expect(cost).toBeCloseTo(0.0105, 10);
    });

    it('should calculate cost for different model', () => {
      const cost = calculateCost('model-2', 10000, 5000, mockModels);

      // Prompt: (10000 / 1,000,000) * 0.5 = 0.005
      // Completion: (5000 / 1,000,000) * 1.5 = 0.0075
      // Total: 0.0125
      expect(cost).toBe(0.0125);
    });

    it('should return null for model without pricing', () => {
      const cost = calculateCost('model-3', 1000, 500, mockModels);
      expect(cost).toBeNull();
    });

    it('should return null for unknown model', () => {
      const cost = calculateCost('unknown-model', 1000, 500, mockModels);
      expect(cost).toBeNull();
    });

    it('should handle zero tokens', () => {
      const cost = calculateCost('model-1', 0, 0, mockModels);
      expect(cost).toBe(0);
    });

    it('should handle large token counts', () => {
      const cost = calculateCost('model-1', 1_000_000, 500_000, mockModels);

      // Prompt: (1,000,000 / 1,000,000) * 3 = 3
      // Completion: (500,000 / 1,000,000) * 15 = 7.5
      // Total: 10.5
      expect(cost).toBe(10.5);
    });
  });

  describe('formatCost', () => {
    it('should format null as "N/A"', () => {
      expect(formatCost(null)).toBe('N/A');
    });

    it('should format very small costs', () => {
      expect(formatCost(0.00001)).toBe('<$0.0001');
      expect(formatCost(0.00005)).toBe('<$0.0001');
    });

    it('should format small costs with 4 decimal places', () => {
      expect(formatCost(0.0012)).toBe('$0.0012');
      expect(formatCost(0.0099)).toBe('$0.0099');
    });

    it('should format medium costs with 3 decimal places', () => {
      expect(formatCost(0.015)).toBe('$0.015');
      expect(formatCost(0.999)).toBe('$0.999');
    });

    it('should format large costs with 2 decimal places', () => {
      expect(formatCost(1.5)).toBe('$1.50');
      expect(formatCost(10.25)).toBe('$10.25');
      expect(formatCost(100.99)).toBe('$100.99');
    });

    it('should handle zero cost', () => {
      expect(formatCost(0)).toBe('<$0.0001');
    });
  });

  describe('formatPricing', () => {
    it('should format pricing with two decimal places', () => {
      const pricing = { prompt: 3.0, completion: 15.0 };
      const result = formatPricing(pricing);

      expect(result).toBe('$3.00/$15.00 per 1M tokens');
    });

    it('should handle decimal prices', () => {
      const pricing = { prompt: 0.5, completion: 1.5 };
      const result = formatPricing(pricing);

      expect(result).toBe('$0.50/$1.50 per 1M tokens');
    });

    it('should return empty string for undefined pricing', () => {
      const result = formatPricing(undefined);
      expect(result).toBe('');
    });

    it('should handle zero pricing', () => {
      const pricing = { prompt: 0, completion: 0 };
      const result = formatPricing(pricing);

      expect(result).toBe('$0.00/$0.00 per 1M tokens');
    });
  });

  describe('isNearContextLimit', () => {
    it('should return false when well below limit', () => {
      const result = isNearContextLimit(1000, 10000, 0.9);
      expect(result).toBe(false);
    });

    it('should return true when above threshold', () => {
      const result = isNearContextLimit(9500, 10000, 0.9);
      expect(result).toBe(true);
    });

    it('should return true when at threshold', () => {
      const result = isNearContextLimit(9000, 10000, 0.9);
      expect(result).toBe(false);

      const result2 = isNearContextLimit(9001, 10000, 0.9);
      expect(result2).toBe(true);
    });

    it('should use default threshold of 0.9', () => {
      const result = isNearContextLimit(9500, 10000);
      expect(result).toBe(true);
    });

    it('should respect custom threshold', () => {
      // 80% threshold
      const result = isNearContextLimit(8500, 10000, 0.8);
      expect(result).toBe(true);

      const result2 = isNearContextLimit(7500, 10000, 0.8);
      expect(result2).toBe(false);
    });

    it('should handle edge case of exceeding context limit', () => {
      const result = isNearContextLimit(11000, 10000, 0.9);
      expect(result).toBe(true);
    });

    it('should handle zero tokens', () => {
      const result = isNearContextLimit(0, 10000, 0.9);
      expect(result).toBe(false);
    });
  });

  describe('pruneMessagesToFitContext', () => {
    const createMsg = (role: 'user' | 'assistant' | 'system', content: string) => ({
      role,
      content,
    });

    it('should return original messages when context length is undefined', () => {
      const messages = [createMsg('user', 'Hello'), createMsg('assistant', 'Hi there')];

      const result = pruneMessagesToFitContext(messages, undefined);

      expect(result).toEqual(messages);
    });

    it('should keep most recent messages within context budget', () => {
      const messages = [
        createMsg('user', 'Hello'), // cost: 1 token + 4 overhead = 5
        createMsg('assistant', 'Hi there'), // cost: ceil(8/4)=2 + 4 = 6
        createMsg('user', 'How are you?'), // cost: ceil(12/4)=3 + 4 = 7
      ];

      const result = pruneMessagesToFitContext(messages, 19); // 19 - api overhead 3 = 16 budget

      // Should include the two most recent messages (cost 6 + 7 = 13 <= 16), oldest pruned
      expect(result).toEqual([messages[1], messages[2]]);
    });

    it('should always retain system prompt when present', () => {
      const messages = [
        createMsg('system', 'System context'), // cost: ceil(14/4)=4 + 4 = 8
        createMsg('user', 'Hello'),
        createMsg('assistant', 'Response that is too long to fit in remaining budget'),
      ];

      const result = pruneMessagesToFitContext(messages, 11); // 11 - api overhead 3 - system 8 = 0 budget

      expect(result).toEqual([messages[0]]);
    });

    it('should skip messages that individually exceed the remaining budget', () => {
      const messages = [
        createMsg('user', 'Short'), // cost: ceil(5/4)=2 + 4 = 6
        createMsg('assistant', 'This message is intentionally very long to exceed the budget'), // cost: ceil(65/4)=17 + 4 = 21
        createMsg('user', 'Another short one'), // cost: ceil(18/4)=5 + 4 = 9
      ];

      const result = pruneMessagesToFitContext(messages, 18); // 18 - api overhead 3 = 15 budget

      // Long message should be skipped, leaving only short messages that fit budget (6 + 9 = 15)
      expect(result).toEqual([messages[0], messages[2]]);
    });
  });
});
