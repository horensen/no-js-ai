const {
  sendThinkingEvent,
  sendStartEvent,
  sendTokenEvent,
  sendCompleteEvent,
  sendErrorEventAndEnd,
  sendThinkingSequence,
  handleStreamingResponse
} = require('../../src/utils/streaming');

// Mock dependencies
jest.mock('../../src/utils/response');
const { sendSSEEvent } = require('../../src/utils/response');

describe('Streaming Utils', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      end: jest.fn()
    };
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('sendThinkingEvent', () => {
    test('should send thinking event with default message', () => {
      sendThinkingEvent(mockRes);

      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'thinking', {
        type: 'thinking',
        message: 'Processing your request...'
      });
    });

    test('should send thinking event with custom message', () => {
      sendThinkingEvent(mockRes, 'Custom thinking message');

      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'thinking', {
        type: 'thinking',
        message: 'Custom thinking message'
      });
    });
  });

  describe('sendStartEvent', () => {
    test('should send start event', () => {
      sendStartEvent(mockRes);

      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'start', { type: 'start' });
    });
  });

  describe('sendTokenEvent', () => {
    test('should send token event with content', () => {
      sendTokenEvent(mockRes, 'Hello');

      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'token', { type: 'token', content: 'Hello' });
    });
  });

  describe('sendCompleteEvent', () => {
    test('should send complete event with full response', () => {
      sendCompleteEvent(mockRes, 'Full response text');

      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'complete', {
        type: 'complete',
        fullResponse: 'Full response text'
      });
    });
  });

  describe('sendErrorEventAndEnd', () => {
    test('should send error event and end response with default message', () => {
      sendErrorEventAndEnd(mockRes);

      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'error', {
        type: 'error',
        message: 'An error occurred'
      });
      expect(mockRes.end).toHaveBeenCalled();
    });

    test('should send error event and end response with custom message', () => {
      sendErrorEventAndEnd(mockRes, 'Custom error message');

      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'error', {
        type: 'error',
        message: 'Custom error message'
      });
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('sendThinkingSequence', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should send default thinking sequence', async () => {
      const promise = sendThinkingSequence(mockRes);

      // Fast forward all timers
      jest.runAllTimers();
      await promise;

      // Should send both default messages
      expect(sendSSEEvent).toHaveBeenCalledTimes(2);
      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'thinking', {
        type: 'thinking',
        message: 'Analyzing your question...'
      });
      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'thinking', {
        type: 'thinking',
        message: 'Formulating response...'
      });
    });

    test('should send custom thinking sequence', async () => {
      const customMessages = ['Step 1', 'Step 2', 'Step 3'];
      const customDelays = [0, 100, 200];

      const promise = sendThinkingSequence(mockRes, customMessages, customDelays);

      // Advance timers for each delay step by step
      await jest.advanceTimersByTimeAsync(0); // First message (delay: 0)
      await jest.advanceTimersByTimeAsync(100); // Second message (delay: 100)
      await jest.advanceTimersByTimeAsync(200); // Third message (delay: 200)

      await promise;

      // Should send each custom message
      expect(sendSSEEvent).toHaveBeenCalledTimes(3);
      expect(sendSSEEvent).toHaveBeenNthCalledWith(1, mockRes, 'thinking', {
        type: 'thinking',
        message: 'Step 1'
      });
      expect(sendSSEEvent).toHaveBeenNthCalledWith(2, mockRes, 'thinking', {
        type: 'thinking',
        message: 'Step 2'
      });
      expect(sendSSEEvent).toHaveBeenNthCalledWith(3, mockRes, 'thinking', {
        type: 'thinking',
        message: 'Step 3'
      });
    });

    test('should handle empty thinking sequence', async () => {
      const promise = sendThinkingSequence(mockRes, []);

      jest.runAllTimers();
      await promise;

      expect(sendSSEEvent).not.toHaveBeenCalled();
    });
  });

  describe('handleStreamingResponse', () => {
    test('should handle successful streaming response', async () => {
      const mockStreamingFunction = jest.fn(async (onToken) => {
        onToken('Hello');
        onToken(' ');
        onToken('world');
      });

      const onComplete = jest.fn();
      const onError = jest.fn();

      await handleStreamingResponse(mockRes, mockStreamingFunction, onComplete, onError);

      expect(mockStreamingFunction).toHaveBeenCalled();
      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'token', { type: 'token', content: 'Hello' });
      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'token', { type: 'token', content: ' ' });
      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'token', { type: 'token', content: 'world' });
      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'complete', {
        type: 'complete',
        fullResponse: 'Hello world'
      });
      expect(onComplete).toHaveBeenCalledWith('Hello world');
      expect(onError).not.toHaveBeenCalled();
      expect(mockRes.end).toHaveBeenCalled();
    });

    test('should handle streaming error', async () => {
      const error = new Error('Streaming failed');
      const mockStreamingFunction = jest.fn().mockRejectedValue(error);

      const onComplete = jest.fn();
      const onError = jest.fn();
      console.error = jest.fn(); // Mock console.error

      await handleStreamingResponse(mockRes, mockStreamingFunction, onComplete, onError);

      expect(mockStreamingFunction).toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(error);
      expect(console.error).toHaveBeenCalledWith('Streaming error:', error);
      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'error', {
        type: 'error',
        message: 'An error occurred while generating the response'
      });
      expect(mockRes.end).toHaveBeenCalled();
    });

    test('should work without optional callbacks', async () => {
      const mockStreamingFunction = jest.fn(async (onToken) => {
        onToken('test');
      });

      await handleStreamingResponse(mockRes, mockStreamingFunction);

      expect(mockStreamingFunction).toHaveBeenCalled();
      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'complete', {
        type: 'complete',
        fullResponse: 'test'
      });
      expect(mockRes.end).toHaveBeenCalled();
    });

    test('should handle error without error callback', async () => {
      const error = new Error('Streaming failed');
      const mockStreamingFunction = jest.fn().mockRejectedValue(error);
      console.error = jest.fn(); // Mock console.error

      await handleStreamingResponse(mockRes, mockStreamingFunction);

      expect(console.error).toHaveBeenCalledWith('Streaming error:', error);
      expect(sendSSEEvent).toHaveBeenCalledWith(mockRes, 'error', {
        type: 'error',
        message: 'An error occurred while generating the response'
      });
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
});