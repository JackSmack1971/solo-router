/**
 * Token and cost calculation utilities
 * Handles cost estimation for different models
 * Based on SPEC.md FR-004
 */

import type { ModelSummary, Message } from '../types';

/**
 * Calculate the estimated cost for a given model and token usage
 *
 * @param modelId - The model identifier (e.g., 'anthropic/claude-3.5-sonnet')
 * @param promptTokens - Number of tokens in the prompt
 * @param completionTokens - Number of tokens in the completion
 * @param models - Array of available models with pricing information
 * @returns Estimated cost in dollars, or null if pricing not available
 */
export function calculateCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  models: ModelSummary[]
): number | null {
  // Find the model in the available models list
  const model = models.find((m) => m.id === modelId);

  if (!model?.pricing) {
    return null;
  }

  // OpenRouter pricing is typically per million tokens
  // pricing.prompt and pricing.completion are in dollars per million tokens
  const promptCost = (promptTokens / 1_000_000) * model.pricing.prompt;
  const completionCost = (completionTokens / 1_000_000) * model.pricing.completion;

  return promptCost + completionCost;
}

/**
 * Format cost for display
 *
 * @param cost - Cost in dollars
 * @returns Formatted string (e.g., "$0.0012" or "$1.23")
 */
export function formatCost(cost: number | null): string {
  if (cost === null) {
    return 'N/A';
  }

  if (cost < 0.0001) {
    return '<$0.0001';
  }

  if (cost < 0.01) {
    // Show 4 decimal places for small costs
    return `$${cost.toFixed(4)}`;
  }

  if (cost < 1) {
    // Show 3 decimal places for costs under $1
    return `$${cost.toFixed(3)}`;
  }

  // Show 2 decimal places for larger costs
  return `$${cost.toFixed(2)}`;
}

/**
 * Format pricing information for display in the model selection
 *
 * @param pricing - Pricing object with prompt and completion costs per million tokens
 * @returns Formatted string (e.g., "$3.00/$15.00 per 1M tokens")
 */
export function formatPricing(pricing: { prompt: number; completion: number } | undefined): string {
  if (!pricing) {
    return '';
  }

  const promptPrice = pricing.prompt.toFixed(2);
  const completionPrice = pricing.completion.toFixed(2);

  return `$${promptPrice}/$${completionPrice} per 1M tokens`;
}

/**
 * Rough estimation of token count for a given text
 * This is a simple heuristic and not as accurate as actual tokenization
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English text
  // This is a simplification and varies by model and language
  return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens for a conversation's messages
 * Includes system prompt, all messages, and overhead
 *
 * @param messages - Array of messages to estimate tokens for
 * @param systemPrompt - Optional system prompt
 * @returns Estimated total token count
 */
export function estimateConversationTokens(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string | null
): number {
  let total = 0;

  // Add system prompt tokens if present
  if (systemPrompt) {
    total += estimateTokenCount(systemPrompt);
    // Add overhead for system message formatting (~4 tokens)
    total += 4;
  }

  // Add tokens for each message
  for (const msg of messages) {
    total += estimateTokenCount(msg.content);
    // Add overhead for message formatting (~4 tokens per message)
    total += 4;
  }

  // Add overhead for API formatting (~3 tokens)
  total += 3;

  return total;
}

/**
 * Check if estimated tokens exceed a percentage of the model's context window
 *
 * @param estimatedTokens - Estimated token count
 * @param modelContextLength - Model's context window size
 * @param threshold - Percentage threshold (0.0 to 1.0), defaults to 0.9 (90%)
 * @returns True if estimated tokens exceed threshold
 */
export function isNearContextLimit(
  estimatedTokens: number,
  modelContextLength: number,
  threshold: number = 0.9
): boolean {
  return estimatedTokens > modelContextLength * threshold;
}

/**
 * Prepare messages for API by converting internal Message format to API format
 * and prepending system prompt if provided
 *
 * @param messages - Array of internal Message objects
 * @param systemPrompt - Optional system prompt to prepend
 * @returns Array of messages in API format with system prompt prepended if provided
 */
export function prepareMessagesForApi(
  messages: Message[],
  systemPrompt: string | null | undefined
): Array<{ role: string; content: string }> {
  // Convert internal Message objects to API format
  const apiMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Prepend system prompt if provided
  if (systemPrompt) {
    apiMessages.unshift({
      role: 'system',
      content: systemPrompt,
    });
  }

  return apiMessages;
}
