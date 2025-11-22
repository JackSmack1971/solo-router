/**
 * Core type definitions for SoloRouter Chat
 * Based on SPEC.md Section 8 (Data Models)
 */

/**
 * Represents a single message in a conversation
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  tokenCount?: number;
  error?: boolean;
}

/**
 * Token usage information from API responses
 */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * Represents a complete conversation thread
 */
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model: string;
  settings: ConversationSettings;
  metadata?: ConversationMetadata;
}

/**
 * Settings specific to a conversation
 */
export interface ConversationSettings {
  temperature: number;
  maxTokens: number;
  systemPrompt: string | null;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * Metadata tracking for a conversation
 */
export interface ConversationMetadata {
  totalTokens?: number;
  totalCost?: number;
  messageCount: number;
}

/**
 * Global application settings
 */
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  defaultModel: string | null;
  temperature: number;
  maxTokens: number;
  systemPrompt: string | null;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * Model information from the API
 */
export interface ModelSummary {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
}

/**
 * Parameters for streaming chat requests
 */
export interface StreamParams {
  messages: Message[];
  model: string;
  settings: {
    temperature: number;
    maxTokens: number;
    systemPrompt?: string | null;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
  onChunk: (text: string) => void;
  onDone: (usage?: TokenUsage) => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
}

/**
 * Chat provider interface for API abstraction
 */
export interface ChatProvider {
  streamChat: (params: StreamParams) => Promise<void>;
  listModels: () => Promise<ModelSummary[]>;
}

/**
 * OpenRouter-specific chat completion request body
 */
export interface OpenRouterChatRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

/**
 * OpenRouter streaming response chunk (SSE format)
 */
export interface OpenRouterStreamChunk {
  id: string;
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason?: string | null;
    index: number;
  }>;
  created: number;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
