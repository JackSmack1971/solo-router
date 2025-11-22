/**
 * Storage utilities for SoloRouter Chat
 * Handles localStorage (conversations, settings) and sessionStorage (API key)
 * Based on CODING_STANDARDS.md Section 5
 */

import type { Conversation, AppSettings } from '../types';

/**
 * Storage keys for localStorage
 * NOTE: API key MAY be stored in localStorage if user explicitly opts in
 */
export const STORAGE_KEYS = {
  CONVERSATIONS: 'solo_router_conversations_v1',
  SETTINGS: 'solo_router_settings_v1',
} as const;

/**
 * Session storage key for API key (default, cleared on browser close)
 */
const API_KEY_SESSION_KEY = 'solo_router_openrouter_api_key';

/**
 * LocalStorage key for API key (optional, persistent across sessions)
 * Only used when user explicitly chooses "Remember key on this device"
 */
const API_KEY_LOCAL_KEY = 'solo_router_openrouter_api_key_local';

// ============================================================================
// Conversation Storage (localStorage)
// ============================================================================

/**
 * Save conversations to localStorage
 * Includes error handling to prevent data loss
 */
export function saveConversations(conversations: Conversation[]): void {
  try {
    const data = JSON.stringify(conversations);
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, data);
  } catch (err) {
    console.error('[Storage] Failed to save conversations:', err);
    // Note: We don't throw here to avoid breaking the app flow
    // The user will see the error in console but can continue using the app
  }
}

/**
 * Load conversations from localStorage
 * Returns empty array if data is missing or corrupted
 */
export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    // Validate that we got an array
    if (!Array.isArray(parsed)) {
      console.warn('[Storage] Conversations data is not an array, resetting');
      return [];
    }

    // Basic validation of conversation structure
    const valid = parsed.every(
      (conv) =>
        typeof conv === 'object' &&
        conv !== null &&
        typeof conv.id === 'string' &&
        Array.isArray(conv.messages)
    );

    if (!valid) {
      console.warn('[Storage] Invalid conversation structure detected, resetting');
      return [];
    }

    return parsed as Conversation[];
  } catch (err) {
    console.warn('[Storage] Conversation data corrupted or invalid, resetting:', err);
    // Clear corrupted data
    localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
    return [];
  }
}

/**
 * Clear all conversations from localStorage
 * Use with caution - this cannot be undone
 */
export function clearConversations(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
  } catch (err) {
    console.error('[Storage] Failed to clear conversations:', err);
  }
}

// ============================================================================
// Settings Storage (localStorage)
// ============================================================================

/**
 * Default settings for the application
 */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  defaultModel: null,
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: null,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
};

/**
 * Save application settings to localStorage
 */
export function saveSettings(settings: AppSettings): void {
  try {
    const data = JSON.stringify(settings);
    localStorage.setItem(STORAGE_KEYS.SETTINGS, data);
  } catch (err) {
    console.error('[Storage] Failed to save settings:', err);
  }
}

/**
 * Load application settings from localStorage
 * Returns default settings if data is missing or corrupted
 */
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(raw);

    // Validate basic structure
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn('[Storage] Settings data is invalid, using defaults');
      return { ...DEFAULT_SETTINGS };
    }

    // Merge with defaults to handle version upgrades
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch (err) {
    console.warn('[Storage] Settings data corrupted, using defaults:', err);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Clear settings from localStorage
 */
export function clearSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  } catch (err) {
    console.error('[Storage] Failed to clear settings:', err);
  }
}

// ============================================================================
// API Key Storage (sessionStorage by default, localStorage if persist=true)
// ============================================================================

/**
 * Save OpenRouter API key to storage
 * @param key - The API key to save
 * @param persist - If true, save to localStorage (persists across sessions)
 *                  If false, save to sessionStorage (cleared on browser close)
 *
 * SECURITY NOTE: Persisting to localStorage is optional and requires explicit user consent
 */
export function saveApiKey(key: string, persist: boolean = false): void {
  try {
    if (persist) {
      // User opted to persist - save to localStorage
      localStorage.setItem(API_KEY_LOCAL_KEY, key);
      // Clear from sessionStorage to avoid duplication
      sessionStorage.removeItem(API_KEY_SESSION_KEY);
    } else {
      // Default: save to sessionStorage only
      sessionStorage.setItem(API_KEY_SESSION_KEY, key);
      // Clear from localStorage to ensure we don't have stale persistent key
      localStorage.removeItem(API_KEY_LOCAL_KEY);
    }
  } catch {
    console.error('[Storage] Failed to save API key (will not be logged)');
  }
}

/**
 * Retrieve OpenRouter API key from storage
 * Checks sessionStorage first (temporary), then localStorage (persistent)
 * Returns null if not found in either location
 */
export function getApiKey(): string | null {
  try {
    // Check sessionStorage first (takes precedence)
    const sessionKey = sessionStorage.getItem(API_KEY_SESSION_KEY);
    if (sessionKey) {
      return sessionKey;
    }

    // Fall back to localStorage (persistent key if user opted in)
    const localKey = localStorage.getItem(API_KEY_LOCAL_KEY);
    if (localKey) {
      return localKey;
    }

    return null;
  } catch {
    console.error('[Storage] Failed to retrieve API key');
    return null;
  }
}

/**
 * Clear API key from both sessionStorage and localStorage
 * Call this on logout or when user wants to switch keys
 */
export function clearApiKey(): void {
  try {
    sessionStorage.removeItem(API_KEY_SESSION_KEY);
    localStorage.removeItem(API_KEY_LOCAL_KEY);
  } catch {
    console.error('[Storage] Failed to clear API key');
  }
}

/**
 * Check if an API key is currently stored
 * Useful for conditional UI rendering
 */
export function hasApiKey(): boolean {
  return getApiKey() !== null;
}

/**
 * Check if the API key is currently persisted in localStorage
 * Returns true if key is saved persistently, false if in sessionStorage or not saved
 */
export function isApiKeyPersisted(): boolean {
  try {
    return localStorage.getItem(API_KEY_LOCAL_KEY) !== null;
  } catch {
    return false;
  }
}

// ============================================================================
// Storage Size Utilities
// ============================================================================

/**
 * Estimate the size of stored data in bytes
 * Includes conversations, settings, and persisted API key (if any)
 * Useful for warning users about storage limits
 */
export function estimateStorageSize(): number {
  try {
    let total = 0;

    // Count standard storage keys
    for (const key in STORAGE_KEYS) {
      const value = localStorage.getItem(STORAGE_KEYS[key as keyof typeof STORAGE_KEYS]);
      if (value) {
        // Approximate size: 2 bytes per character in UTF-16
        total += value.length * 2;
      }
    }

    // Include persisted API key if it exists
    const persistedKey = localStorage.getItem(API_KEY_LOCAL_KEY);
    if (persistedKey) {
      total += persistedKey.length * 2;
    }

    return total;
  } catch {
    return 0;
  }
}

/**
 * Check if we're approaching localStorage limits
 * Returns true if usage is over 4MB (typical limit is 5-10MB)
 */
export function isStorageNearLimit(): boolean {
  const size = estimateStorageSize();
  const WARN_THRESHOLD = 4 * 1024 * 1024; // 4MB
  return size > WARN_THRESHOLD;
}

// ============================================================================
// Export / Import (FR-006)
// ============================================================================

/**
 * Export format for backup data
 */
export interface ExportData {
  version: string;
  exportedAt: number;
  conversations: Conversation[];
  settings: AppSettings;
}

/**
 * Export all conversations and settings to a JSON file
 * Downloads the file with name: solo-router-backup.json
 */
export function exportData(): void {
  try {
    const conversations = loadConversations();
    const settings = loadSettings();

    const exportData: ExportData = {
      version: '1.0',
      exportedAt: Date.now(),
      conversations,
      settings,
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create a temporary link element and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `solo-router-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);

    console.log('[Storage] Data exported successfully');
  } catch (err) {
    console.error('[Storage] Failed to export data:', err);
    throw new Error('Failed to export data. Please try again.');
  }
}

/**
 * Import conversations and settings from a JSON file
 * Merges imported conversations with existing ones
 * @param file - The JSON file to import
 * @param mode - 'merge' to keep existing data, 'replace' to overwrite
 */
export async function importData(
  file: File,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ conversations: number; settings: boolean }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error('File is empty');
        }

        const importData = JSON.parse(text) as ExportData;

        // Validate import data structure
        if (
          !importData.version ||
          !Array.isArray(importData.conversations) ||
          typeof importData.settings !== 'object'
        ) {
          throw new Error('Invalid backup file format');
        }

        // Import settings
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...importData.settings,
        };
        saveSettings(mergedSettings);

        // Import conversations
        let mergedConversations: Conversation[];

        if (mode === 'replace') {
          mergedConversations = importData.conversations;
        } else {
          // Merge mode: combine with existing conversations
          const existing = loadConversations();
          const existingIds = new Set(existing.map((c) => c.id));

          // Filter out duplicates by ID
          const newConversations = importData.conversations.filter(
            (c) => !existingIds.has(c.id)
          );

          mergedConversations = [...existing, ...newConversations];
        }

        saveConversations(mergedConversations);

        console.log('[Storage] Data imported successfully');
        resolve({
          conversations: importData.conversations.length,
          settings: true,
        });
      } catch (err) {
        console.error('[Storage] Failed to import data:', err);
        reject(
          new Error(
            err instanceof Error ? err.message : 'Failed to parse backup file'
          )
        );
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
