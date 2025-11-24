import { beforeEach, describe, expect, it } from 'vitest';
import { streamStore } from '../streamStore';

const defaultActions = streamStore.getState().streamActions;

const resetStore = () => {
  streamStore.setState({
    currentStream: '',
    isStreaming: false,
    activeMessageId: null,
    streamActions: defaultActions,
  });
};

describe('streamStore vanilla store', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should expose the default state on initialization', () => {
    const state = streamStore.getState();

    expect(state.currentStream).toBe('');
    expect(state.isStreaming).toBe(false);
    expect(state.activeMessageId).toBeNull();
  });

  it('startStream should enable streaming, set activeMessageId, and clear currentStream', () => {
    const { streamActions } = streamStore.getState();

    streamActions.appendToken('stale');
    streamActions.startStream('message-123');

    const state = streamStore.getState();

    expect(state.isStreaming).toBe(true);
    expect(state.activeMessageId).toBe('message-123');
    expect(state.currentStream).toBe('');
  });

  it('appendToken should concatenate tokens only while streaming', () => {
    const { streamActions } = streamStore.getState();

    streamActions.startStream('streaming');
    streamActions.appendToken('Hello');
    streamActions.appendToken(' ');
    streamActions.appendToken('world');

    expect(streamStore.getState().currentStream).toBe('Hello world');

    // When not streaming, tokens should not be appended
    streamStore.setState((state) => ({
      ...state,
      isStreaming: false,
      activeMessageId: null,
    }));

    streamActions.appendToken('!');

    expect(streamStore.getState().currentStream).toBe('Hello world');
  });

  it('endStream should stop streaming and clear activeMessageId while preserving content until the next start', () => {
    const { streamActions } = streamStore.getState();

    streamActions.startStream('message-abc');
    streamActions.appendToken('Final content');
    streamActions.endStream();

    let state = streamStore.getState();

    expect(state.isStreaming).toBe(false);
    expect(state.activeMessageId).toBeNull();
    expect(state.currentStream).toBe('Final content');

    streamActions.startStream('message-next');
    state = streamStore.getState();

    expect(state.currentStream).toBe('');
  });
});
