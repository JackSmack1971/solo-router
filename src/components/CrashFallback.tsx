import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { FallbackProps } from 'react-error-boundary';

/**
 * CrashFallback Component
 *
 * Displays when the app encounters an unrecoverable error.
 * Provides options to reload or perform a factory reset.
 *
 * Factory Reset:
 * - Clears localStorage (conversations & settings)
 * - Preserves sessionStorage (API key)
 * - Reloads the app
 */
export const CrashFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  const handleReload = () => {
    resetErrorBoundary();
    window.location.reload();
  };

  const handleFactoryReset = () => {
    if (window.confirm(
      'Are you sure you want to reset the app?\n\n' +
      'This will delete all conversations and settings, but your API key will be preserved.\n\n' +
      'This action cannot be undone.'
    )) {
      // Clear localStorage only (preserves sessionStorage with API key)
      localStorage.clear();

      // Reload the app
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-4">
            <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-4">
          Something Went Wrong
        </h1>

        <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
          The application encountered an unexpected error and needs to restart.
        </p>

        {/* Error details (collapsed by default) */}
        <details className="mb-6 text-sm">
          <summary className="cursor-pointer text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-2">
            Technical Details
          </summary>
          <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-32 text-red-600 dark:text-red-400">
            {error.message}
          </pre>
        </details>

        <div className="space-y-3">
          <button
            onClick={handleReload}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Reload App
          </button>

          <button
            onClick={handleFactoryReset}
            className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Factory Reset
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-500 text-center pt-2">
            Factory Reset will delete all conversations and settings but preserve your API key.
          </p>
        </div>
      </div>
    </div>
  );
};
