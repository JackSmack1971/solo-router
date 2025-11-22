/**
 * Storage utilities for SoloRouter Chat
 * Handles localStorage (conversations, settings) and sessionStorage (API key)
 * Based on CODING_STANDARDS.md Section 5
 */

import type { Conversation, AppSettings } from '../types';

/**
 * Storage keys for localStorage
 * CRITICAL: API key is NEVER stored in localStorage
 */
export const STORAGE_KEYS = {
  CONVERSATIONS: 'solo_router_conversations_v1',
  SETTINGS: 'solo_router_settings_v1',
} as const;

/**
 * Session storage key for API key
 * Separate constant to emphasize security constraint
 */
const API_KEY_SESSION_KEY = 'solo_router_openrouter_api_key';

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
// API Key Storage (sessionStorage ONLY)
// ============================================================================

/**
 * Save OpenRouter API key to sessionStorage
 * CRITICAL: Never use localStorage for API keys
 * The key will be cleared when the browser session ends
 */
export function saveApiKey(key: string): void {
  try {
    sessionStorage.setItem(API_KEY_SESSION_KEY, key);
  } catch {
    console.error('[Storage] Failed to save API key (will not be logged)');
  }
}

/**
 * Retrieve OpenRouter API key from sessionStorage
 * Returns null if not found
 */
export function getApiKey(): string | null {
  try {
    return sessionStorage.getItem(API_KEY_SESSION_KEY);
  } catch {
    console.error('[Storage] Failed to retrieve API key');
    return null;
  }
}

/**
 * Clear API key from sessionStorage
 * Call this on logout or when user wants to switch keys
 */
export function clearApiKey(): void {
  try {
    sessionStorage.removeItem(API_KEY_SESSION_KEY);
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

// ============================================================================
// Storage Size Utilities
// ============================================================================

/**
 * Estimate the size of stored data in bytes
 * Useful for warning users about storage limits
 */
export function estimateStorageSize(): number {
  try {
    let total = 0;
    for (const key in STORAGE_KEYS) {
      const value = localStorage.getItem(STORAGE_KEYS[key as keyof typeof STORAGE_KEYS]);
      if (value) {
        // Approximate size: 2 bytes per character in UTF-16
        total += value.length * 2;
      }
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
