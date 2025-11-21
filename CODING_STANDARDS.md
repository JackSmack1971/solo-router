# Coding Standards – SoloRouter Chat (Local-Only OpenRouter Client)

## 0. Project Overview

SoloRouter Chat is a **simple, privacy-respecting, single-user chat UI** that:

- Runs locally (Vite dev server or static hosting)
- Talks **directly from the browser** to OpenRouter (or a local HTTP LLM)
- Stores all conversations **only in the browser** (`localStorage`)
- Stores the API key **only in `sessionStorage`**

There is **no backend service**, no database, no multi-user layer, and no file uploads in the core scope (v1).

---

## 1. Project Structure

A small, frontend-only repo that a single dev can understand in under a day:

```text
project-root/
├── src/
│   ├── components/      # Reusable UI components (chat, sidebar, settings)
│   ├── hooks/           # Custom React hooks (streaming, keyboard shortcuts)
│   ├── store/           # Zustand stores for chat + settings
│   ├── services/        # OpenRouter client + provider abstractions
│   ├── utils/           # Markdown, sanitization, storage, tokens
│   ├── types/           # Shared TypeScript types/interfaces
│   └── styles/          # Tailwind config + global styles
├── public/              # Static assets (favicon, logo)
├── tests/               # Unit/integration tests (optional but encouraged)
└── docs/                # Project docs (PRD, SPEC, etc.)

Non-Goals in Structure

❌ No backend/ directory

❌ No Express/FastAPI routes or middleware

❌ No database models or migrations

All external calls go directly from the browser to the configured API endpoint.

2. Technology Stack Standards
Frontend

Framework: React 18+ with TypeScript

Build Tool: Vite 5+ (no Next.js)

Styling: Tailwind CSS

State Management: Zustand (preferred) or simple React context

Markdown: marked

Code Highlighting: highlight.js

Security/Sanitization: DOMPurify

HTTP Client: fetch with streaming via ReadableStream

Runtime & Storage

Browser only (desktop and mobile)

localStorage:

Conversations

UI settings (theme, model, temperature, etc.)

sessionStorage:

OpenRouter API key (never localStorage)

API Provider Abstraction

The services layer should expose a minimal, provider-agnostic interface:

interface ChatProvider {
  streamChat: (params: StreamParams) => Promise<void>;
  listModels: () => Promise<ModelSummary[]>;
}

interface StreamParams {
  messages: Message[];
  model: string;
  settings: {
    temperature: number;
    maxTokens: number;
    systemPrompt?: string | null;
  };
  onChunk: (text: string) => void;
  onDone: (usage?: TokenUsage) => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
}

Initially there’s a single provider implementation for OpenRouter.

3. Code Style & Formatting
General Rules

Indentation: 2 spaces, no tabs

Line Length: 100 characters max

Quotes: Single quotes in TS/JS, double quotes in JSX

Semicolons: Required in TypeScript

Trailing Commas: Yes in multi-line lists/objects

Tools:

ESLint for linting

Prettier for formatting

TypeScript strict mode enabled

File Naming

Components: PascalCase.tsx – e.g. ChatMessage.tsx

Hooks: useSomething.ts – e.g. useStreamCompletion.ts

Utilities: camelCase.ts – e.g. renderMarkdown.ts

Types: PascalCase.ts – e.g. ChatTypes.ts

Store: chatStore.ts, settingsStore.ts

Tests: *.test.ts or *.test.tsx next to the source file

TypeScript Standards

No any in new code except in narrow, well-commented interop shims

All exported functions and components have explicit return types

Prefer interfaces to describe data shapes:

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  tokenCount?: number;
  error?: boolean;
}


4. React & State Management
Components

Only functional components + hooks.

Keep components small and single-purpose.

Prefer composition over giant “god components”.

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const html = useMemo(
    () => renderSanitizedMarkdown(message.content),
    [message.content]
  );

  return (
    <div className="mb-2 text-sm">
      <div
        className="prose prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

Zustand Stores

Each store should be small and focused:

interface ChatStore {
  conversations: Conversation[];
  activeId: string | null;

  createConversation: () => string;
  setActive: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;

  loadFromStorage: () => void;
  saveToStorage: () => void;
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: [],
  activeId: null,
  // ...
}));

Never put Window/DOM objects directly in Zustand state.

5. Storage & Persistence
Keys

export const STORAGE_KEYS = {
  CONVERSATIONS: 'solo_router_conversations_v1',
  SETTINGS: 'solo_router_settings_v1',
  // API key is ONLY in sessionStorage, not here
} as const;
Local Storage Helpers
ts
Copy code
export function saveConversations(conversations: Conversation[]): void {
  try {
    const data = JSON.stringify(conversations);
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, data);
  } catch (err) {
    console.error('Failed to save conversations', err);
  }
}

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    console.warn('Conversation data corrupted, resetting');
    return [];
  }
}
Save operations should be debounced to avoid hammering storage while typing.

API Key Management
ts
Copy code
const API_KEY_KEY = 'solo_router_openrouter_api_key';

export function saveApiKey(key: string) {
  sessionStorage.setItem(API_KEY_KEY, key);
}

export function getApiKey(): string | null {
  return sessionStorage.getItem(API_KEY_KEY);
}

export function clearApiKey() {
  sessionStorage.removeItem(API_KEY_KEY);
}
Never copy the API key into logs, URLs, or localStorage.

6. OpenRouter Integration & Streaming
Base Config
ts
Copy code
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const CHAT_COMPLETIONS_PATH = '/chat/completions';
export const MODELS_PATH = '/models';
Streaming Handler
Streaming is client → OpenRouter only; no proxy:

ts
Copy code
interface StreamOptions {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

export async function streamChatCompletion(
  messages: Message[],
  model: string,
  settings: ChatSettings,
  options: StreamOptions
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Missing OpenRouter API key');

  const response = await fetch(
    `${OPENROUTER_BASE_URL}${CHAT_COMPLETIONS_PATH}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
      }),
      signal: options.signal,
    }
  );

  if (!response.ok || !response.body) {
    throw new Error(`OpenRouter error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') {
          options.onDone();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) options.onChunk(content);
        } catch (err) {
          console.error('Streaming parse error', err);
        }
      }
    }
  } catch (err) {
    options.onError(err as Error);
  }
}
7. Security Standards (Client-Only)
HTML & Markdown
All HTML rendering must go through a single sanitization pipeline:

ts
Copy code
import DOMPurify from 'dompurify';
import { marked } from 'marked';

export function renderSanitizedMarkdown(markdown: string): string {
  const rawHtml = marked(markdown);
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'code',
      'pre',
      'a',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onclick', 'onerror', 'onload'],
  });
}
Never use dangerouslySetInnerHTML with un-sanitized content.

API Keys & Secrets
Never hardcode an API key.

Never store keys in git.

Use .env for non-secret configuration, but still prompt the user for their key at runtime.

What We Don’t Need
Because there is no backend:

❌ No CSRF tokens

❌ No Express rate limiting

❌ No cookie auth

Security focus is entirely on the client: XSS prevention and careful storage.

8. Error Handling
Use small, user-friendly error messages and never swallow errors silently.

ts
Copy code
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getHumanMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return 'Invalid or missing API key. Check your OpenRouter key.';
      case 402:
        return 'Insufficient credits on OpenRouter.';
      case 429:
        return 'You hit a rate limit. Wait a bit and try again.';
      default:
        return `Request failed (${error.status}).`;
    }
  }
  if (error instanceof Error) return error.message;
  return 'Unknown error.';
}
UI components should show a small toast or inline banner with the human message.

9. Testing Standards (Lightweight)
Testing is encouraged but not mandatory for every tiny change. The goal is to stay solo-friendly.

Targets (Non-Blocking)
Overall coverage: Aim for ~60%

Critical paths: Aim for ~80% (streaming, storage, markdown, provider client)

If you’re adding a new critical path, write at least basic tests. For small visual tweaks, tests are optional.

Example Unit Test
ts
Copy code
import { describe, it, expect } from 'vitest';
import { renderSanitizedMarkdown } from '../utils/markdown';

describe('renderSanitizedMarkdown', () => {
  it('renders markdown', () => {
    const html = renderSanitizedMarkdown('**bold**');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('strips script tags', () => {
    const html = renderSanitizedMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });
});
10. Accessibility & UX
Provide basic ARIA labels on inputs and buttons.

Input:

Ctrl+Enter / Cmd+Enter to send

Shift+Enter for newline

Focus:

Focus stays in the input after sending

Escape closes modals or settings

Example:

tsx
Copy code
<textarea
  aria-label="Chat message input"
  onKeyDown={(e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSend();
    }
  }}
/>
11. Performance Guidelines
Use virtualized list for long conversations (@tanstack/react-virtual).

Memoize expensive markdown rendering.

Debounce persistence.

Keep bundle small:

No huge dependencies

Prefer tree-shakeable imports

Example:

tsx
Copy code
export const ChatMessage = React.memo(ChatMessageInner);

function ChatMessageInner({ message }: ChatMessageProps) {
  const html = useMemo(
    () => renderSanitizedMarkdown(message.content),
    [message.content]
  );
  // ...
}
12. Explicit Non-Goals (Coding Side)
These features are out of scope or future-only and should not leak into v1 code:

❌ Backend servers (Express/FastAPI, serverless functions)

❌ Multi-user handling, auth, or roles

❌ File uploads (images/PDFs) in v1 code paths

❌ Enterprise-style CI/CD complexity

❌ Heavy, custom design systems (simple Tailwind is enough)

If you implement anything that looks like these, it should be clearly fenced off as “future experiment” and not wired into the main app flow.