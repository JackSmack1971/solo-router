/**
 * Theme management hook
 * Handles theme state and applies dark class to document
 */

import { useEffect } from 'react';
import { useChatStore } from '../store/chatStore';

/**
 * Custom hook for theme management
 * Applies theme to the HTML element based on user preference
 */
export function useTheme() {
  const theme = useChatStore((state) => state.settings.theme);
  const updateSettings = useChatStore((state) => state.updateSettings);

  useEffect(() => {
    const root = document.documentElement;

    // Remove existing theme classes
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      // Use system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemPrefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    } else {
      // Use explicit theme
      root.classList.add(theme);
    }
  }, [theme]);

  /**
   * Toggle between light and dark modes
   */
  const toggleTheme = () => {
    const currentEffectiveTheme = document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';

    const newTheme = currentEffectiveTheme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: newTheme });
  };

  /**
   * Get the current effective theme (resolves 'system' to actual theme)
   */
  const getEffectiveTheme = (): 'light' | 'dark' => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  };

  return {
    theme,
    toggleTheme,
    effectiveTheme: getEffectiveTheme(),
  };
}
