/**
 * Mock store helpers for testing Zustand stores
 * Provides utilities for resetting and creating test store instances
 */

import { create, StoreApi, UseBoundStore } from 'zustand';
import type { Conversation, Message, AppSettings, ModelSummary } from '../../types';
import { DEFAULT_SETTINGS } from '../../utils/storage';

/**
 * Chat store state interface for testing
 */
export interface TestChatStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  settings: AppSettings;
  isGenerating: boolean;
  currentAbortController: AbortController | null;
  error: string | null;
  availableModels: ModelSummary[];
  isLoadingModels: boolean;
  lastSaved: number | null;

  createConversation: (title?: string) => string;
  setActiveConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  getActiveConversation: () => Conversation | null;
  updateConversationSettings: (id: string, settings: Partial<Conversation['settings']>) => void;
  updateConversationModel: (id: string, model: string) => void;

  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  editMessageAndRegenerate: (conversationId: string, messageId: string, newContent: string) => Promise<void>;

  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;

  updateSettings: (settings: Partial<AppSettings>) => void;

  fetchModels: () => Promise<void>;

  setError: (error: string | null) => void;
  clearError: () => void;

  loadFromStorage: () => void;
  saveToStorage: () => void;

  clearAllData: () => void;
}

/**
 * Reset the chat store to its initial state
 * Useful for cleaning up between tests
 */
export function resetStore(store: UseBoundStore<StoreApi<TestChatStore>>): void {
  store.setState({
    conversations: [],
    activeConversationId: null,
    settings: { ...DEFAULT_SETTINGS },
    isGenerating: false,
    currentAbortController: null,
    error: null,
    availableModels: [],
    isLoadingModels: false,
    lastSaved: null,
  });
}

/**
 * Create a test store with initial state
 * Allows for custom initial values
 */
export function createTestStore(initialState?: Partial<TestChatStore>): UseBoundStore<StoreApi<TestChatStore>> {
  const mockActions: Partial<TestChatStore> = {
    createConversation: vi.fn().mockReturnValue('test-conv-id'),
    setActiveConversation: vi.fn(),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn(),
    getActiveConversation: vi.fn().mockReturnValue(null),
    updateConversationSettings: vi.fn(),
    updateConversationModel: vi.fn(),

    addMessage: vi.fn(),
    updateMessage: vi.fn(),
    deleteMessage: vi.fn(),
    editMessageAndRegenerate: vi.fn().mockResolvedValue(undefined),

    sendMessage: vi.fn().mockResolvedValue(undefined),
    stopGeneration: vi.fn(),

    updateSettings: vi.fn(),

    fetchModels: vi.fn().mockResolvedValue(undefined),

    setError: vi.fn(),
    clearError: vi.fn(),

    loadFromStorage: vi.fn(),
    saveToStorage: vi.fn(),

    clearAllData: vi.fn(),
  };

  const defaultState: TestChatStore = {
    conversations: [],
    activeConversationId: null,
    settings: { ...DEFAULT_SETTINGS },
    isGenerating: false,
    currentAbortController: null,
    error: null,
    availableModels: [],
    isLoadingModels: false,
    lastSaved: null,
    ...mockActions,
  } as TestChatStore;

  return create<TestChatStore>(() => ({
    ...defaultState,
    ...initialState,
  }));
}
