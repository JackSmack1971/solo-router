/**
 * Tests for SettingsModal component (AT-009)
 * Tests form validation, persistence, model selection, and advanced parameters
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsModal } from '../SettingsModal';
import * as storage from '../../utils/storage';
import { useChatStore } from '../../store/chatStore';

// Mock storage utilities
vi.mock('../../utils/storage', () => ({
  getApiKey: vi.fn(),
  saveApiKey: vi.fn(),
  clearApiKey: vi.fn(),
  isApiKeyPersisted: vi.fn(),
  estimateStorageSize: vi.fn(),
}));

// Mock chat store
vi.mock('../../store/chatStore', () => ({
  useChatStore: vi.fn(),
}));

describe('SettingsModal Component (AT-009)', () => {
  const mockUpdateSettings = vi.fn();
  const mockFetchModels = vi.fn();
  const mockOnClose = vi.fn();

  const defaultSettings = {
    defaultModel: 'anthropic/claude-3.5-sonnet',
    temperature: 1.0,
    systemPrompt: null,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    theme: 'system' as const,
  };

  const mockModels = [
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      description: 'Most capable model',
      contextLength: 200000,
      pricing: { prompt: 3.0, completion: 15.0 },
    },
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      description: 'Fast and capable',
      contextLength: 128000,
      pricing: { prompt: 2.5, completion: 10.0 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getApiKey).mockReturnValue('');
    vi.mocked(storage.isApiKeyPersisted).mockReturnValue(false);
    vi.mocked(storage.estimateStorageSize).mockReturnValue(1024);

    // Mock Zustand store
    vi.mocked(useChatStore).mockImplementation((selector: any) => {
      const state = {
        settings: defaultSettings,
        updateSettings: mockUpdateSettings,
        availableModels: mockModels,
        isLoadingModels: false,
        fetchModels: mockFetchModels,
      };
      return selector(state);
    });
  });

  describe('Form Validation and Persistence (AT-009)', () => {
    it('should render with current settings values', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      // Wait for initial setTimeout to complete
      await waitFor(() => {
        const modelSelect = screen.getByLabelText('Default Model');
        expect(modelSelect).toBeTruthy();
      });

      const temperatureSlider = screen.getByLabelText(/Temperature:/);
      expect((temperatureSlider as HTMLInputElement).value).toBe('1');
    });

    it('should save API key when provided', async () => {
      const user = userEvent.setup();
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByLabelText('OpenRouter API Key')).toBeTruthy();
      });

      const apiKeyInput = screen.getByLabelText('OpenRouter API Key');
      const saveButton = screen.getByRole('button', { name: 'Save' });

      await user.clear(apiKeyInput);
      await user.type(apiKeyInput, 'sk-or-v1-test-key');
      await user.click(saveButton);

      await waitFor(() => {
        expect(storage.saveApiKey).toHaveBeenCalledWith('sk-or-v1-test-key', false);
      });
      expect(mockUpdateSettings).toHaveBeenCalled();
    });

    it('should persist API key to localStorage when "remember" is checked', async () => {
      const user = userEvent.setup();
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByLabelText('OpenRouter API Key')).toBeTruthy();
      });

      const apiKeyInput = screen.getByLabelText('OpenRouter API Key');
      const rememberCheckbox = screen.getByRole('checkbox', {
        name: /Remember key on this device/,
      });
      const saveButton = screen.getByRole('button', { name: 'Save' });

      await user.clear(apiKeyInput);
      await user.type(apiKeyInput, 'sk-or-v1-test-key');
      await user.click(rememberCheckbox);
      await user.click(saveButton);

      await waitFor(() => {
        expect(storage.saveApiKey).toHaveBeenCalledWith('sk-or-v1-test-key', true);
      });
    });

    it('should clear API key when clear button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(storage.getApiKey).mockReturnValue('sk-or-v1-existing-key');

      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clear API Key' })).toBeTruthy();
      });

      const clearButton = screen.getByRole('button', { name: 'Clear API Key' });
      await user.click(clearButton);

      expect(storage.clearApiKey).toHaveBeenCalled();
    });

    it('should save settings on Enter key press in API key field', async () => {
      const user = userEvent.setup();
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByLabelText('OpenRouter API Key')).toBeTruthy();
      });

      const apiKeyInput = screen.getByLabelText('OpenRouter API Key');

      await user.clear(apiKeyInput);
      await user.type(apiKeyInput, 'sk-or-v1-test-key{Enter}');

      await waitFor(() => {
        expect(storage.saveApiKey).toHaveBeenCalledWith('sk-or-v1-test-key', false);
      });
      expect(mockUpdateSettings).toHaveBeenCalled();
    });

    it('should update temperature setting', async () => {
      const user = userEvent.setup();
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Temperature:/)).toBeTruthy();
      });

      const temperatureSlider = screen.getByLabelText(/Temperature:/) as HTMLInputElement;
      const saveButton = screen.getByRole('button', { name: 'Save' });

      // For range inputs, we need to use fireEvent or change the value directly
      await user.click(temperatureSlider);
      await user.keyboard('[ArrowLeft][ArrowLeft][ArrowLeft][ArrowLeft][ArrowLeft]'); // Move slider left

      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalled();
      });
    });

    it('should update system prompt setting', async () => {
      const user = userEvent.setup();
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/System Prompt/)).toBeTruthy();
      });

      const systemPromptTextarea = screen.getByLabelText(/System Prompt/);
      const saveButton = screen.getByRole('button', { name: 'Save' });

      await user.clear(systemPromptTextarea);
      await user.type(systemPromptTextarea, 'You are a helpful assistant');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            systemPrompt: 'You are a helpful assistant',
          })
        );
      });
    });

    it('should show advanced parameters when toggled', async () => {
      const user = userEvent.setup();
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Advanced Parameters/ })).toBeTruthy();
      });

      const advancedButton = screen.getByRole('button', { name: /Advanced Parameters/ });

      // Initially advanced params should not be visible
      expect(screen.queryByLabelText(/Top P/)).toBeFalsy();

      await user.click(advancedButton);

      // After clicking, advanced params should be visible
      await waitFor(() => {
        expect(screen.getByLabelText(/Top P/)).toBeTruthy();
      });

      const frequencyPenaltySlider = screen.getByLabelText(/Frequency Penalty:/);
      const presencePenaltySlider = screen.getByLabelText(/Presence Penalty:/);

      expect(frequencyPenaltySlider).toBeTruthy();
      expect(presencePenaltySlider).toBeTruthy();
    });
  });

  describe('Model Selection (AT-009)', () => {
    it('should display available models in dropdown', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Default Model')).toBeTruthy();
      });

      const modelSelect = screen.getByLabelText('Default Model') as HTMLSelectElement;

      expect(modelSelect.options.length).toBe(2);
      expect(modelSelect.options[0].textContent).toContain('Claude 3.5 Sonnet');
      expect(modelSelect.options[1].textContent).toContain('GPT-4o');
    });

    it('should filter models based on search query', async () => {
      const user = userEvent.setup();
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search models...')).toBeTruthy();
      });

      const searchInput = screen.getByPlaceholderText('Search models...');

      await user.type(searchInput, 'claude');

      await waitFor(() => {
        const modelSelect = screen.getByLabelText('Default Model') as HTMLSelectElement;
        // Should only show Claude model
        expect(modelSelect.options.length).toBe(1);
        expect(modelSelect.options[0].textContent).toContain('Claude 3.5 Sonnet');
      });
    });

    it('should refresh models when refresh button is clicked', async () => {
      const user = userEvent.setup();
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Refresh models/ })).toBeTruthy();
      });

      const refreshButton = screen.getByRole('button', { name: /Refresh models/ });

      await user.click(refreshButton);

      expect(mockFetchModels).toHaveBeenCalled();
    });

    it('should display selected model details', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Most capable model')).toBeTruthy();
      });

      // Should display model description and pricing
      const description = screen.getByText('Most capable model');
      const contextLength = screen.getByText(/Context: 200,000 tokens/);

      expect(description).toBeTruthy();
      expect(contextLength).toBeTruthy();
    });
  });

  describe('Modal Behavior (AT-009)', () => {
    it('should close modal when X button is clicked', async () => {
      const user = userEvent.setup();
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Close settings/ })).toBeTruthy();
      });

      const closeButton = screen.getByRole('button', { name: /Close settings/ });

      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not render when isOpen is false', () => {
      const { container } = render(<SettingsModal isOpen={false} onClose={mockOnClose} />);

      expect(container.firstChild).toBeNull();
    });

    it('should show success message after save', async () => {
      const user = userEvent.setup();

      render(<SettingsModal isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
      });

      const saveButton = screen.getByRole('button', { name: 'Save' });

      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Settings saved successfully!')).toBeTruthy();
      });

      // The modal auto-closes after 1 second, but we'll just verify the success message appeared
      expect(mockUpdateSettings).toHaveBeenCalled();
    });
  });
});
