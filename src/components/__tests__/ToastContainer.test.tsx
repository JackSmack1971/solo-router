/**
 * Tests for ToastContainer component (AT-009)
 * Tests toast rendering, stacking, and auto-dismissal
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastContainer } from '../ToastContainer';
import { useToastStore } from '../../store/toastStore';

describe('ToastContainer Component (AT-009)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear all toasts before each test
    useToastStore.setState({ toasts: [] });
  });

  describe('Toast Rendering and Types (AT-009)', () => {
    it('should not render when there are no toasts', () => {
      const { container } = render(<ToastContainer />);

      expect(container.firstChild).toBeNull();
    });

    it('should render success toast with correct styling', () => {
      useToastStore.getState().success('Operation successful');

      const { container } = render(<ToastContainer />);

      const toast = screen.getByText('Operation successful');
      expect(toast).toBeTruthy();

      // Success toast should have green styling
      const toastContainer = container.querySelector('.bg-green-50');
      expect(toastContainer).toBeTruthy();
    });

    it('should render error toast with correct styling', () => {
      useToastStore.getState().error('An error occurred');

      const { container } = render(<ToastContainer />);

      const toast = screen.getByText('An error occurred');
      expect(toast).toBeTruthy();

      // Error toast should have red styling
      const toastContainer = container.querySelector('.bg-red-50');
      expect(toastContainer).toBeTruthy();
    });

    it('should render info toast with correct styling', () => {
      useToastStore.getState().info('Information message');

      const { container } = render(<ToastContainer />);

      const toast = screen.getByText('Information message');
      expect(toast).toBeTruthy();

      // Info toast should have blue styling
      const toastContainer = container.querySelector('.bg-blue-50');
      expect(toastContainer).toBeTruthy();
    });
  });

  describe('Toast Stacking and Dismissal (AT-009)', () => {
    it('should stack multiple toasts', () => {
      useToastStore.getState().success('First toast');
      useToastStore.getState().error('Second toast');
      useToastStore.getState().info('Third toast');

      render(<ToastContainer />);

      const toast1 = screen.getByText('First toast');
      const toast2 = screen.getByText('Second toast');
      const toast3 = screen.getByText('Third toast');

      expect(toast1).toBeTruthy();
      expect(toast2).toBeTruthy();
      expect(toast3).toBeTruthy();
    });

    it('should dismiss toast when X button is clicked', async () => {
      const user = userEvent.setup();
      useToastStore.getState().success('Dismissible toast');

      render(<ToastContainer />);

      const dismissButton = screen.getByRole('button', { name: /Dismiss notification/ });

      await user.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByText('Dismissible toast')).toBeFalsy();
      });
    });

    it('should auto-dismiss toast after specified duration', async () => {
      vi.useFakeTimers();

      act(() => {
        useToastStore.getState().addToast('success', 'Auto-dismiss toast', 100);
      });

      render(<ToastContainer />);

      const toast = screen.getByText('Auto-dismiss toast');
      expect(toast).toBeTruthy();

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Toast should be removed from store
      expect(useToastStore.getState().toasts.length).toBe(0);

      vi.useRealTimers();
    });

    it('should not auto-dismiss when duration is 0', async () => {
      vi.useFakeTimers();

      useToastStore.getState().addToast('info', 'Persistent toast', 0);

      render(<ToastContainer />);

      const toast = screen.getByText('Persistent toast');
      expect(toast).toBeTruthy();

      // Fast-forward time significantly
      vi.advanceTimersByTime(10000);

      // Toast should still be visible
      const stillVisibleToast = screen.getByText('Persistent toast');
      expect(stillVisibleToast).toBeTruthy();

      vi.useRealTimers();
    });

    it('should handle multiple toasts with different auto-dismiss timings', async () => {
      vi.useFakeTimers();

      act(() => {
        useToastStore.getState().addToast('success', 'Short toast', 100);
        useToastStore.getState().addToast('info', 'Long toast', 500);
      });

      render(<ToastContainer />);

      expect(screen.getByText('Short toast')).toBeTruthy();
      expect(screen.getByText('Long toast')).toBeTruthy();

      // Fast-forward by 100ms - short toast should disappear
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(useToastStore.getState().toasts.length).toBe(1);
      expect(useToastStore.getState().toasts[0].message).toBe('Long toast');

      // Fast-forward by another 400ms - long toast should disappear
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(useToastStore.getState().toasts.length).toBe(0);

      vi.useRealTimers();
    });
  });
});
