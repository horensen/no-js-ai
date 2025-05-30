const mongoose = require('mongoose');

// MongoDB Schema for Chat
const chatSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  systemPrompt: {
    type: String,
    default: '',
    maxlength: 2000  // Reasonable limit for system prompts
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