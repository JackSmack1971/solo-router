/**
 * Mock OpenRouter provider for testing
 * Provides mock implementations of the ChatProvider interface
 */

import type { ChatProvider, StreamParams, ModelSummary, TokenUsage } from '../../types';

/**
 * Mock streaming chat function
 * Simulates streaming behavior with configurable delay and content
 */
export function mockStreamChat(
  content: string = 'Mock response',
  options?: {
    delay?: number;
    shouldError?: boolean;
    errorMessage?: string;
    tokenUsage?: TokenUsage;
    chunkSize?: number;
  }
): (params: StreamParams) => Promise<void> {
  return async (params: StreamParams) => {
    const {
      delay = 10,
      shouldError = false,
      errorMessage = 'Mock error',
      tokenUsage,
      chunkSize = 1,
    } = options || {};

    if (shouldError) {
      params.onError(new Error(errorMessage));
      return;
    }

    // Simulate streaming by sending content in chunks
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize);
      params.onChunk(chunk);

      // Add delay to simulate network latency
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Call onDone with optional token usage
    params.onDone(tokenUsage);
  };
}

/**
 * Mock list models function
 * Returns a predefined list of models
 */
export function mockListModels(
  models: ModelSummary[] = [
    {
      id: 'test/model-1',
      name: 'Test Model 1',
      description: 'First test model',
      contextLength: 4096,
      pricing: { prompt: 0.001, completion: 0.002 },
    },
    {
      id: 'test/model-2',
      name: 'Test Model 2',
      description: 'Second test model',
      contextLength: 8192,
      pricing: { prompt: 0.002, completion: 0.004 },
    },
  ]
): () => Promise<ModelSummary[]> {
  return async () => models;
}

/**
 * Create a mock ChatProvider instance
 * Useful for dependency injection in tests
 */
export function createMockProvider(options?: {
  streamChatResponse?: string;
  streamChatError?: boolean;
  streamChatErrorMessage?: string;
  streamChatDelay?: number;
  streamChatTokenUsage?: TokenUsage;
  models?: ModelSummary[];
}): ChatProvider {
  const {
    streamChatResponse = 'Mock response',
    streamChatError = false,
    streamChatErrorMessage = 'Mock error',
    streamChatDelay = 10,
    streamChatTokenUsage,
    models,
  } = options || {};

  return {
    streamChat: mockStreamChat(streamChatResponse, {
      delay: streamChatDelay,
      shouldError: streamChatError,
      errorMessage: streamChatErrorMessage,
      tokenUsage: streamChatTokenUsage,
    }),
    listModels: mockListModels(models),
  };
}
