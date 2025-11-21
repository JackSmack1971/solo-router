
---

## Artifact 3 — `CLAUDE.md` (AI-collab guide aligned to SoloRouter)

```markdown
# CLAUDE.md – AI Collaboration Guide for SoloRouter Chat

This document tells AI assistants how to work on the **SoloRouter Chat** project.

**Last Updated:** November 2025  
**Project Status:** Active – personal, local-first app

---

## 1. Project Purpose & Constraints

### 1.1 What We’re Building

SoloRouter Chat is:

- A **single-user**, **local-first** chat UI
- A simple, hackable alternative to SaaS chat apps
- A **frontend-only** app that talks directly to OpenRouter (or a local HTTP LLM)

We are **not** building a multi-tenant service, admin console, or production SaaS. Think “nice local text editor for AI chat,” not “enterprise platform.”

### 1.2 Hard Constraints

When you make changes or generate code, respect these:

- **No backend.**  
  - No Express, FastAPI, Next.js API routes, or microservices.
  - All API calls go directly from the browser to OpenRouter (or another configured HTTP endpoint).
- **Single user only.**  
  - No accounts, orgs, roles, or invitations.
- **Local storage only.**  
  - Conversations & settings in `localStorage`
  - API key in `sessionStorage`
- **Scope:** Phase 1–3 of the PRD (FR-001–FR-004 plus small QoL features).

File uploads, RAG, plugins, multi-user, etc. are long-term ideas, not part of the current spec.

---

## 2. Tech Stack & Directory Shape

### 2.1 Tech Stack

- **Language:** TypeScript
- **UI:** React 18
- **Build:** Vite 5
- **Styling:** Tailwind CSS
- **State:** Zustand
- **Markdown:** `marked`
- **Highlighting:** `highlight.js`
- **Sanitization:** `DOMPurify`
- **Tests:** Vitest (optional but encouraged)

### 2.2 Directory Structure

You should assume something like:

```text
src/
  components/      # React components
  hooks/           # Custom hooks
  store/           # Zustand stores
  services/        # OpenRouter provider, streaming helpers
  utils/           # markdown, storage, tokens, misc
  types/           # shared interfaces
  styles/          # Tailwind config & global styles
Avoid introducing a backend/ directory or any server runtime code.

3. Architectural Principles
3.1 Keep It Small & Grokkable

A reasonably experienced dev should understand core flows in <1 day.

Prefer simple, explicit code over clever abstractions.

If you find yourself inventing a mini-framework, stop and simplify.

3.2 Data Flow

High-level:
UI (components)
  ↓
Zustand store (conversations, settings)
  ↓
services/openRouterClient.ts (fetch + streaming)
  ↓
OpenRouter API (or local HTTP endpoint)
The store owns the app state; components subscribe to small slices of it.

3.3 Provider Abstraction (Lightweight)

We keep a thin abstraction for future local LLMs, but don’t over-engineer:
export interface ChatProvider {
  listModels(): Promise<ModelSummary[]>;
  streamChat(params: StreamParams): Promise<void>;
}

For now there is a single OpenRouterProvider implementation.

4. Coding Conventions

Follow CODING_STANDARDS.md. Highlights for AI work:

Use TypeScript with explicit types.

Don’t use any unless absolutely necessary and clearly commented.

Keep files shortish and focused.

Reuse existing utils instead of duplicating logic.

4.1 React

Functional components only.

Use hooks for side effects (streaming, keyboard shortcuts).

Use useMemo / React.memo for expensive render paths (markdown).

4.2 Storage & Settings

All persistence logic should live in small utility helpers and/or the store.

Components should call store actions like saveSettings() rather than poking localStorage directly.

5. Testing & Quality (Solo-Friendly)

We want tests, but we don’t want to crush a solo dev with process.

5.1 Targets (Aspirational, Not Hard Gates)

~60% overall coverage

~80% on critical paths:

streaming code

conversation persistence

markdown + sanitization

provider client

It’s OK to merge small changes without tests, but critical flows should eventually get coverage.

5.2 When You Add Tests

Prefer unit tests for:

markdown pipeline

token estimation

storage helpers

Basic integration tests for:

streaming flow

creating/switching conversations

Do not introduce complex CI or pre-commit machinery; keep any scripts light and easy to run:

pnpm test --run
pnpm lint
pnpm type-check

6. Security (Client-Only)

Even as a personal app, we must avoid obvious foot-guns.

6.1 XSS & Markdown

All model output goes through:

marked → DOMPurify → dangerouslySetInnerHTML.

Never bypass sanitization.

Never pass raw user/model HTML straight to React.

6.2 API Key Handling

Stored only in sessionStorage.

Do not log the key.

Don’t include the key in URLs or error messages.

6.3 What You Don’t Need

No CSRF tokens

No server-side auth

No JWTs

No cookies

Just harden the client.

7. Scope & Non-Goals (Important for AI)

When proposing or writing features, check against these lists.

7.1 In-Scope (Now or Near-Term)

Streaming chat with OpenRouter (FR-001)

Local conversation persistence (FR-002)

Markdown + code highlighting (FR-003)

Model selection + basic settings (FR-004)

Small QoL:

message actions

theme toggle

keyboard shortcuts

export/import JSON

7.2 Explicit Non-Goals (Do Not Implement by Default)

Multi-user / accounts / auth flows

Organizations, teams, sharing conversations

Admin dashboards, usage analytics, billing

Dedicated backend services

File uploads and multimodal handling (until clearly greenlit)

RAG, vector DBs, plugin systems (for future experiments only)

If you suggest these, mark them clearly as future ideas, not current requirements.

8. How to Make Changes as an AI
8.1 General Rules

When the user asks you to modify code:

Read existing files first.

Work with current patterns; avoid introducing a totally new style.

Make the smallest coherent change that fulfills the request.

Explain any non-obvious design decisions briefly in comments.

8.2 Don’t Invent Infrastructure

Don’t propose “add an Express proxy” to hide the API key.

Don’t add Docker, Kubernetes, or complex CI unless explicitly requested.

Keep everything runnable with:
pnpm install
pnpm dev

8.3 Example Good Changes

Adding a simple “Stop generating” button using AbortController.

Wiring model list from /models instead of a static list.

Adding a new setting to the settingsStore and UI.

Improving markdown safety or performance.

8.4 Example Bad Changes

“Let’s build a Node backend to handle requests.”

“We should add OAuth login and user management.”

“Let’s move to Next.js for SSR.”
→ SoloRouter is intentionally a small Vite SPA.

9. Quick Reference Commands

You can safely assume:
# dev
pnpm dev

# one-off checks
pnpm lint
pnpm type-check
pnpm test --run

# production build
pnpm build

If you introduce new scripts, keep them short, understandable, and optional.

10. Summary for Agents

When you’re working on SoloRouter Chat:

Think local, single-user, no backend.

Optimize for simplicity and hackability over “enterprise-grade everything”.

Follow the PRD functional requirements FR-001–FR-004.

Keep security tight on the client side (sanitization, key storage).

Treat testing as helpful, not as a gate that blocks all progress.
