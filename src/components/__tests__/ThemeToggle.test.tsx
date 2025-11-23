/**
 * Tests for ThemeToggle component (AT-009)
 * Tests toggle logic and theme switching
 * Based on CODING_STANDARDS.md Section 5.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../ThemeToggle';

// Mock useTheme hook
vi.mock('../../hooks/useTheme', () => ({
  useTheme: vi.fn(),
}));

import { useTheme } from '../../hooks/useTheme';

describe('ThemeToggle Component (AT-009)', () => {
  const mockToggleTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.className = '';
  });

  describe('Theme Toggle Behavior (AT-009)', () => {
    it('should render with sun icon when theme is dark', () => {
      vi.mocked(useTheme).mockReturnValue({
        theme: 'dark',
        effectiveTheme: 'dark',
        toggleTheme: mockToggleTheme,
      });

      const { container } = render(<ThemeToggle />);

      // Should show sun icon for switching to light mode
      const button = screen.getByRole('button', { name: /Switch to light mode/ });
      expect(button).toBeTruthy();

      // Check that icon is present (Sun icon)
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('should render with moon icon when theme is light', () => {
      vi.mocked(useTheme).mockReturnValue({
        theme: 'light',
        effectiveTheme: 'light',
        toggleTheme: mockToggleTheme,
      });

      const { container } = render(<ThemeToggle />);

      // Should show moon icon for switching to dark mode
      const button = screen.getByRole('button', { name: /Switch to dark mode/ });
      expect(button).toBeTruthy();

      // Check that icon is present (Moon icon)
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('should call toggleTheme when clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useTheme).mockReturnValue({
        theme: 'light',
        effectiveTheme: 'light',
        toggleTheme: mockToggleTheme,
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button', { name: /Switch to dark mode/ });

      await user.click(button);

      expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    });

    it('should have correct accessibility attributes', () => {
      vi.mocked(useTheme).mockReturnValue({
        theme: 'light',
        effectiveTheme: 'light',
        toggleTheme: mockToggleTheme,
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button', { name: /Switch to dark mode/ });

      expect(button.getAttribute('aria-label')).toBe('Switch to dark mode');
      expect(button.getAttribute('title')).toBe('Switch to dark mode');
    });
  });
});
