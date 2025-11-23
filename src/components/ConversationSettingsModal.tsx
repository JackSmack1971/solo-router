/**
 * Conversation Settings Modal for per-conversation tuning
 * Allows changing model, temperature, and system prompt for a specific conversation
 * Based on Phase 11: Conversation Controls (Edit & Tune)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { formatPricing } from '../utils/tokenUtils';
import type { Conversation } from '../types';

interface ConversationSettingsModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Callback to close the modal
   */
  onClose: () => void;

  /**
   * The conversation to edit settings for
   */
  conversation: Conversation | null;
}

/**
 * Conversation Settings Modal Component
 */
export const ConversationSettingsModal: React.FC<ConversationSettingsModalProps> = ({
  isOpen,
  onClose,
  conversation,
}) => {
  // Model search state
  const [modelSearch, setModelSearch] = useState('');

  // Store access
  const availableModels = useChatStore((state) => state.availableModels);
  const updateConversationSettings = useChatStore((state) => state.updateConversationSettings);
  const updateConversationModel = useChatStore((state) => state.updateConversationModel);

  // Local state for settings
  const [selectedModel, setSelectedModel] = useState(conversation?.model || '');
  const [temperature, setTemperature] = useState(conversation?.settings.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(conversation?.settings.maxTokens ?? 4096);
  const [systemPrompt, setSystemPrompt] = useState(conversation?.settings.systemPrompt || '');

  // Filter models based on search
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) {
      return availableModels;
    }

    const searchLower = modelSearch.toLowerCase();
    return availableModels.filter(
      (model) =>
        model.id.toLowerCase().includes(searchLower) ||
        model.name.toLowerCase().includes(searchLower) ||
        model.description?.toLowerCase().includes(searchLower)
    );
  }, [availableModels, modelSearch]);

  // Reset state when modal opens or conversation changes
  useEffect(() => {
    if (isOpen && conversation) {
      // Schedule state updates to avoid synchronous setState in effect
      const timer = setTimeout(() => {
        setSelectedModel(conversation.model);
        setTemperature(conversation.settings.temperature);
        setMaxTokens(conversation.settings.maxTokens);
        setSystemPrompt(conversation.settings.systemPrompt || '');
        setModelSearch('');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, conversation]);

  /**
   * Handle save button click
   */
  const handleSave = () => {
    if (!conversation) {
      return;
    }

    // Update model if changed
    if (selectedModel !== conversation.model) {
      updateConversationModel(conversation.id, selectedModel);
    }

    // Update settings if changed
    updateConversationSettings(conversation.id, {
      temperature,
      maxTokens,
      systemPrompt: systemPrompt.trim() || null,
    });

    onClose();
  };

  // Don't render if not open or no conversation
  if (!isOpen || !conversation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Conversation Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label="Close conversation settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Info Banner */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              These settings apply only to <strong>{conversation.title}</strong>
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label
              htmlFor="conv-model-select"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Model
            </label>

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
              id="conv-model-select"
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
                  const pricingText = model.pricing ? ` (${formatPricing(model.pricing)})` : '';
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
              const model = availableModels.find((m) => m.id === selectedModel);
              if (!model) return null;

              return (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {model.name}
                  </p>
                  {model.description && (
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {model.description}
                    </p>
                  )}
                  {model.contextLength && (
                    <p className="text-gray-500 dark:text-gray-500 mt-1">
                      Context: {model.contextLength.toLocaleString()} tokens
                    </p>
                  )}
                  {model.pricing && (
                    <p className="text-gray-500 dark:text-gray-500 mt-1">
                      Pricing: {formatPricing(model.pricing)}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Temperature Slider */}
          <div>
            <label
              htmlFor="conv-temperature"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Temperature: {temperature.toFixed(1)}
            </label>
            <input
              id="conv-temperature"
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
          </div>

          {/* Max Tokens */}
          <div>
            <label
              htmlFor="conv-max-tokens"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Max Tokens: {maxTokens}
            </label>
            <input
              id="conv-max-tokens"
              type="range"
              min="256"
              max="8192"
              step="256"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Maximum length of the generated response
            </p>
          </div>

          {/* System Prompt */}
          <div>
            <label
              htmlFor="conv-system-prompt"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              System Prompt (Optional)
            </label>
            <textarea
              id="conv-system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Cancel
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
