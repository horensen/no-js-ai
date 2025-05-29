const { marked } = require('marked');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

// Configure marked options for better rendering
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
  headerIds: false, // Don't add IDs to headers
  sanitize: false // We'll sanitize with DOMPurify instead
});

// Create DOMPurify instance for Node.js
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Configure DOMPurify for safe HTML
const purifyConfig = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'strike', 'del', 's',
    'code', 'pre', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr', 'div', 'span'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'alt', 'src', 'class'
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
};

/**
 * Process markdown text to safe HTML
 * @param {string} text - The markdown text to process
 * @returns {string} - Safe HTML string
 */
function processMarkdown(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  try {
    // Convert markdown to HTML
    const rawHtml = marked(text);

    // Sanitize the HTML for security
    let cleanHtml;
    if (DOMPurify && typeof DOMPurify.sanitize === 'function') {
      cleanHtml = DOMPurify.sanitize(rawHtml, purifyConfig);
    } else {
      // Fallback: basic HTML escaping if DOMPurify fails
      console.warn('DOMPurify not available, using basic HTML escaping');
      cleanHtml = rawHtml
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
        .replace(/on\w+="[^"]*"/g, '');
    }

    return cleanHtml;
  } catch (error) {
    console.error('Error processing markdown:', error);
    // Return escaped text as fallback
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#39;');
  }
}

/**
 * Process an array of chat messages, converting AI responses from markdown to HTML
 * @param {Array} messages - Array of message objects with role and content
 * @returns {Array} - Array of processed messages
 */
function processMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.map((message) => {
    if (!message || typeof message !== 'object') {
      return message;
    }

    // Convert Mongoose document to plain object if needed
    const plainMessage = message.toObject ? message.toObject() : message;
    const processedMessage = { ...plainMessage };

    if (plainMessage.role === 'assistant' && plainMessage.content) {
      // AI responses: convert markdown to HTML
      processedMessage.content = processMarkdown(plainMessage.content);
    } else if (plainMessage.role === 'user' && plainMessage.content) {
      // User messages: escape HTML and convert line breaks
      processedMessage.content = plainMessage.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\n/g, '<br>');
    }

    return processedMessage;
  });
}

module.exports = {
  processMarkdown,
  processMessages
};