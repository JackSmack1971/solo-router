# Project Context: solo-router

## 1. High-Level Overview
**Goal:** A local-first, privacy-focused, client-only SPA for LLM chat.
**Core Constraint:** NO backend server. All data persists in `localStorage` / `IndexedDB`.
**Key Feature:** API Key management (OpenRouter) must be ephemeral or strictly client-side encrypted.

## 2. Tech Stack (Verified by @tech-researcher)
* **Runtime:** Node.js (Development), Browser (Production)
* **Framework:** React 19.2.0 (Vite 7.2.4)
* **Language:** TypeScript ~5.9.3 (Strict Mode)
* **State:** Zustand 5.0.8 (Persisted to localStorage)
* **Styling:** Tailwind CSS 3.4.18 (Mobile-first, Dark mode)
* **Testing:** Vitest 2.1.8, React Testing Library
* **Icons:** Lucide React

## 3. Current Workflow Status
* **Active Phase:** Active Development
* **Current Focus:** Feature Implementation & Optimization
* **Blocking Issues:** None.

## 4. Active Documentation Links
* **Architecture Overview:** [docs/plans/architecture-overview.md](docs/plans/architecture-overview.md)

## 5. Recent Change Log
* [2025-11-23] **System**: Initial codebase scan and agent onboarding.
* [2025-11-23] **System**: Created initial blank context for existing codebase onboarding.

## 6. Next Steps / Backlog
* [ ] Run @tech-researcher to scan `package.json` and directory structure.
* [ ] Populate Section 2 (Tech Stack) with exact versions found.
* [ ] Create `docs/plans/architecture-overview.md`.
