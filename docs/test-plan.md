# Test Plan & Coverage Strategy

**Status:** Living Document
**Last Updated:** 2025-11-23

## Overview
This document outlines the strategy for achieving and maintaining high test coverage for `solo-router`. It serves as a roadmap for TDD and regression testing.

## Coverage Goals
*   **Global Target:** 80% Statement Coverage
*   **Critical Path:** 100% Coverage (Storage, API Integration, Chat Logic)
*   **UI Components:** 90% Coverage (Interactive elements)

## Current Status (as of 2025-11-23)
*   **Overall Statements:** ~68%
*   **Passing:** 363/363 tests

### Critical Gaps
| Component | Current Coverage | Priority | Notes |
| :--- | :--- | :--- | :--- |
| `ConversationSettingsModal.tsx` | 0% | High | Critical for per-chat model configuration |
| `CrashFallback.tsx` | 0% | Medium | Error boundary UI needs verification |
| `types/index.ts` | 0% | Low | Type definitions (mostly interfaces) |

## TDD Implementation Plan: Phase 2

### Goal
Add comprehensive tests for `ConversationSettingsModal` and `CrashFallback` to reach >75% overall coverage.

### 1. `ConversationSettingsModal`
**Strategy:** Component Testing with React Testing Library
**Scenarios:**
*   Renders correctly with initial settings.
*   Updates local state on input change (system prompt, temperature, etc.).
*   Calls `onSave` with updated settings when "Save" is clicked.
*   Calls `onClose` when "Cancel" or backdrop is clicked.
*   Validates inputs (e.g., temperature range 0-2).
*   Handles "Reset to Defaults" action.

### 2. `CrashFallback`
**Strategy:** Component Testing & Error Boundary Simulation
**Scenarios:**
*   Renders the error message and stack trace (in dev).
*   Provides a "Reload Page" button that triggers `window.location.reload`.
*   Provides a "Clear Data & Reload" button for hard resets.
*   Verifies `clearAllData` is called on hard reset.

## Verification
Run specific suites:
```bash
npx vitest run src/components/__tests__/ConversationSettingsModal.test.tsx src/components/__tests__/CrashFallback.test.tsx
```

Check coverage improvement:
```bash
npm run test:coverage
```
