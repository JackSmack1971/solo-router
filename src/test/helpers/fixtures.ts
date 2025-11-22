/**
 * Test fixtures for creating mock data
 * Provides factory functions for generating test conversations, messages, and settings
 */

import type { Conversation, Message, AppSettings } from '../../types';

/**
 * Generate a unique ID for testing
 */
function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a mock message
 * Allows partial overrides for flexibility
 */
export function createMockMessage(overrides?: Partial<Message>): Message {
  const defaults: Message = {
    id: generateTestId(),
    role: 'user',
    content: 'Test message content',
    timestamp: Date.now(),
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock conversation
 * Allows partial overrides for flexibility
 */
export function createMockConversation(overrides?: Partial<Conversation>): Conversation {
  const now = Date.now();

  const defaults: Conversation = {
    id: generateTestId(),
    title: 'Test Conversation',
    messages: [],
    createdAt: now,
    updatedAt: now,
    model: 'test/model',
    settings: {
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: null,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0,
    },
    metadata: {
      messageCount: 0,
    },
  };

  // If messages are provided in overrides, update metadata.messageCount
  const result = { ...defaults, ...overrides };
  if (overrides?.messages) {
    result.metadata = {
      ...result.metadata,
      messageCount: overrides.messages.length,
    };
  }

  return result;
}

/**
 * Create mock app settings
 * Allows partial overrides for flexibility
 */
export function createMockSettings(overrides?: Partial<AppSettings>): AppSettings {
  const defaults: AppSettings = {
    theme: 'system',
    defaultModel: 'test/model',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: null,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a conversation with messages
 * Convenience function for creating a populated conversation
 */
export function createMockConversationWithMessages(
  messageContents: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  conversationOverrides?: Partial<Conversation>
): Conversation {
  const messages = messageContents.map((msg) =>
    createMockMessage({
      role: msg.role,
      content: msg.content,
    })
  );

  return createMockConversation({
    ...conversationOverrides,
    messages,
  });
}
