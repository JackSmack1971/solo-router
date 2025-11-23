import { create } from 'zustand';

interface StreamStore {
  currentStream: string;
  isStreaming: boolean;
  activeMessageId: string | null;
  startStream: (messageId: string) => void;
  appendToken: (token: string) => void;
  endStream: () => void;
}

export const useStreamStore = create<StreamStore>()((set) => ({
  currentStream: '',
  isStreaming: false,
  activeMessageId: null,
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
        currentStream: state.currentStream + token,
      };
    }),
  endStream: () =>
    set({
      currentStream: '',
      isStreaming: false,
      activeMessageId: null,
    }),
}));
