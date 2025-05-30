const mongoose = require('mongoose');
const Chat = require('../../src/models/Chat');

describe('Chat Model', () => {
  beforeEach(async () => {
    // Clear any existing data
    await Chat.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create a valid chat session', async () => {
      const chatData = {
        sessionId: 'test123456789',
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?',
            timestamp: new Date()
          },
          {
            role: 'assistant',
            content: 'I am doing well, thank you!',
            timestamp: new Date()
          }
        ]
      };

      const chat = new Chat(chatData);
      const savedChat = await chat.save();

      expect(savedChat._id).toBeDefined();
      expect(savedChat.sessionId).toBe(chatData.sessionId);
      expect(savedChat.messages).toHaveLength(2);
      expect(savedChat.createdAt).toBeDefined();
      expect(savedChat.updatedAt).toBeDefined();
    });

    it('should require sessionId', async () => {
      const chatData = {
        messages: [
          {
            role: 'user',
            content: 'Hello',
            timestamp: new Date()
          }
        ]
      };

      const chat = new Chat(chatData);
      await expect(chat.save()).rejects.toThrow(/sessionId/);
    });

    it('should validate message role enum', async () => {
      const chatData = {
        sessionId: 'test123456789',
        messages: [
          {
            role: 'invalid_role',
            content: 'Hello',
            timestamp: new Date()
          }
        ]
      };

      const chat = new Chat(chatData);
      await expect(chat.save()).rejects.toThrow();
    });

    it('should require message content', async () => {
      const chatData = {
        sessionId: 'test123456789',
        messages: [
          {
            role: 'user',
            timestamp: new Date()
          }
        ]
      };

      const chat = new Chat(chatData);
      await expect(chat.save()).rejects.toThrow(/content/);
    });

    it('should auto-generate timestamp if not provided', async () => {
      const chatData = {
        sessionId: 'test123456789',
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ]
      };

      const chat = new Chat(chatData);
      const savedChat = await chat.save();

      expect(savedChat.messages[0].timestamp).toBeDefined();
      expect(savedChat.messages[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Database Operations', () => {
    it('should find chat by sessionId', async () => {
      const sessionId = 'findtest123456';
      const chat = new Chat({
        sessionId,
        messages: [
          {
            role: 'user',
            content: 'Test message',
            timestamp: new Date()
          }
        ]
      });
      await chat.save();

      const foundChat = await Chat.findOne({ sessionId });
      expect(foundChat).toBeTruthy();
      expect(foundChat.sessionId).toBe(sessionId);
    });

    it('should update existing chat with new messages', async () => {
      const sessionId = 'updatetest123456';
      const chat = new Chat({
        sessionId,
        messages: [
          {
            role: 'user',
            content: 'First message',
            timestamp: new Date()
          }
        ]
      });
      await chat.save();

      // Add new message
      chat.messages.push({
        role: 'assistant',
        content: 'Response message',
        timestamp: new Date()
      });
      const updatedChat = await chat.save();

      expect(updatedChat.messages).toHaveLength(2);
      expect(updatedChat.messages[1].content).toBe('Response message');
    });

    it('should delete chat session', async () => {
      const sessionId = 'deletetest123456';
      const chat = new Chat({
        sessionId,
        messages: [
          {
            role: 'user',
            content: 'To be deleted',
            timestamp: new Date()
          }
        ]
      });
      await chat.save();

      await Chat.deleteOne({ sessionId });
      const deletedChat = await Chat.findOne({ sessionId });
      expect(deletedChat).toBeNull();
    });

    it('should handle multiple chats with different sessionIds', async () => {
      const chat1 = new Chat({
        sessionId: 'session1',
        messages: [{ role: 'user', content: 'Message 1', timestamp: new Date() }]
      });
      const chat2 = new Chat({
        sessionId: 'session2',
        messages: [{ role: 'user', content: 'Message 2', timestamp: new Date() }]
      });

      await Promise.all([chat1.save(), chat2.save()]);

      const allChats = await Chat.find({});
      expect(allChats).toHaveLength(2);

      const sessionIds = allChats.map(chat => chat.sessionId);
      expect(sessionIds).toContain('session1');
      expect(sessionIds).toContain('session2');
    });
  });

  describe('Message Handling', () => {
    it('should maintain message order', async () => {
      const sessionId = 'ordertest123456';
      const messages = [
        { role: 'user', content: 'First', timestamp: new Date('2023-01-01') },
        { role: 'assistant', content: 'Second', timestamp: new Date('2023-01-02') },
        { role: 'user', content: 'Third', timestamp: new Date('2023-01-03') }
      ];

      const chat = new Chat({ sessionId, messages });
      const savedChat = await chat.save();

      expect(savedChat.messages[0].content).toBe('First');
      expect(savedChat.messages[1].content).toBe('Second');
      expect(savedChat.messages[2].content).toBe('Third');
    });

    it('should handle empty messages array', async () => {
      const sessionId = 'emptytest123456';
      const chat = new Chat({ sessionId, messages: [] });
      const savedChat = await chat.save();

      expect(savedChat.messages).toHaveLength(0);
    });

    it('should handle large message content', async () => {
      const sessionId = 'largetest123456';
      const largeContent = 'A'.repeat(10000); // 10KB message

      const chat = new Chat({
        sessionId,
        messages: [
          {
            role: 'user',
            content: largeContent,
            timestamp: new Date()
          }
        ]
      });

      const savedChat = await chat.save();
      expect(savedChat.messages[0].content).toBe(largeContent);
      expect(savedChat.messages[0].content).toHaveLength(10000);
    });

    it('should handle special characters in content', async () => {
      const sessionId = 'specialtest123456';
      const specialContent = '🚀 Hello! @#$%^&*()_+ <script>alert("test")</script> 中文';

      const chat = new Chat({
        sessionId,
        messages: [
          {
            role: 'user',
            content: specialContent,
            timestamp: new Date()
          }
        ]
      });

      const savedChat = await chat.save();
      expect(savedChat.messages[0].content).toBe(specialContent);
    });
  });

  describe('Indexing and Performance', () => {
    it('should efficiently query by sessionId', async () => {
      const startTime = Date.now();

      // Create multiple sessions
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          new Chat({
            sessionId: `session${i}`,
            messages: [{ role: 'user', content: `Message ${i}`, timestamp: new Date() }]
          }).save()
        );
      }
      await Promise.all(promises);

      // Query specific session
      const result = await Chat.findOne({ sessionId: 'session50' });
      const endTime = Date.now();

      expect(result).toBeTruthy();
      expect(result.sessionId).toBe('session50');
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent writes', async () => {
      const sessionId = 'concurrent123456';

      // Create initial chat
      const chat = new Chat({
        sessionId,
        messages: [{ role: 'user', content: 'Initial', timestamp: new Date() }]
      });
      await chat.save();

      // Simulate concurrent updates
      const updates = [];
      for (let i = 0; i < 5; i++) {
        updates.push(
          Chat.findOneAndUpdate(
            { sessionId },
            { $push: { messages: { role: 'assistant', content: `Response ${i}`, timestamp: new Date() } } },
            { new: true }
          )
        );
      }

      const results = await Promise.all(updates);
      const finalChat = await Chat.findOne({ sessionId });

      expect(finalChat.messages.length).toBeGreaterThan(1);
    });
  });
});