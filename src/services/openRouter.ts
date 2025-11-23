/**
 * OpenRouter API client with streaming support
 * Handles Server-Sent Events (SSE) for real-time chat responses
 * Based on CODING_STANDARDS.md Section 6 and SPEC.md FR-001
 */

import { z } from 'zod';
import type {
  ModelSummary,
  StreamParams,
  ChatProvider,
  OpenRouterChatRequest,
  TokenUsage,
} from '../types';
import { getApiKey } from '../utils/storage';

/**
 * OpenRouter API configuration
 */
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const CHAT_COMPLETIONS_PATH = '/chat/completions';
export const MODELS_PATH = '/models';

const StreamUsageSchema = z
  .object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
    total_tokens: z.number().optional(),
  })
  .optional();

const StreamChunkSchema = z.object({
  id: z.string(),
  choices: z.array(
    z.object({
      delta: z.object({
        content: z.string().optional(),
        role: z.string().optional(),
      }),
      finish_reason: z.string().nullable().optional(),
      index: z.number(),
    })
  ),
  created: z.number(),
  model: z.string(),
  usage: StreamUsageSchema,
});

const ModelsResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      context_length: z.number().optional(),
      pricing: z
        .object({
          prompt: z.union([z.number(), z.string()]).optional(),
          completion: z.union([z.number(), z.string()]).optional(),
        })
        .optional(),
    })
  ),
});

/**
 * Custom error class for API-related errors
 */
export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Get human-readable error message from API errors
 */
export function getHumanErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return 'Invalid or missing API key. Please check your OpenRouter API key.';
      case 402:
        return 'Insufficient credits on OpenRouter. Please add credits to your account.';
      case 429:
        return 'Rate limit exceeded. Please wait a moment and try again.';
      case 500:
      case 502:
      case 503:
        return 'OpenRouter service temporarily unavailable. Please try again later.';
      default:
        return `Request failed with status ${error.status}. ${error.message}`;
    }
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return 'Request was cancelled.';
    }
    return error.message;
  }

  return 'An unknown error occurred.';
}

/**
 * OpenRouter provider implementation
 * Implements the ChatProvider interface
 */
export class OpenRouterProvider implements ChatProvider {
  /**
   * Stream chat completion from OpenRouter
   * Handles SSE parsing and chunk-by-chunk delivery
   */
  async streamChat(params: StreamParams): Promise<void> {
    const apiKey = getApiKey();

    if (!apiKey) {
      const error = new ApiError(401, 'API key not found in session storage');
      params.onError(error);
      return;
    }

    // Prepare the request body
    // Messages are already formatted with system prompt included
    const requestBody: OpenRouterChatRequest = {
      model: params.model,
      messages: params.messages,
      stream: true,
      temperature: params.settings.temperature,
      max_tokens: params.settings.maxTokens,
    };

    // Add advanced parameters if provided
    if (params.settings.topP !== undefined) {
      requestBody.top_p = params.settings.topP;
    }
    if (params.settings.frequencyPenalty !== undefined) {
      requestBody.frequency_penalty = params.settings.frequencyPenalty;
    }
    if (params.settings.presencePenalty !== undefined) {
      requestBody.presence_penalty = params.settings.presencePenalty;
    }

    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}${CHAT_COMPLETIONS_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'SoloRouter Chat',
        },
        body: JSON.stringify(requestBody),
        signal: params.signal,
      });

      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.error?.message || errorMessage;
        } catch {
          // If we can't parse the error body, use the status text
          errorMessage = response.statusText || errorMessage;
        }

        throw new ApiError(response.status, errorMessage);
      }

      // Ensure we have a readable stream
      if (!response.body) {
        throw new Error('Response body is null - streaming not supported');
      }

      // Process the SSE stream
      await this.processStream(response.body, params);
    } catch (err) {
      // Don't call onError for AbortError - it's expected when user stops generation
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      params.onError(err as Error);
    }
  }

  /**
   * Process the SSE stream from OpenRouter
   * Parses Server-Sent Events and extracts content chunks
   */
  private async processStream(
    body: ReadableStream<Uint8Array>,
    params: StreamParams
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let lastUsage: TokenUsage | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Stream ended normally
          params.onDone(lastUsage);
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          // Skip empty lines and comments
          if (!trimmed || trimmed.startsWith(':')) {
            continue;
          }

          // SSE format: "data: {...}"
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6); // Remove "data: " prefix

            // Check for stream end marker
            if (data === '[DONE]') {
              params.onDone(lastUsage);
              return;
            }

            const parsedJson = this.safeJsonParse(data);
            if (!parsedJson) {
              continue;
            }

            const parsedChunk = StreamChunkSchema.safeParse(parsedJson);
            if (!parsedChunk.success) {
              console.warn('[OpenRouter] Invalid SSE chunk schema', parsedChunk.error.issues, 'Data:', data);
              continue;
            }

            const primaryChoice = parsedChunk.data.choices.at(0);
            if (!primaryChoice) {
              console.warn('[OpenRouter] SSE chunk missing choices', data);
              continue;
            }

            const content = primaryChoice.delta.content;
            if (content) {
              params.onChunk(content);
            }

            if (parsedChunk.data.usage) {
              lastUsage = {
                promptTokens: parsedChunk.data.usage.prompt_tokens,
                completionTokens: parsedChunk.data.usage.completion_tokens,
                totalTokens: parsedChunk.data.usage.total_tokens,
              };
            }

            const finishReason = primaryChoice.finish_reason;
            if (finishReason) {
              // Stream is complete
              params.onDone(lastUsage);
              return;
            }
          }
        }
      }
    } catch (err) {
      // Release the reader on error
      reader.releaseLock();
      throw err;
    }
  }

  /**
   * Fetch available models from OpenRouter
   * Returns a list of model summaries
   */
  async listModels(): Promise<ModelSummary[]> {
    const apiKey = getApiKey();

    if (!apiKey) {
      // Return a fallback list of popular models if no API key
      return this.getFallbackModels();
    }

    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}${MODELS_PATH}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
        },
      });

      if (!response.ok) {
        console.warn('[OpenRouter] Failed to fetch models, using fallback list');
        return this.getFallbackModels();
      }

      const rawData = (await response.json()) as unknown;
      const parsedResponse = ModelsResponseSchema.safeParse(rawData);

      if (!parsedResponse.success) {
        console.warn('[OpenRouter] Invalid models response format');
        console.debug('[OpenRouter] Model schema validation issues', parsedResponse.error.issues);
        return this.getFallbackModels();
      }

      // Transform API response to our ModelSummary format
      return parsedResponse.data.data.map((model) => {
        const promptPrice = this.normalizePricingValue(model.pricing?.prompt) ?? 0;
        const completionPrice = this.normalizePricingValue(model.pricing?.completion) ?? 0;

        return {
          id: model.id,
          name: model.name || model.id,
          description: model.description,
          contextLength: model.context_length,
          pricing: model.pricing
            ? {
                prompt: promptPrice,
                completion: completionPrice,
              }
            : undefined,
        };
      });
    } catch (err) {
      console.error('[OpenRouter] Error fetching models:', err);
      return this.getFallbackModels();
    }
  }

  /**
   * Fallback list of popular models
   * Used when API key is missing or models endpoint fails
   */
  private getFallbackModels(): ModelSummary[] {
    return [
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        description: 'High-quality, balanced model',
        contextLength: 200000,
      },
      {
        id: 'openai/gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'OpenAI flagship model',
        contextLength: 128000,
      },
      {
        id: 'openai/gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and affordable',
        contextLength: 16385,
      },
      {
        id: 'google/gemini-pro',
        name: 'Gemini Pro',
        description: 'Google multimodal model',
        contextLength: 32760,
      },
      {
        id: 'meta-llama/llama-3-70b-instruct',
        name: 'Llama 3 70B',
        description: 'Open-source high-performance model',
        contextLength: 8192,
      },
    ];
  }

  private safeJsonParse(input: string): unknown | null {
    try {
      return JSON.parse(input) as unknown;
    } catch (error) {
      console.warn('[OpenRouter] Failed to parse SSE chunk JSON', error);
      return null;
    }
  }

  private normalizePricingValue(value?: number | string): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }
}

/**
 * Default provider instance
 * Can be replaced with a different provider implementation if needed
 */
export const defaultProvider = new OpenRouterProvider();
