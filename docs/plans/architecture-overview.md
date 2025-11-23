# Architecture Overview: SoloRouter

## 1. High-Level Design
**SoloRouter** is a local-first, privacy-focused Single Page Application (SPA) for LLM chat. It connects directly to OpenRouter API from the client browser, ensuring no chat data passes through a middleman server.

*   **Type:** Client-side SPA (Vite + React)
*   **Data Persistence:** `localStorage` (via Zustand persistence)
*   **API Communication:** Direct client-to-API (OpenRouter)

## 2. Core Components

### State Management (`src/store/`)
*   **`chatStore.ts`**: The central brain. Handles:
    *   Conversation list management (CRUD).
    *   Message history.
    *   Streaming logic (OpenRouter API integration).
    *   Persistence (debounced saving to `localStorage`).
*   **`toastStore.ts`**: UI notifications.

### UI Components (`src/components/`)
*   **`ChatInterface.tsx`**: The main container. Orchestrates the message list and input area.
*   **`MessageList.tsx`**: Renders the chat history. Likely virtualized for performance.
*   **`ConversationSettingsModal.tsx`**: Per-conversation settings (model selection, system prompt).
*   **`SettingsModal.tsx`**: Global application settings (API keys, theme).

### Services (`src/services/`)
*   **`openRouter.ts`**: Handles the actual HTTP/Streaming requests to OpenRouter.

## 3. Key Patterns & Standards

### Component Pattern
*   **Functional Components:** All components are `React.FC` with typed props.
*   **Named Exports:** Used consistently (e.g., `export const ChatInterface`).
*   **Hooks:** Logic is extracted into custom hooks or Zustand stores.

### Styling
*   **Tailwind CSS:** Utility-first styling.
*   **Dark Mode:** Supported via `dark:` variants.
*   **Responsive:** Mobile-first approach.

### Type Safety
*   **Strict Mode:** Enabled.
*   **Interfaces:** Defined in `src/types/` (assumed) or co-located.
*   **No `any`:** Strict avoidance of `any` type.

## 4. Data Flow
1.  **User Input:** User types in `ChatInterface`.
2.  **Store Action:** `sendMessage` action is dispatched to `chatStore`.
3.  **Optimistic UI:** User message added immediately.
4.  **API Call:** `chatStore` calls `openRouter` service.
5.  **Streaming:** Response chunks update the store state in real-time.
6.  **Persistence:** Store changes are debounced and saved to `localStorage`.

## 5. Security & Privacy
*   **API Keys:** Stored in `localStorage` (user's browser only).
*   **Chat History:** Stored in `localStorage`.
*   **No Backend:** No server-side database or logging.
