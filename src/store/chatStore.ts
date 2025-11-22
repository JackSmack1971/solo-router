/**
 * Zustand store for chat state management
 * Handles conversations, messages, streaming, and persistence
 * Based on CODING_STANDARDS.md Section 4 and SPEC.md FR-001, FR-002
 */

import { create } from 'zustand';
import type { Conversation, Message, AppSettings, TokenUsage, ModelSummary } from '../types';
import {
  saveConversations,
  loadConversations,
  saveSettings,
  loadSettings,
  DEFAULT_SETTINGS,
} from '../utils/storage';
import { defaultProvider } from '../services/openRouter';

/**
 * Chat store state interface
 */
interface ChatStore {
  // State
  conversations: Conversation[];
  activeConversationId: string | null;
  settings: AppSettings;
  isGenerating: boolean;
  currentAbortController: AbortController | null;
  error: string | null;
  availableModels: ModelSummary[];
  isLoadingModels: boolean;

  // Conversation Management
  createConversation: (title?: string) => string;
  setActiveConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  getActiveConversation: () => Conversation | null;

  // Message Management
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;

  // Streaming & Generation
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;

  // Settings Management
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Model Management
  fetchModels: () => Promise<void>;

  // Error Management
  setError: (error: string | null) => void;
  clearError: () => void;

  // Persistence
  loadFromStorage: () => void;
  saveToStorage: () => void;

  // Utility
  clearAllData: () => void;
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a default conversation title from the first message
 */
function generateConversationTitle(firstMessage: string): string {
  const maxLength = 50;
  const trimmed = firstMessage.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return trimmed.substring(0, maxLength) + '...';
}

/**
 * Create a new conversation with default settings
 */
function createNewConversation(title: string, settings: AppSettings): Conversation {
  const now = Date.now();

  return {
    id: generateId(),
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
    model: settings.defaultModel || 'openai/gpt-3.5-turbo',
    settings: {
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      systemPrompt: settings.systemPrompt,
    },
    metadata: {
      messageCount: 0,
    },
  };
}

/**
 * Debounce helper for saving to storage
 */
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(fn: () => void, delay = 500): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(fn, delay);
}

/**
 * Load models from localStorage cache
 */
function loadModelsFromCache(): ModelSummary[] {
  try {
    const cached = localStorage.getItem('solorouter_models_cache');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn('[ChatStore] Failed to load models from cache:', err);
  }
  return [];
}

/**
 * Save models to localStorage cache
 */
function saveModelsToCache(models: ModelSummary[]): void {
  try {
    localStorage.setItem('solorouter_models_cache', JSON.stringify(models));
  } catch (err) {
    console.warn('[ChatStore] Failed to save models to cache:', err);
  }
}

/**
 * Create the chat store
 */
export const useChatStore = create<ChatStore>()((set, get) => ({
  // Initial state
  conversations: [],
  activeConversationId: null,
  settings: { ...DEFAULT_SETTINGS },
  isGenerating: false,
  currentAbortController: null,
  error: null,
  availableModels: loadModelsFromCache(),
  isLoadingModels: false,

  // ========================================================================
  // Conversation Management
  // ========================================================================

  createConversation: (title = 'New Conversation') => {
    const { settings } = get();
    const conversation = createNewConversation(title, settings);

    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: conversation.id,
    }));

    // Save after creating
    debouncedSave(() => get().saveToStorage());

    return conversation.id;
  },

  setActiveConversation: (id: string) => {
    const { conversations } = get();
    const exists = conversations.some((conv) => conv.id === id);

    if (exists) {
      set({ activeConversationId: id });
    } else {
      console.warn(`[ChatStore] Conversation ${id} not found`);
    }
  },

  renameConversation: (id: string, title: string) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === id
          ? { ...conv, title, updatedAt: Date.now() }
          : conv
      ),
    }));

    debouncedSave(() => get().saveToStorage());
  },

  deleteConversation: (id: string) => {
    set((state) => {
      const newConversations = state.conversations.filter((conv) => conv.id !== id);
      const newActiveId =
        state.activeConversationId === id
          ? newConversations[0]?.id || null
          : state.activeConversationId;

      return {
        conversations: newConversations,
        activeConversationId: newActiveId,
      };
    });

    debouncedSave(() => get().saveToStorage());
  },

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    if (!activeConversationId) {
      return null;
    }
    return conversations.find((conv) => conv.id === activeConversationId) || null;
  },

  // ========================================================================
  // Message Management
  // ========================================================================

  addMessage: (conversationId: string, messageData: Omit<Message, 'id' | 'timestamp'>) => {
    const message: Message = {
      id: generateId(),
      timestamp: Date.now(),
      ...messageData,
    };

    set((state) => ({
      conversations: state.conversations.map((conv) => {
        if (conv.id !== conversationId) {
          return conv;
        }

        const newMessages = [...conv.messages, message];

        // Update conversation title if this is the first user message
        let newTitle = conv.title;
        if (
          conv.title === 'New Conversation' &&
          message.role === 'user' &&
          conv.messages.length === 0
        ) {
          newTitle = generateConversationTitle(message.content);
        }

        return {
          ...conv,
          messages: newMessages,
          title: newTitle,
          updatedAt: Date.now(),
          metadata: {
            ...conv.metadata,
            messageCount: newMessages.length,
          },
        };
      }),
    }));

    debouncedSave(() => get().saveToStorage());
  },

  updateMessage: (conversationId: string, messageId: string, content: string) => {
    set((state) => ({
      conversations: state.conversations.map((conv) => {
        if (conv.id !== conversationId) {
          return conv;
        }

        return {
          ...conv,
          messages: conv.messages.map((msg) =>
            msg.id === messageId ? { ...msg, content } : msg
          ),
          updatedAt: Date.now(),
        };
      }),
    }));

    // Don't debounce during streaming - save immediately
    if (!get().isGenerating) {
      debouncedSave(() => get().saveToStorage());
    }
  },

  deleteMessage: (conversationId: string, messageId: string) => {
    set((state) => ({
      conversations: state.conversations.map((conv) => {
        if (conv.id !== conversationId) {
          return conv;
        }

        const newMessages = conv.messages.filter((msg) => msg.id !== messageId);

        return {
          ...conv,
          messages: newMessages,
          updatedAt: Date.now(),
          metadata: {
            ...conv.metadata,
            messageCount: newMessages.length,
          },
        };
      }),
    }));

    debouncedSave(() => get().saveToStorage());
  },

  // ========================================================================
  // Streaming & Generation
  // ========================================================================

  sendMessage: async (content: string) => {
    const {
      getActiveConversation,
      addMessage,
    } = get();

    const activeConv = getActiveConversation();

    if (!activeConv) {
      console.error('[ChatStore] No active conversation');
      return;
    }

    // Add user message
    addMessage(activeConv.id, {
      role: 'user',
      content,
    });

    // Create placeholder for assistant message
    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: activeConv.model,
    };

    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === activeConv.id
          ? { ...conv, messages: [...conv.messages, assistantMessage] }
          : conv
      ),
    }));

    // Create abort controller for this request
    const abortController = new AbortController();

    set({
      isGenerating: true,
      currentAbortController: abortController,
    });

    try {
      // Get the updated conversation with user message
      const updatedConv = get().conversations.find((c) => c.id === activeConv.id);
      if (!updatedConv) {
        throw new Error('Conversation disappeared during generation');
      }

      // Prepare messages for API (exclude the empty assistant message we just added)
      const messagesForApi = updatedConv.messages.slice(0, -1);

      await defaultProvider.streamChat({
        messages: messagesForApi,
        model: activeConv.model,
        settings: {
          temperature: activeConv.settings.temperature,
          maxTokens: activeConv.settings.maxTokens,
          systemPrompt: activeConv.settings.systemPrompt,
        },
        onChunk: (text: string) => {
          // Append text to the assistant message
          set((state) => ({
            conversations: state.conversations.map((conv) =>
              conv.id === activeConv.id
                ? {
                    ...conv,
                    messages: conv.messages.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: msg.content + text }
                        : msg
                    ),
                  }
                : conv
            ),
          }));
        },
        onDone: (usage?: TokenUsage) => {
          // Update token count if available
          if (usage) {
            set((state) => ({
              conversations: state.conversations.map((conv) => {
                if (conv.id !== activeConv.id) {
                  return conv;
                }

                return {
                  ...conv,
                  messages: conv.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, tokenCount: usage.totalTokens }
                      : msg
                  ),
                  metadata: {
                    messageCount: conv.metadata?.messageCount || conv.messages.length,
                    totalTokens:
                      (conv.metadata?.totalTokens || 0) + (usage.totalTokens || 0),
                  },
                };
              }),
            }));
          }

          set({
            isGenerating: false,
            currentAbortController: null,
          });

          // Save to storage after completion
          get().saveToStorage();
        },
        onError: (error: Error) => {
          console.error('[ChatStore] Generation error:', error);

          // Parse error message to detect specific error codes
          let errorMessage = error.message || 'Failed to generate response';
          const errorStr = error.message?.toLowerCase() || '';

          // Detect specific error codes (R-001)
          if (errorStr.includes('401') || errorStr.includes('unauthorized') || errorStr.includes('invalid api key')) {
            errorMessage = 'Invalid API Key. Please check your OpenRouter API key in Settings.';
          } else if (errorStr.includes('402') || errorStr.includes('insufficient credits') || errorStr.includes('no credits')) {
            errorMessage = 'Insufficient Credits. Your OpenRouter account has run out of credits.';
          } else if (errorStr.includes('429') || errorStr.includes('rate limit')) {
            errorMessage = 'Rate Limit Exceeded. Please wait a moment before trying again.';
          } else if (errorStr.includes('api key') || errorStr.includes('missing api key')) {
            errorMessage = 'Missing API Key. Please set your OpenRouter API key in Settings.';
          }

          // Set global error state
          get().setError(errorMessage);

          // Mark the message as having an error
          set((state) => ({
            conversations: state.conversations.map((conv) =>
              conv.id === activeConv.id
                ? {
                    ...conv,
                    messages: conv.messages.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            error: true,
                            content:
                              msg.content ||
                              `Error: ${errorMessage}`,
                          }
                        : msg
                    ),
                  }
                : conv
            ),
            isGenerating: false,
            currentAbortController: null,
          }));

          // Save even on error
          get().saveToStorage();
        },
        signal: abortController.signal,
      });
    } catch (error) {
      console.error('[ChatStore] Unexpected error in sendMessage:', error);
      set({
        isGenerating: false,
        currentAbortController: null,
      });
    }
  },

  stopGeneration: () => {
    const { currentAbortController } = get();

    if (currentAbortController) {
      currentAbortController.abort();
      set({
        isGenerating: false,
        currentAbortController: null,
      });

      // Save the partial response
      get().saveToStorage();
    }
  },

  // ========================================================================
  // Settings Management
  // ========================================================================

  updateSettings: (newSettings: Partial<AppSettings>) => {
    set((state) => ({
      settings: {
        ...state.settings,
        ...newSettings,
      },
    }));

    // Save settings immediately (no debounce)
    const { settings } = get();
    saveSettings(settings);
  },

  // ========================================================================
  // Model Management
  // ========================================================================

  fetchModels: async () => {
    set({ isLoadingModels: true });

    try {
      const models = await defaultProvider.listModels();

      set({
        availableModels: models,
        isLoadingModels: false,
      });

      // Cache models to localStorage
      saveModelsToCache(models);
    } catch (err) {
      console.error('[ChatStore] Failed to fetch models:', err);
      set({ isLoadingModels: false });

      // If fetch fails and we have no cached models, use fallback from provider
      const { availableModels } = get();
      if (availableModels.length === 0) {
        const fallbackModels = await defaultProvider.listModels();
        set({ availableModels: fallbackModels });
        saveModelsToCache(fallbackModels);
      }
    }
  },

  // ========================================================================
  // Error Management
  // ========================================================================

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  // ========================================================================
  // Persistence
  // ========================================================================

  loadFromStorage: () => {
    const conversations = loadConversations();
    const settings = loadSettings();

    // Set active to the most recent conversation if available
    const activeId = conversations[0]?.id || null;

    set({
      conversations,
      settings,
      activeConversationId: activeId,
    });
  },

  saveToStorage: () => {
    const { conversations } = get();
    saveConversations(conversations);
  },

  // ========================================================================
  // Utility
  // ========================================================================

  clearAllData: () => {
    set({
      conversations: [],
      activeConversationId: null,
      settings: { ...DEFAULT_SETTINGS },
      isGenerating: false,
      currentAbortController: null,
      error: null,
    });

    // Clear storage
    saveConversations([]);
    saveSettings(DEFAULT_SETTINGS);
  },
}));
