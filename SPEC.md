
---

## Artifact 4 — `SPEC.md` (spec aligned to SoloRouter PRD)

```markdown
# SoloRouter Chat – Specification Document (Aligned with PRD v2.0.0)

```yaml
title: "SoloRouter Chat – Local-First OpenRouter Client"
version: "1.0.0"
authors: ["Specification-Authorship Agent", "Bret (Context Engineer)"]
stakeholders: ["Solo User", "Frontend Developer"]
date_created: "2025-11-18"
last_modified: "2025-11-18"
status: "draft"
scope: "single-user, frontend-only, local-first"
requires:
  - "modern_browser_environment"
  - "openrouter_api_key (user-supplied)"
provides:
  - "chat_interface_ui"
  - "local_conversation_persistence"
  - "streaming_response_handler"
1. Intent & Success Criteria
1.1 Intent

Implement the PRD (“SoloRouter Chat”) as a small, self-contained project:

Single-page React app (Vite) that runs locally.

Single user, no auth, no backend.

Local-only data with optional calls to OpenRouter.

The specification adds just enough detail to make the PRD implementable without expanding the scope into a full SaaS platform.

1.2 Definition of Success

We consider the project successful when:

A new user can:

Clone repo, run pnpm install && pnpm dev, and chat with a model in < 15 minutes.

The app supports, at minimum:

FR-001 Streaming responses

FR-002 Local conversation persistence

FR-003 Safe markdown rendering + code highlighting

FR-004 Model selection & basic tuning

Conversations remain across browser restarts.

There are no obvious security issues like XSS from model output.

The codebase is small enough that a single dev can understand the core flows in < 1 day.

2. Constraints & Non-Goals
2.1 Hard Constraints

No backend services.

No Node/Express, Python/FastAPI, or serverless functions.

All network calls go directly from the browser to:

OpenRouter (https://openrouter.ai/api/v1) or

A future local HTTP endpoint.

Single-user only.

No concept of accounts, organizations, or roles.

Local storage.

Conversations + settings: localStorage

API key: sessionStorage only.

2.2 Explicit Non-Goals

These are out of scope for this spec:

Multi-user support, teams, RBAC.

Admin dashboards, cost analytics, billing.

File uploads (images/PDFs) in v1.

RAG, vector databases, plugin systems.

Heavy DevOps / CI/CD beyond simple checks.

3. Architecture Overview
3.1 High-Level Diagram

User
  ↓
Browser (React SPA, Vite)
  ↙               ↘
localStorage       OpenRouter API (optional)
(sessionStorage)   /chat/completions, /models

Everything runs in the user’s browser. The only external dependency is the configured model endpoint.

3.2 Main Components

Chat interface

Message list

Input area

“Stop” + “Send” actions

Sidebar

Conversation list (create, rename, delete)

Settings / Model picker

API key input

Model selection

Temperature, max tokens, system prompt

Persistence layer

Save/load conversations + settings from localStorage

OpenRouter service

Streaming chat completion

Model list fetch

4. Functional Requirements (Detailed)

This section expands PRD FR-001–FR-004 with more specific behavior.

4.1 FR-001 – Real-Time Streaming Response Display

Priority: Critical

Description
When the user sends a message, the assistant’s reply should stream in token-by-token (or chunk-by-chunk) using OpenRouter’s streaming mode.

User Flow

User types a message in the input and presses Enter / clicks “Send”.

UI shows a “Generating…” indicator and an in-progress assistant bubble.

As chunks arrive, text is appended in-place.

User can click “Stop” to cancel streaming via AbortController.

When done:

The response is marked as complete.

Token usage (if available) is stored on the message metadata.

Acceptance Criteria

First characters appear in the UI in ≤ 1s for a typical request.

Stopping generation:

Cancels further chunks.

Keeps the partial response visible (not rolled back).

Errors:

If the stream fails mid-way, the partial content is preserved.

A small inline error tag appears with a hint (e.g., “Network error. Try again.”).

4.2 FR-002 – Local Conversation Persistence

Priority: Critical

Description
All conversations and settings are stored locally, so the user can close and reopen the app without losing history.

Behavior

Conversations

Each has id, title, messages, timestamps, and model/settings snapshot.

The active conversation is indicated in the sidebar.

Persistence

On any change (new message, rename, delete), data is saved to localStorage, debounced.

On startup, conversations are loaded.

If load fails (e.g., corrupted JSON), the app:

Clears broken data.

Shows a one-time warning banner.

Limits

Reasonable soft limit (e.g., warn if > X conversations or estimated size > Y MB).

Acceptance Criteria

Refreshing the page does not lose existing conversations.

Creating, renaming, deleting conversations updates both UI and stored data.

Corrupted localStorage data does not crash the app.

4.3 FR-003 – Markdown Rendering & Code Highlighting (Safe)

Priority: High

Description
Assistant messages are rendered as GitHub-style markdown with syntax-highlighted code blocks, while preventing XSS.

Behavior

Render:

Headings, lists, emphasis, links, blockquotes, code blocks, tables.

Code blocks:

Show language label (if provided).

Provide a small “Copy” button.

Sanitization:

All HTML from markdown is passed through DOMPurify.

No script execution, no inline event handlers.

Acceptance Criteria

Markdown examples render correctly.

Code blocks are highlighted.

Malicious content (e.g. <script>alert(1)</script>) is displayed as safe text, not executed.

4.4 FR-004 – Model Selection & Basic Configuration

Priority: High

Description
The user can choose a model and tweak a small set of generation parameters.

Behavior

On settings screen / panel:

A dropdown shows available models.

From /models when API key is valid.

From a static fallback list otherwise.

Each model entry shows:

A readable name

A short hint (quality/cost)

User can adjust:

Temperature

Max tokens

Default system prompt (optional)

Settings are:

Stored in localStorage

Applied to new requests

Per-conversation or global (implementation choice, but documented)

Acceptance Criteria

Choosing a model updates the next request’s payload.

Refreshing the page keeps the last-used model and settings.

Errors fetching model list fall back gracefully (static list + warning).

5. Extended Features (Not Required for First Release)

The following match PRD “nice-to-have” items and can be implemented after FR-001–FR-004:

FR-005 – Message actions: Copy / Regenerate / Edit & resend

FR-006 – Export/import conversations as JSON files

FR-007 – Theme toggle (light/dark) with persistence

FR-008 – Mobile responsive layout

FR-009 – Keyboard shortcuts

FR-010 – Simple settings panel (already covered as part of FR-004)

These should be added in small increments and must not introduce backend dependencies.

6. Non-Functional Requirements
6.1 Performance

Targets (for a typical laptop and modern browser):

Initial load: under ~2 seconds (dev), ~1.5 seconds (prod).

UI interactions (switch conversation, open settings): feel instant.

Streaming rendering: no visible stutter from re-rendering entire history on each chunk.

6.2 Security

All dynamic HTML goes through a single sanitized markdown pipeline.

No API keys stored outside of sessionStorage.

No external logging of conversation content or keys.

6.3 Quality & Testing

Testing is encouraged, not dogmatically enforced:

Aim for:

~60% overall coverage

~80% on critical paths:

streaming

persistence

markdown + sanitization

OpenRouter client

Manual smoke tests for:

sending/streaming messages

switching conversations

invalid / missing API key

corrupted storage

7. Component-Level Specification

This section sketches the main React components and their responsibilities.

7.1 <App />

Bootstraps:

theme

stores

initial load from storage

Layout:

<Sidebar /> (conversations)

<ChatPanel /> (messages + input)

<SettingsModal /> (optional overlay)

7.2 <Sidebar />

Shows conversations list.

Actions:

create conversation

rename conversation

delete conversation

select active conversation

Uses Zustand store actions:

createConversation()

setActiveConversation(id)

renameConversation(id, title)

deleteConversation(id)

7.3 <ChatPanel />

Displays:

<MessageList />

<ChatInput />

Handles:

sending messages

streaming responses via services/openRouterClient

stop generation (AbortController)

Updates:

active conversation messages

streaming state (isGenerating)

7.4 <MessageList />

Renders messages for the active conversation.

Uses virtual scrolling when messages exceed a threshold (e.g. 100).

7.5 <SettingsModal />

Inputs:

API key

model selection

temperature, max tokens, system prompt

Persists:

settings to localStorage

API key to sessionStorage

8. Data Models
8.1 Conversation & Message

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  tokenCount?: number;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model: string;
  settings: {
    temperature: number;
    maxTokens: number;
    systemPrompt: string | null;
  };
  metadata?: {
    totalTokens?: number;
    totalCost?: number;
    messageCount: number;
  };
}

8.2 Settings

export interface GlobalSettings {
  theme: 'light' | 'dark' | 'system';
  defaultModel: string | null;
  temperature: number;
  maxTokens: number;
  systemPrompt: string | null;
}

9. Roadmap Alignment

This spec maps directly onto the PRD roadmap:

Phase 1 – Usable Core (Weeks 1–2)

Implement non-streaming request → simple chat UI

Add basic state store + one conversation

Add API key entry

Phase 2 – Streaming & Persistence (Weeks 3–4)

Implement FR-001 (streaming)

Implement FR-002 (multi-conversation + persistence)

Wire up sidebar

Phase 3 – Polish (Weeks 5–6+)

Implement FR-003 (markdown + code highlighting)

Implement FR-004 (model selection + settings)

Add error states & optional theme toggle

10. Implementation Notes & Pitfalls
10.1 Common Pitfalls

Re-rendering the entire conversation on each stream chunk → fix by only updating the in-progress message.

Storing the API key in localStorage → must be sessionStorage.

Forgetting to sanitize markdown → XSS risk.

Over-complicating state with many nested contexts instead of a small Zustand store.

10.2 Guidelines

When in doubt, choose the simpler version of a feature.

Favor incremental improvements over big rewrites.

Keep the code shaped around the PRD’s small scope.

This document is intentionally minimal and focused. If a decision seems to conflict with the PRD, the PRD wins and this spec should be updated to match it.