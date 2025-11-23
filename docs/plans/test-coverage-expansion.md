# Implementation Plan: Test Coverage Expansion

## Goal
Implement comprehensive unit and component tests for `ConversationSettingsModal` and `CrashFallback` to address the 0% coverage gap.

## Proposed Changes

### 1. `src/components/__tests__/ConversationSettingsModal.test.tsx`
#### [NEW] Create Test File
- **Setup:**
    - Mock `useChatStore` to control `settings` and `updateSettings`.
    - Render `ConversationSettingsModal` with `isOpen={true}`.
- **Test Cases:**
    - `should render all setting inputs correctly`: Verify existence of System Prompt, Model, Temperature, etc.
    - `should update settings on input change`: Fire `change` events and assert store updates (or local state if applicable).
    - `should call onSave when save button is clicked`: Verify `onSave` prop execution.
    - `should call onClose when cancel button is clicked`: Verify `onClose` prop execution.
    - `should reset to defaults`: Click "Reset" and verify default values are restored.

### 2. `src/components/__tests__/CrashFallback.test.tsx`
#### [NEW] Create Test File
- **Setup:**
    - Mock `window.location.reload`.
    - Mock `useChatStore`'s `clearAllData`.
- **Test Cases:**
    - `should render error message`: Verify the error prop is displayed.
    - `should reload page on reload button click`: Click "Reload Page" and assert `window.location.reload`.
    - `should clear data and reload on hard reset`: Click "Clear Data" and assert `clearAllData` + `reload`.

## Verification Plan

### Automated Tests
Run the new test files:
```bash
npx vitest run src/components/__tests__/ConversationSettingsModal.test.tsx src/components/__tests__/CrashFallback.test.tsx
```

### Coverage Check
Run full coverage to verify improvement:
```bash
npm run test:coverage
```
