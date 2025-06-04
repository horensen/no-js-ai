const mongoose = require('mongoose');
const { DEFAULT_MODEL } = require('../utils/constants');

// MongoDB Schema for Chat
const chatSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  systemPrompt: {
    type: String,
    default: '',
    maxlength: 2000  // Reasonable limit for system prompts
  },
  selectedModel: {
    type: String,
    default: DEFAULT_MODEL,
    required: true
  },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;