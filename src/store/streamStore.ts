// Vanilla Zustand store for streaming state (hook-free for direct subscriptions)
// Intended for lightweight subscriptions outside React hooks to minimize render overhead
import { createStore } from 'zustand/vanilla';

export interface StreamActions {
  startStream: (messageId: string) => void;
  appendToken: (token: string) => void;
  endStream: () => void;
}

export interface StreamState {
  currentStream: string;
  isStreaming: boolean;
  activeMessageId: string | null;
  streamActions: StreamActions;
}

export const streamStore = createStore<StreamState>((set) => ({
  currentStream: '',
  isStreaming: false,
  activeMessageId: null,
  streamActions: {
    startStream: (messageId: string) =>
      set({
        currentStream: '',
        isStreaming: true,
        activeMessageId: messageId,
      }),
    appendToken: (token: string) =>
      set((state) => {
        if (!state.isStreaming || !state.activeMessageId) {
          return state;
        }

        return {
          ...state,
          currentStream: `${state.currentStream}${token}`,
        };
      }),
    endStream: () =>
      set({
        currentStream: '',
        isStreaming: false,
        activeMessageId: null,
      }),
  },
}));
