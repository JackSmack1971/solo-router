/**
 * Main application component
 * Implements sidebar, chat interface, and settings modal
 * Based on SPEC.md FR-001 through FR-004
 */

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Settings, MessageSquare, Menu, X, Download, Upload } from 'lucide-react';
import { useChatStore } from './store/chatStore';
import { ChatInterface } from './components/ChatInterface';
import { SettingsModal } from './components/SettingsModal';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './hooks/useTheme';
import { hasApiKey, exportData, importData } from './utils/storage';

/**
 * Sidebar conversation item component
 */
interface ConversationItemProps {
  id: string;
  title: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  title,
  isActive,
  onSelect,
  onDelete,
}) => {
  return (
    <div
      className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <MessageSquare size={16} className="flex-shrink-0" />
        <span className="text-sm truncate">{title}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${
          isActive
            ? 'hover:bg-blue-700'
            : 'hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
        aria-label="Delete conversation"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

/**
 * Main application component
 */
function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize theme
  useTheme();

  // Connect to store
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const createConversation = useChatStore((state) => state.createConversation);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const loadFromStorage = useChatStore((state) => state.loadFromStorage);

  /**
   * Load data from storage on mount
   */
  useEffect(() => {
    loadFromStorage();

    // Check if API key is set (use setTimeout to avoid setState during render)
    const timer = setTimeout(() => {
      if (!hasApiKey()) {
        setShowApiKeyWarning(true);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [loadFromStorage]);

  /**
   * Handle new conversation
   */
  const handleNewConversation = () => {
    // Check if API key is set
    if (!hasApiKey()) {
      setIsSettingsOpen(true);
      return;
    }

    createConversation();
  };

  /**
   * Handle delete conversation
   */
  const handleDeleteConversation = (id: string) => {
    if (confirm('Are you sure you want to delete this conversation?')) {
      deleteConversation(id);
    }
  };

  /**
   * Handle export data
   */
  const handleExportData = () => {
    try {
      exportData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export data');
    }
  };

  /**
   * Handle import data
   */
  const handleImportData = () => {
    fileInputRef.current?.click();
  };

  /**
   * Handle file selection for import
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setImportStatus('Importing...');
      const result = await importData(file, 'merge');
      setImportStatus(`Imported ${result.conversations} conversations successfully!`);

      // Reload data from storage
      loadFromStorage();

      // Clear status after 3 seconds
      setTimeout(() => setImportStatus(null), 3000);
    } catch (err) {
      setImportStatus(null);
      alert(err instanceof Error ? err.message : 'Failed to import data');
    } finally {
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Sidebar Overlay - FR-008 */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      {/* Sidebar - FR-008 Mobile Responsive */}
      <div
        className={`${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:static inset-y-0 left-0 z-50 md:z-auto w-64 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 md:transition-none`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                SoloRouter
              </h1>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close sidebar"
              >
                <X size={20} />
              </button>
            </div>
            <button
              onClick={handleNewConversation}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              <Plus size={18} />
              New Chat
            </button>
          </div>

          {/* API Key Warning */}
          {showApiKeyWarning && (
            <div className="m-4 p-3 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              <p className="text-xs text-yellow-800 dark:text-yellow-200 mb-2">
                Please set your OpenRouter API key to start chatting.
              </p>
              <button
                onClick={() => {
                  setIsSettingsOpen(true);
                  setShowApiKeyWarning(false);
                }}
                className="text-xs text-yellow-900 dark:text-yellow-100 font-medium hover:underline"
              >
                Open Settings
              </button>
            </div>
          )}

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {conversations.length === 0 ? (
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                No conversations yet
              </div>
            ) : (
              conversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  id={conv.id}
                  title={conv.title}
                  isActive={conv.id === activeConversationId}
                  onSelect={() => setActiveConversation(conv.id)}
                  onDelete={() => handleDeleteConversation(conv.id)}
                />
              ))
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            {/* Import status message */}
            {importStatus && (
              <div className="p-2 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-lg">
                <p className="text-xs text-green-800 dark:text-green-200 text-center">
                  {importStatus}
                </p>
              </div>
            )}

            {/* Settings and Theme Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors font-medium"
              >
                <Settings size={18} />
                Settings
              </button>
              <ThemeToggle />
            </div>

            {/* Export/Import Data */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportData}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors text-sm"
                aria-label="Export conversations"
              >
                <Download size={16} />
                Export
              </button>
              <button
                onClick={handleImportData}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors text-sm"
                aria-label="Import conversations"
              >
                <Upload size={16} />
                Import
              </button>
            </div>

            {/* Hidden file input for import */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Import file input"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header - FR-008 */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Open sidebar"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            SoloRouter
          </h1>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface onOpenSettings={() => setIsSettingsOpen(true)} />
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
