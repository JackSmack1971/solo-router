/**
 * Tests for ConfirmationModal component (AT-009)
 * Tests display, callback handling, and keyboard interactions
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmationModal } from '../ConfirmationModal';

describe('ConfirmationModal Component (AT-009)', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display and Content (AT-009)', () => {
    it('should render modal with title and message', () => {
      render(
        <ConfirmationModal
          isOpen={true}
          title="Delete Conversation"
          message="Are you sure you want to delete this conversation?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const title = screen.getByText('Delete Conversation');
      const message = screen.getByText('Are you sure you want to delete this conversation?');

      expect(title).toBeTruthy();
      expect(message).toBeTruthy();
    });

    it('should not render when isOpen is false', () => {
      const { container } = render(
        <ConfirmationModal
          isOpen={false}
          title="Delete Conversation"
          message="Are you sure?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show destructive styling when destructive prop is true', () => {
      const { container } = render(
        <ConfirmationModal
          isOpen={true}
          title="Delete Everything"
          message="This action cannot be undone"
          destructive={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Should show alert triangle icon
      const alertIcon = container.querySelector('.text-red-600');
      expect(alertIcon).toBeTruthy();

      // Confirm button should have red background
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton.className).toContain('bg-red-600');
    });

    it('should use custom button text when provided', () => {
      render(
        <ConfirmationModal
          isOpen={true}
          title="Clear History"
          message="Clear all conversations?"
          confirmText="Clear All"
          cancelText="Keep"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Clear All' });
      const cancelButton = screen.getByRole('button', { name: 'Keep' });

      expect(confirmButton).toBeTruthy();
      expect(cancelButton).toBeTruthy();
    });
  });

  describe('Callback Handling (AT-009)', () => {
    it('should call onConfirm when confirm button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ConfirmationModal
          isOpen={true}
          title="Confirm Action"
          message="Proceed?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });

      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ConfirmationModal
          isOpen={true}
          title="Confirm Action"
          message="Proceed?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });

      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should call onCancel when X button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ConfirmationModal
          isOpen={true}
          title="Confirm Action"
          message="Proceed?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const closeButton = screen.getByRole('button', { name: /Close confirmation dialog/ });

      await user.click(closeButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should call onCancel when Escape key is pressed', async () => {
      const user = userEvent.setup();
      render(
        <ConfirmationModal
          isOpen={true}
          title="Confirm Action"
          message="Proceed?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await user.keyboard('{Escape}');

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });
});
