import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from '../chatStore';
import * as openRouterModule from '../../services/openRouter';
import type { StreamParams } from '../../types';

const mockStreamActions = {
  startStream: vi.fn(),
  appendToken: vi.fn(),
  endStream: vi.fn(),
};

const mockStreamState = {
  currentStream: '',
  isStreaming: false,
  activeMessageId: null as string | null,
  streamActions: mockStreamActions,
};

vi.mock('../streamStore', () => ({
  streamStore: {
    getState: vi.fn(() => mockStreamState),
    setState: vi.fn(),
    subscribe: vi.fn(),
    destroy: vi.fn(),
  },
}));

vi.mock('../../services/openRouter', () => ({
  defaultProvider: {
    streamChat: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
  },
}));

describe('ChatStore integration with streamStore', () => {
  let hook: RenderHookResult<ReturnType<typeof useChatStore>, undefined>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStreamState.currentStream = '';
    mockStreamState.isStreaming = false;
    mockStreamState.activeMessageId = null;
    localStorage.clear();
    sessionStorage.clear();

    hook = renderHook<ReturnType<typeof useChatStore>, undefined>(() => useChatStore());
    act(() => {
      hook.result.current.clearAllData();
    });
  });

  it('should append streamed tokens via stream actions when receiving chunks', async () => {
    const streamChatMock = vi.mocked(openRouterModule.defaultProvider.streamChat);

    streamChatMock.mockImplementation(async (params: StreamParams) => {
      params.onChunk('Hello');
      params.onDone();
    });

    act(() => {
      hook.result.current.createConversation('Test Conversation');
    });

    await act(async () => {
      await hook.result.current.sendMessage('Hi there');
    });

    expect(mockStreamActions.appendToken).toHaveBeenCalledWith('Hello');
  });
});
