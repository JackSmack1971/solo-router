/**
 * Main application component
 * Implements sidebar, chat interface, and settings modal
 * Based on SPEC.md FR-001 through FR-004
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Trash2, Settings, MessageSquare, Menu, X, Download, Upload, Pencil, Check, Search } from 'lucide-react';
import { useChatStore } from './store/chatStore';
import { useToastStore } from './store/toastStore';
import { ChatInterface } from './components/ChatInterface';
import { SettingsModal } from './components/SettingsModal';
import { ToastContainer } from './components/ToastContainer';
import { ConfirmationModal } from './components/ConfirmationModal';
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
  onRename: (newTitle: string) => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  title,
  isActive,
  onSelect,
  onDelete,
  onRename,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditedTitle(title);
  };

  const handleSaveEdit = () => {
    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== title) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedTitle(title);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (isEditing) {
    return (
      <div
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <MessageSquare size={16} className="flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSaveEdit}
          className={`flex-1 min-w-0 px-2 py-1 text-sm rounded ${
            isActive
              ? 'bg-blue-700 text-white placeholder-blue-200'
              : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSaveEdit();
          }}
          className={`p-1 rounded ${
            isActive
              ? 'hover:bg-blue-700'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          aria-label="Save title"
        >
          <Check size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCancelEdit();
          }}
          className={`p-1 rounded ${
            isActive
              ? 'hover:bg-blue-700'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          aria-label="Cancel edit"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

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
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleStartEdit}
          className={`p-1 rounded ${
            isActive
              ? 'hover:bg-blue-700'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          aria-label="Edit title"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={`p-1 rounded ${
            isActive
              ? 'hover:bg-blue-700'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          aria-label="Delete conversation"
        >
          <Trash2 size={14} />
        </button>
      </div>
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
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Toast store
  const toast = useToastStore();

  // Initialize theme
  useTheme();

  // Connect to store
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const createConversation = useChatStore((state) => state.createConversation);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const renameConversation = useChatStore((state) => state.renameConversation);
  const loadFromStorage = useChatStore((state) => state.loadFromStorage);

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return conversations;
    }

    const searchLower = searchQuery.toLowerCase();
    return conversations.filter((conv) =>
      conv.title.toLowerCase().includes(searchLower)
    );
  }, [conversations, searchQuery]);

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
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Conversation',
      message: 'Are you sure you want to delete this conversation? This action cannot be undone.',
      onConfirm: () => {
        deleteConversation(id);
        setConfirmationModal({ ...confirmationModal, isOpen: false });
      },
    });
  };

  /**
   * Handle export data
   */
  const handleExportData = () => {
    try {
      exportData();
      toast.success('Data exported successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export data');
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
      toast.info('Importing data...');
      const result = await importData(file, 'merge');
      toast.success(`Imported ${result.conversations} conversations successfully!`);

      // Reload data from storage
      loadFromStorage();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import data');
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
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium mb-3"
            >
              <Plus size={18} />
              New Chat
            </button>

            {/* Search Input */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
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
            ) : filteredConversations.length === 0 ? (
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                No conversations match "{searchQuery}"
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  id={conv.id}
                  title={conv.title}
                  isActive={conv.id === activeConversationId}
                  onSelect={() => setActiveConversation(conv.id)}
                  onDelete={() => handleDeleteConversation(conv.id)}
                  onRename={(newTitle) => renameConversation(conv.id, newTitle)}
                />
              ))
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
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

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        onConfirm={confirmationModal.onConfirm}
        onCancel={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
        destructive={true}
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
}

export default App;
