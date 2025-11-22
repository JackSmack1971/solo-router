/**
 * Settings modal for managing API key and app settings
 * Based on CODING_STANDARDS.md Section 5 (Security)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Eye, EyeOff, RefreshCw, Search } from 'lucide-react';
import { getApiKey, saveApiKey, clearApiKey } from '../utils/storage';
import { useChatStore } from '../store/chatStore';
import { formatPricing } from '../utils/tokenUtils';
import type { ModelSummary } from '../types';

interface SettingsModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Callback to close the modal
   */
  onClose: () => void;
}

/**
 * Fallback models if none are loaded
 */
const FALLBACK_MODELS: { id: string; name: string }[] = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
];

/**
 * Settings modal component
 * Handles OpenRouter API key management (stored in sessionStorage only)
 * and application settings (model, temperature, system prompt)
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  // API Key state
  const [apiKey, setApiKey] = useState(() => getApiKey() || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Model search state
  const [modelSearch, setModelSearch] = useState('');

  // App settings from store
  const settings = useChatStore((state) => state.settings);
  const updateSettings = useChatStore((state) => state.updateSettings);
  const availableModels = useChatStore((state) => state.availableModels);
  const isLoadingModels = useChatStore((state) => state.isLoadingModels);
  const fetchModels = useChatStore((state) => state.fetchModels);

  // Use available models or fallback
  const modelsList: (ModelSummary | { id: string; name: string })[] =
    availableModels.length > 0 ? availableModels : FALLBACK_MODELS;

  // Filter models based on search
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) {
      return modelsList;
    }

    const searchLower = modelSearch.toLowerCase();
    return modelsList.filter(
      (model) => {
        const hasDescription = 'description' in model && typeof model.description === 'string';
        return (
          model.id.toLowerCase().includes(searchLower) ||
          model.name.toLowerCase().includes(searchLower) ||
          (hasDescription && model.description?.toLowerCase().includes(searchLower))
        );
      }
    );
  }, [modelsList, modelSearch]);

  // Local state for settings
  const [selectedModel, setSelectedModel] = useState(settings.defaultModel || modelsList[0]?.id || '');
  const [temperature, setTemperature] = useState(settings.temperature);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || '');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Use setTimeout to avoid setState during render
      const timer = setTimeout(() => {
        const key = getApiKey();
        setApiKey(key || '');
        setIsSaved(false);
        setModelSearch('');
        // Update local settings from store
        setSelectedModel(settings.defaultModel || modelsList[0]?.id || '');
        setTemperature(settings.temperature);
        setSystemPrompt(settings.systemPrompt || '');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, settings, modelsList]);

  // Fetch models when modal opens if we don't have any
  useEffect(() => {
    if (isOpen && availableModels.length === 0 && !isLoadingModels) {
      fetchModels();
    }
  }, [isOpen, availableModels.length, isLoadingModels, fetchModels]);

  /**
   * Handle save button click
   */
  const handleSave = () => {
    // Save API key if provided
    if (apiKey.trim()) {
      saveApiKey(apiKey.trim());
    }

    // Save app settings
    updateSettings({
      defaultModel: selectedModel,
      temperature,
      systemPrompt: systemPrompt.trim() || null,
    });

    setIsSaved(true);

    // Auto-close after a short delay
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  /**
   * Handle clear API key button click
   */
  const handleClearApiKey = () => {
    clearApiKey();
    setApiKey('');
    setIsSaved(false);
  };

  /**
   * Handle Enter key press in input
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* API Key Section */}
          <div>
            <label
              htmlFor="api-key"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              OpenRouter API Key
            </label>
            <div className="relative">
              <input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="sk-or-v1-..."
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Your API key is stored in session storage and will be cleared when you close
              the browser.
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Get your API key from{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                openrouter.ai/keys
              </a>
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700" />

          {/* Model Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="model-select"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Default Model
              </label>
              <button
                onClick={() => fetchModels()}
                disabled={isLoadingModels}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Refresh models"
              >
                <RefreshCw
                  size={14}
                  className={isLoadingModels ? 'animate-spin' : ''}
                />
                Refresh
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-2">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>

            {/* Model Dropdown */}
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              size={Math.min(filteredModels.length, 8)}
            >
              {filteredModels.length === 0 ? (
                <option value="" disabled>
                  No models found
                </option>
              ) : (
                filteredModels.map((model) => {
                  const hasPricing = 'pricing' in model && model.pricing;
                  const pricingText = hasPricing ? ` (${formatPricing(model.pricing!)})` : '';
                  return (
                    <option key={model.id} value={model.id}>
                      {model.name}{pricingText}
                    </option>
                  );
                })
              )}
            </select>

            {/* Selected model details */}
            {selectedModel && (() => {
              const model = modelsList.find((m) => m.id === selectedModel);
              if (!model) return null;

              const hasDescription = 'description' in model && model.description;
              const hasContextLength = 'contextLength' in model && model.contextLength;
              const hasPricing = 'pricing' in model && model.pricing;

              return (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {model.name}
                  </p>
                  {hasDescription && (
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {(model as ModelSummary).description}
                    </p>
                  )}
                  {hasContextLength && (
                    <p className="text-gray-500 dark:text-gray-500 mt-1">
                      Context: {(model as ModelSummary).contextLength!.toLocaleString()} tokens
                    </p>
                  )}
                  {hasPricing && (
                    <p className="text-gray-500 dark:text-gray-500 mt-1">
                      Pricing: {formatPricing((model as ModelSummary).pricing!)}
                    </p>
                  )}
                </div>
              );
            })()}

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              The model to use for new conversations. Pricing shown as prompt/completion per 1M tokens.
            </p>
          </div>

          {/* Temperature Slider */}
          <div>
            <label
              htmlFor="temperature"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Temperature: {temperature.toFixed(1)}
            </label>
            <input
              id="temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>Precise (0.0)</span>
              <span>Balanced (1.0)</span>
              <span>Creative (2.0)</span>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Controls randomness in responses. Lower values are more focused and deterministic.
            </p>
          </div>

          {/* System Prompt */}
          <div>
            <label
              htmlFor="system-prompt"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              System Prompt (Optional)
            </label>
            <textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Instructions that set the assistant's behavior and personality.
            </p>
          </div>

          {/* Success Message */}
          {isSaved && (
            <div className="p-3 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-md">
              <p className="text-sm text-green-800 dark:text-green-200">
                Settings saved successfully!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClearApiKey}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Clear API Key
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
