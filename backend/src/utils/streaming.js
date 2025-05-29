/**
 * Server-Sent Events (SSE) streaming utilities for real-time AI responses
 */

const { sendSSEEvent } = require('./response');
const { STREAMING_CONFIG } = require('./constants');
const logger = require('./logger');

/**
 * Send a thinking event to client
 * @param {object} res - Express response object
 * @param {string} message - Thinking message to display
 */
function sendThinkingEvent(res, message = 'Processing your request...') {
  sendSSEEvent(res, 'thinking', {
    type: 'thinking',
    message
  });
}

/**
 * Send start event to client
 * @param {object} res - Express response object
 */
function sendStartEvent(res) {
  sendSSEEvent(res, 'start', { type: 'start' });
}

/**
 * Send token event to client
 * @param {object} res - Express response object
 * @param {string} content - Token content
 */
function sendTokenEvent(res, content) {
  sendSSEEvent(res, 'token', {
    type: 'token',
    content
  });
}

/**
 * Send completion event to client
 * @param {object} res - Express response object
 * @param {string} fullResponse - Complete AI response
 */
function sendCompleteEvent(res, fullResponse) {
  sendSSEEvent(res, 'complete', {
    type: 'complete',
    fullResponse
  });
}

/**
 * Send error event and end response
 * @param {object} res - Express response object
 * @param {string} errorMessage - Error message to send
 */
function sendErrorEventAndEnd(res, errorMessage = 'An error occurred') {
  sendSSEEvent(res, 'error', {
    type: 'error',
    message: errorMessage
  });
  res.end();
}

/**
 * Send progressive thinking sequence to enhance user experience
 * @param {object} res - Express response object
 * @param {Array} thinkingSequence - Array of thinking messages
 * @param {Array} delays - Array of delays between messages
 */
async function sendThinkingSequence(res, thinkingSequence = ['Analyzing your question...', 'Formulating response...'], delays = [500, 1000]) {
  for (let i = 0; i < thinkingSequence.length; i++) {
    sendThinkingEvent(res, thinkingSequence[i]);
    if (i < thinkingSequence.length - 1) {
      const delay = delays[i] !== undefined ? delays[i] : STREAMING_CONFIG.THINKING_DELAY;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Handle streaming response from AI service
 * @param {object} res - Express response object
 * @param {Function} streamingFunction - Function that handles the streaming (receives onToken callback)
 * @param {Function} onComplete - Callback when streaming is complete
 * @param {Function} onError - Callback when an error occurs
 */
async function handleStreamingResponse(res, streamingFunction, onComplete = null, onError = null) {
  try {
    let fullResponse = '';

    // Set up token handler
    const onToken = (token) => {
      fullResponse += token;
      sendTokenEvent(res, token);
    };

    // Execute streaming function
    const result = await streamingFunction(onToken);

    // Send completion event
    sendCompleteEvent(res, fullResponse || result);

    // Call completion callback if provided
    if (onComplete) {
      await onComplete(fullResponse || result);
    }

  } catch (error) {
    console.error('Streaming error:', error);

    if (onError) {
      onError(error);
    }

    sendErrorEventAndEnd(res, 'An error occurred while generating the response');
  } finally {
    res.end();
  }
}

module.exports = {
  sendThinkingEvent,
  sendStartEvent,
  sendTokenEvent,
  sendCompleteEvent,
  sendErrorEventAndEnd,
  sendThinkingSequence,
  handleStreamingResponse
};