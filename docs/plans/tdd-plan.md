# TDD Implementation Plan: Fix Failing Tests

## Goal
Fix the 8 failing tests in `src/utils/__tests__/storage.test.ts` and `src/__tests__/integration/storageRaceCondition.test.ts` to achieve 100% pass rate.

## Analysis of Failures

### 1. `src/utils/__tests__/storage.test.ts`
*   **Test:** `should reject malformed JSON in import file`
*   **Error:** `SyntaxError: Expected property name or '}' in JSON` (logged) but test expectation `rejects.toThrow()` failed (or behavior mismatch).
*   **Root Cause:** The `importData` function catches `JSON.parse` errors and rejects with a new Error. The test might be failing because of how the error is propagated or the test runner's interpretation.
*   **Fix:** Verify `importData` error propagation and update test expectation to match the specific error message if needed.

### 2. `src/__tests__/integration/storageRaceCondition.test.ts`
*   **Test:** `should track lastSaved timestamp correctly`
*   **Error:** `AssertionError: expected 1763930534249 to be null`
*   **Root Cause:** `useChatStore` is a singleton. `clearAllData` resets most state but **misses** `lastSaved`. Thus, `lastSaved` persists between tests.
*   **Fix:** Update `clearAllData` in `src/store/chatStore.ts` to reset `lastSaved: null`.

*   **Test:** `should handle stress test of storage with large dataset`
*   **Error:** `AssertionError: expected 'Conv 4' to contain 'Conv 0'`
*   **Root Cause:** The test assumes `loadConversations` returns items in the order they were created (append). However, `createConversation` **prepends** new conversations to the array.
*   **Fix:** Update the test expectation to account for reverse order (LIFO) or find conversations by ID.

## Proposed Changes

### `src/store/chatStore.ts`
#### [MODIFY] `clearAllData`
- Add `lastSaved: null` to the state reset object.

### `src/utils/__tests__/storage.test.ts`
#### [MODIFY] `should reject malformed JSON in import file`
- Ensure the test correctly awaits the rejection and checks for the Error.

### `src/__tests__/integration/storageRaceCondition.test.ts`
#### [MODIFY] `should handle stress test of storage with large dataset`
- Update the verification loop to expect `Conv 4` at index 0, `Conv 3` at index 1, etc., OR sort by title before checking.

## Verification Plan

### Automated Tests
Run the specific failing test files:
```bash
npx vitest run src/utils/__tests__/storage.test.ts src/__tests__/integration/storageRaceCondition.test.ts
```

Then run the full suite with coverage:
```bash
npm run test:coverage
```
