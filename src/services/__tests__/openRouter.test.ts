/**
 * Tests for OpenRouter service
 * Critical: Streaming logic and error handling (P0)
 * Based on CODING_STANDARDS.md Section 6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterProvider, ApiError, getHumanErrorMessage } from '../openRouter';
import type { StreamParams, TokenUsage } from '../../types';

/**
 * Helper to create a mock ReadableStream that simulates SSE responses
 * This is crucial for testing streaming behavior without hitting the real API
 */
function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let chunkIndex = 0;

  return new ReadableStream({
    start(controller) {
      // Enqueue all chunks
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
    cancel() {
      // Handle stream cancellation
      chunkIndex = chunks.length;
    },
  });
}

/**
 * Helper to create mock fetch responses
 */
function createMockResponse(
  status: number,
  body?: ReadableStream<Uint8Array> | object,
  statusText = 'OK'
): Response {
  if (body instanceof ReadableStream) {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText,
      body,
      json: async () => ({}),
    } as Response;
  }

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    body: null,
    json: async () => body || {},
  } as Response;
}

describe('OpenRouter Service', () => {
  let provider: OpenRouterProvider;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    provider = new OpenRouterProvider();
    fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    // Mock sessionStorage for API key
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(() => 'test-api-key-12345'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 1,
        key: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Streaming (P0)', () => {
    it('should call onChunk for multiple data chunks', async () => {
      // Arrange: Create SSE stream with multiple chunks
      const sseChunks = [
        'data: {"id":"1","choices":[{"delta":{"content":"Hello"},"index":0}],"created":1234567890,"model":"test-model"}\n\n',
        'data: {"id":"1","choices":[{"delta":{"content":" world"},"index":0}],"created":1234567890,"model":"test-model"}\n\n',
        'data: {"id":"1","choices":[{"delta":{"content":"!"},"index":0}],"created":1234567890,"model":"test-model"}\n\n',
        'data: [DONE]\n\n',
      ];

      const mockStream = createMockStream(sseChunks);
      fetchSpy.mockResolvedValueOnce(createMockResponse(200, mockStream));

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
      };

      // Act
      await provider.streamChat(params);

      // Assert
      expect(onChunk).toHaveBeenCalledTimes(3);
      expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello');
      expect(onChunk).toHaveBeenNthCalledWith(2, ' world');
      expect(onChunk).toHaveBeenNthCalledWith(3, '!');
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it('should call onDone with usage stats when provided', async () => {
      // Arrange: SSE stream with usage information
      const sseChunks = [
        'data: {"id":"1","choices":[{"delta":{"content":"Test"},"index":0}],"created":1234567890,"model":"test-model"}\n\n',
        'data: {"id":"1","choices":[{"delta":{},"finish_reason":"stop","index":0}],"created":1234567890,"model":"test-model","usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
      ];

      const mockStream = createMockStream(sseChunks);
      fetchSpy.mockResolvedValueOnce(createMockResponse(200, mockStream));

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
      };

      // Act
      await provider.streamChat(params);

      // Assert
      expect(onDone).toHaveBeenCalledTimes(1);
      const expectedUsage: TokenUsage = {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      };
      expect(onDone).toHaveBeenCalledWith(expectedUsage);
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle stream that ends without [DONE] marker', async () => {
      // Arrange: Stream ends naturally without explicit [DONE]
      const sseChunks = [
        'data: {"id":"1","choices":[{"delta":{"content":"Test"},"index":0}],"created":1234567890,"model":"test-model"}\n\n',
      ];

      const mockStream = createMockStream(sseChunks);
      fetchSpy.mockResolvedValueOnce(createMockResponse(200, mockStream));

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
      };

      // Act
      await provider.streamChat(params);

      // Assert
      expect(onChunk).toHaveBeenCalledWith('Test');
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling (P0)', () => {
    it('should trigger onError with user-friendly message for 401 Unauthorized', async () => {
      // Arrange
      fetchSpy.mockResolvedValueOnce(
        createMockResponse(401, { error: { message: 'Invalid API key' } }, 'Unauthorized')
      );

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
      };

      // Act
      await provider.streamChat(params);

      // Assert
      expect(onError).toHaveBeenCalledTimes(1);
      const error = onError.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(401);

      // Verify human-readable error message
      const humanMessage = getHumanErrorMessage(error);
      expect(humanMessage).toContain('Invalid or missing API key');
      expect(onChunk).not.toHaveBeenCalled();
      expect(onDone).not.toHaveBeenCalled();
    });

    it('should trigger onError with user-friendly message for 429 Rate Limit', async () => {
      // Arrange
      fetchSpy.mockResolvedValueOnce(
        createMockResponse(429, { error: { message: 'Rate limit exceeded' } }, 'Too Many Requests')
      );

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
      };

      // Act
      await provider.streamChat(params);

      // Assert
      expect(onError).toHaveBeenCalledTimes(1);
      const error = onError.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(429);

      // Verify human-readable error message
      const humanMessage = getHumanErrorMessage(error);
      expect(humanMessage).toContain('Rate limit exceeded');
      expect(onChunk).not.toHaveBeenCalled();
      expect(onDone).not.toHaveBeenCalled();
    });

    it('should trigger onError with user-friendly message for 500 Server Error', async () => {
      // Arrange
      fetchSpy.mockResolvedValueOnce(
        createMockResponse(500, { error: { message: 'Internal server error' } }, 'Internal Server Error')
      );

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
      };

      // Act
      await provider.streamChat(params);

      // Assert
      expect(onError).toHaveBeenCalledTimes(1);
      const error = onError.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(500);

      // Verify human-readable error message
      const humanMessage = getHumanErrorMessage(error);
      expect(humanMessage).toContain('temporarily unavailable');
      expect(onChunk).not.toHaveBeenCalled();
      expect(onDone).not.toHaveBeenCalled();
    });

    it('should handle missing API key gracefully', async () => {
      // Arrange: Mock empty API key
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn(),
          length: 0,
          key: vi.fn(),
        },
        writable: true,
      });

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
      };

      // Act
      await provider.streamChat(params);

      // Assert
      expect(onError).toHaveBeenCalledTimes(1);
      const error = onError.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('Abort Handling (P0)', () => {
    it('should stop stream when abortController.abort() is called', async () => {
      // Arrange: Simulate abort by making fetch reject with AbortError
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';

      fetchSpy.mockRejectedValueOnce(abortError);

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const abortController = new AbortController();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
        signal: abortController.signal,
      };

      // Act
      await provider.streamChat(params);

      // Assert: onError should NOT be called for AbortError
      expect(onError).not.toHaveBeenCalled();
      // onDone and onChunk should also not be called since request was aborted
      expect(onDone).not.toHaveBeenCalled();
      expect(onChunk).not.toHaveBeenCalled();
    });

    it('should not throw error when stream is aborted', async () => {
      // Arrange
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';

      fetchSpy.mockRejectedValueOnce(abortError);

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const abortController = new AbortController();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
        signal: abortController.signal,
      };

      // Act & Assert: Should not throw
      await expect(provider.streamChat(params)).resolves.toBeUndefined();
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('Resilience to Malformed Data (P0)', () => {
    it('should skip malformed JSON chunks without crashing', async () => {
      // Arrange: Mix of valid and invalid JSON
      const sseChunks = [
        'data: {"id":"1","choices":[{"delta":{"content":"Valid"},"index":0}],"created":1234567890,"model":"test-model"}\n\n',
        'data: {invalid json here\n\n',  // Malformed JSON
        'data: {"id":"1","choices":[{"delta":{"content":"Also valid"},"index":0}],"created":1234567890,"model":"test-model"}\n\n',
        'data: [DONE]\n\n',
      ];

      const mockStream = createMockStream(sseChunks);
      fetchSpy.mockResolvedValueOnce(createMockResponse(200, mockStream));

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
      };

      // Act
      await provider.streamChat(params);

      // Assert: Should process valid chunks and skip invalid ones
      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(onChunk).toHaveBeenNthCalledWith(1, 'Valid');
      expect(onChunk).toHaveBeenNthCalledWith(2, 'Also valid');
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle empty delta content gracefully', async () => {
      // Arrange: Chunks with empty or missing content
      const sseChunks = [
        'data: {"id":"1","choices":[{"delta":{},"index":0}],"created":1234567890,"model":"test-model"}\n\n',
        'data: {"id":"1","choices":[{"delta":{"content":"Text"},"index":0}],"created":1234567890,"model":"test-model"}\n\n',
        'data: {"id":"1","choices":[{"delta":{"content":""},"index":0}],"created":1234567890,"model":"test-model"}\n\n',
        'data: [DONE]\n\n',
      ];

      const mockStream = createMockStream(sseChunks);
      fetchSpy.mockResolvedValueOnce(createMockResponse(200, mockStream));

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
      };

      // Act
      await provider.streamChat(params);

      // Assert: Only chunk with actual content should be processed
      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onChunk).toHaveBeenCalledWith('Text');
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle SSE comments and empty lines', async () => {
      // Arrange: Stream with comments and empty lines
      const sseChunks = [
        ': this is a comment\n\n',
        '\n',
        'data: {"id":"1","choices":[{"delta":{"content":"Test"},"index":0}],"created":1234567890,"model":"test-model"}\n\n',
        '\n\n',
        ': another comment\n',
        'data: [DONE]\n\n',
      ];

      const mockStream = createMockStream(sseChunks);
      fetchSpy.mockResolvedValueOnce(createMockResponse(200, mockStream));

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
      };

      // Act
      await provider.streamChat(params);

      // Assert
      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onChunk).toHaveBeenCalledWith('Test');
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('getHumanErrorMessage', () => {
    it('should return friendly message for 402 Payment Required', () => {
      const error = new ApiError(402, 'Payment required');
      const message = getHumanErrorMessage(error);
      expect(message).toContain('Insufficient credits');
      expect(message).toContain('OpenRouter');
    });

    it('should return friendly message for 503 Service Unavailable', () => {
      const error = new ApiError(503, 'Service unavailable');
      const message = getHumanErrorMessage(error);
      expect(message).toContain('temporarily unavailable');
    });

    it('should return "Request was cancelled" for AbortError', () => {
      // Create an error that matches what fetch actually throws
      const error = new Error('The operation was aborted.');
      error.name = 'AbortError';
      const message = getHumanErrorMessage(error);
      expect(message).toBe('Request was cancelled.');
    });

    it('should return generic message for unknown errors', () => {
      const error = { something: 'unexpected' };
      const message = getHumanErrorMessage(error);
      expect(message).toBe('An unknown error occurred.');
    });

    it('should return error message for standard Error', () => {
      const error = new Error('Network failure');
      const message = getHumanErrorMessage(error);
      expect(message).toBe('Network failure');
    });
  });

  describe('Model Fetching (AT-006)', () => {
    it('should fetch and transform models successfully', async () => {
      // Arrange: Mock successful API response
      const mockModelsResponse = {
        data: [
          {
            id: 'openai/gpt-4',
            name: 'GPT-4',
            description: 'OpenAI GPT-4',
            context_length: 8192,
            pricing: { prompt: '0.00003', completion: '0.00006' },
          },
          {
            id: 'anthropic/claude-3-opus',
            name: 'Claude 3 Opus',
            description: 'Anthropic Claude 3 Opus',
            context_length: 200000,
            pricing: { prompt: '0.000015', completion: '0.000075' },
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce(
        createMockResponse(200, mockModelsResponse)
      );

      // Act
      const models = await provider.listModels();

      // Assert
      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        id: 'openai/gpt-4',
        name: 'GPT-4',
        description: 'OpenAI GPT-4',
        contextLength: 8192,
        pricing: { prompt: 0.00003, completion: 0.00006 },
      });
      expect(models[1]).toEqual({
        id: 'anthropic/claude-3-opus',
        name: 'Claude 3 Opus',
        description: 'Anthropic Claude 3 Opus',
        contextLength: 200000,
        pricing: { prompt: 0.000015, completion: 0.000075 },
      });
    });

    it('should return fallback models when API key is missing', async () => {
      // Arrange: Mock empty API key
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn(),
          length: 0,
          key: vi.fn(),
        },
        writable: true,
      });

      // Act
      const models = await provider.listModels();

      // Assert: Should return fallback list without calling API
      expect(models.length).toBeGreaterThan(0);
      expect(models[0].id).toBeTruthy();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should return fallback models when API returns non-OK response', async () => {
      // Arrange: Mock 401 response
      fetchSpy.mockResolvedValueOnce(
        createMockResponse(401, { error: { message: 'Unauthorized' } }, 'Unauthorized')
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      const models = await provider.listModels();

      // Assert
      expect(models.length).toBeGreaterThan(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch models')
      );

      consoleSpy.mockRestore();
    });

    it('should return fallback models when API returns invalid format', async () => {
      // Arrange: Mock response with invalid format
      fetchSpy.mockResolvedValueOnce(
        createMockResponse(200, { invalid: 'format' })
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      const models = await provider.listModels();

      // Assert
      expect(models.length).toBeGreaterThan(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid models response format')
      );

      consoleSpy.mockRestore();
    });

    it('should return fallback models when fetch throws error', async () => {
      // Arrange: Mock network error
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const models = await provider.listModels();

      // Assert
      expect(models.length).toBeGreaterThan(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching models'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle models without pricing information', async () => {
      // Arrange: Mock models without pricing
      const mockModelsResponse = {
        data: [
          {
            id: 'test/model',
            name: 'Test Model',
            description: 'A test model',
            context_length: 4096,
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce(
        createMockResponse(200, mockModelsResponse)
      );

      // Act
      const models = await provider.listModels();

      // Assert
      expect(models).toHaveLength(1);
      expect(models[0].pricing).toBeUndefined();
    });

    it('should use model id as name when name is missing', async () => {
      // Arrange: Mock model without name field
      const mockModelsResponse = {
        data: [
          {
            id: 'test/model-id',
            context_length: 4096,
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce(
        createMockResponse(200, mockModelsResponse)
      );

      // Act
      const models = await provider.listModels();

      // Assert
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('test/model-id');
    });
  });

  describe('Abort Handling - Network Verification (AT-006)', () => {
    it('should pass abort signal to fetch request', async () => {
      // Arrange
      const abortController = new AbortController();

      const sseChunks = [
        'data: {"id":"1","choices":[{"delta":{"content":"Test"},"index":0}],"created":1234567890,"model":"test-model"}\n\n',
        'data: [DONE]\n\n',
      ];

      const mockStream = createMockStream(sseChunks);
      fetchSpy.mockResolvedValueOnce(createMockResponse(200, mockStream));

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
        signal: abortController.signal,
      };

      // Act
      await provider.streamChat(params);

      // Assert: Verify fetch was called with the abort signal
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const fetchCall = fetchSpy.mock.calls[0];
      expect(fetchCall[1]).toBeDefined();
      expect(fetchCall[1].signal).toBe(abortController.signal);
    });

    it('should handle abort during stream reading', async () => {
      // Arrange: Create a stream that will be aborted mid-read
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';

      // Create a stream that throws AbortError when trying to read
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(
            'data: {"id":"1","choices":[{"delta":{"content":"Start"},"index":0}]}\n\n'
          ));
        },
        async pull() {
          // Simulate abort during pull
          throw abortError;
        },
      });

      fetchSpy.mockResolvedValueOnce(createMockResponse(200, mockStream));

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const abortController = new AbortController();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
        signal: abortController.signal,
      };

      // Act
      await provider.streamChat(params);

      // Assert: AbortError should not trigger onError
      expect(onError).not.toHaveBeenCalled();
    });

    it('should properly handle aborting before fetch completes', async () => {
      // Arrange: Abort controller that's already aborted
      const abortController = new AbortController();
      abortController.abort();

      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      fetchSpy.mockRejectedValueOnce(abortError);

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
        signal: abortController.signal,
      };

      // Act
      await provider.streamChat(params);

      // Assert: Should handle gracefully without calling onError
      expect(onError).not.toHaveBeenCalled();
      expect(onDone).not.toHaveBeenCalled();
      expect(onChunk).not.toHaveBeenCalled();
    });
  });

  describe('Additional Error Scenarios (AT-006)', () => {
    it('should handle response body being null', async () => {
      // Arrange: Mock response with null body
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        body: null,
        json: async () => ({}),
      } as Response;

      fetchSpy.mockResolvedValueOnce(mockResponse);

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
      };

      // Act
      await provider.streamChat(params);

      // Assert
      expect(onError).toHaveBeenCalledTimes(1);
      const error = onError.mock.calls[0][0];
      expect(error.message).toContain('Response body is null');
    });

    it('should handle unparseable error response body', async () => {
      // Arrange: Mock 500 error with unparseable body
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        body: null,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response;

      fetchSpy.mockResolvedValueOnce(mockResponse);

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
      };

      // Act
      await provider.streamChat(params);

      // Assert
      expect(onError).toHaveBeenCalledTimes(1);
      const error = onError.mock.calls[0][0];
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(500);
      expect(error.message).toBe('Internal Server Error');
    });

    it('should handle finish_reason without [DONE] marker', async () => {
      // Arrange: Stream that ends with finish_reason instead of [DONE]
      const sseChunks = [
        'data: {"id":"1","choices":[{"delta":{"content":"Complete"},"index":0}],"created":1234567890,"model":"test-model"}\n\n',
        'data: {"id":"1","choices":[{"delta":{},"finish_reason":"stop","index":0}],"created":1234567890,"model":"test-model"}\n\n',
      ];

      const mockStream = createMockStream(sseChunks);
      fetchSpy.mockResolvedValueOnce(createMockResponse(200, mockStream));

      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const params: StreamParams = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'test-model',
        settings: { temperature: 0.7, maxTokens: 100 },
        onChunk,
        onDone,
        onError,
      };

      // Act
      await provider.streamChat(params);

      // Assert
      expect(onChunk).toHaveBeenCalledWith('Complete');
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });
  });
});
