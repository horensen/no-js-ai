const chatService = require('../../src/services/chatService');

// Mock dependencies
jest.mock('../../src/models/Chat');
jest.mock('crypto');

const Chat = require('../../src/models/Chat');
const crypto = require('crypto');

describe('Chat Service', () => {
  let mockChat;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup crypto mock
    crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from('mockrandomdata'));

    // Setup mockChat
    mockChat = {
      sessionId: 'test-session',
      messages: [
        { role: 'user', content: 'Hello', timestamp: new Date() },
        { role: 'assistant', content: 'Hi there!', timestamp: new Date() }
      ],
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
      save: jest.fn().mockResolvedValue(this)
    };

    // Default Chat mocks
    Chat.findOne = jest.fn();
    Chat.find = jest.fn();
    Chat.deleteOne = jest.fn();
    Chat.deleteMany = jest.fn();
    Chat.prototype.save = jest.fn().mockResolvedValue(this);
    Chat.mockImplementation(() => mockChat);
  });

  describe('generateSessionId', () => {
    test('should generate a session ID', () => {
      const sessionId = chatService.generateSessionId();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    test('should generate unique session IDs', () => {
      const id1 = chatService.generateSessionId();
      const id2 = chatService.generateSessionId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('getOrCreateChatSession', () => {
    test('should return existing chat session', async () => {
      Chat.findOne.mockResolvedValue(mockChat);

      const result = await chatService.getOrCreateChatSession('test-session');

      expect(Chat.findOne).toHaveBeenCalledWith({ sessionId: 'test-session' });
      expect(result).toBe(mockChat);
    });

    test('should create new chat session if not found', async () => {
      const expectedSession = {
        sessionId: 'new-session',
        systemPrompt: '',
        messages: []
      };

      Chat.findOne.mockResolvedValue(null);

      // Create a mock chat instance that behaves like the real one
      const mockChatInstance = {
        sessionId: 'new-session',
        systemPrompt: '',
        messages: [],
        save: jest.fn().mockResolvedValue()
      };

      Chat.mockImplementation(() => mockChatInstance);

      const result = await chatService.getOrCreateChatSession('new-session');

      expect(Chat.findOne).toHaveBeenCalledWith({ sessionId: 'new-session' });
      expect(Chat).toHaveBeenCalledWith({
        sessionId: 'new-session',
        systemPrompt: '',
        messages: []
      });
      expect(mockChatInstance.save).toHaveBeenCalled();
      expect(result).toBe(mockChatInstance);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database error');
      Chat.findOne.mockRejectedValue(error);

      await expect(chatService.getOrCreateChatSession('test-session'))
        .rejects.toThrow('Database error');
    });
  });

  describe('getChatHistory', () => {
    test('should return messages for existing session', async () => {
      Chat.findOne.mockResolvedValue(mockChat);

      const result = await chatService.getChatHistory('test-session');

      expect(Chat.findOne).toHaveBeenCalledWith({ sessionId: 'test-session' });
      expect(result).toBe(mockChat.messages);
    });

    test('should return empty array for non-existent session', async () => {
      Chat.findOne.mockResolvedValue(null);

      const result = await chatService.getChatHistory('non-existent');

      expect(result).toEqual([]);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database error');
      Chat.findOne.mockRejectedValue(error);

      await expect(chatService.getChatHistory('test-session'))
        .rejects.toThrow('Database error');
    });
  });

  describe('getAllChatSessions', () => {
    test('should return formatted sessions', async () => {
      const mockSessions = [
        {
          sessionId: 'session1',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi!' }
          ],
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01')
        },
        {
          sessionId: 'session2',
          messages: [
            { role: 'user', content: 'Test' }
          ],
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02')
        }
      ];

      Chat.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(mockSessions)
        })
      });

      const result = await chatService.getAllChatSessions();

      expect(Chat.find).toHaveBeenCalledWith({});
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        sessionId: 'session1',
        messageCount: 2,
        messages: mockSessions[0].messages,
        lastMessage: { role: 'assistant', content: 'Hi!' }
      });
    });

    test('should handle empty sessions', async () => {
      Chat.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue([])
        })
      });

      const result = await chatService.getAllChatSessions();

      expect(result).toEqual([]);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database error');
      Chat.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockRejectedValue(error)
        })
      });

      await expect(chatService.getAllChatSessions())
        .rejects.toThrow('Database error');
    });
  });

  describe('deleteChatSession', () => {
    test('should delete existing session', async () => {
      Chat.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await chatService.deleteChatSession('test-session');

      expect(Chat.deleteOne).toHaveBeenCalledWith({ sessionId: 'test-session' });
      expect(result).toBe(true);
    });

    test('should return false for non-existent session', async () => {
      Chat.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const result = await chatService.deleteChatSession('non-existent');

      expect(result).toBe(false);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database error');
      Chat.deleteOne.mockRejectedValue(error);

      await expect(chatService.deleteChatSession('test-session'))
        .rejects.toThrow('Database error');
    });
  });

  describe('addMessageToSession', () => {
    test('should add message to existing session', async () => {
      // Create a fresh mock for this test
      const freshMockChat = {
        sessionId: 'test-session',
        messages: [
          { role: 'user', content: 'Hello', timestamp: new Date() }
        ],
        save: jest.fn().mockResolvedValue()
      };

      Chat.findOne.mockResolvedValue(freshMockChat);

      const result = await chatService.addMessageToSession('test-session', 'user', 'New message');

      expect(Chat.findOne).toHaveBeenCalledWith({ sessionId: 'test-session' });
      expect(freshMockChat.messages).toHaveLength(2);
      expect(freshMockChat.messages[1]).toMatchObject({
        role: 'user',
        content: 'New message',
        timestamp: expect.any(Date)
      });
      expect(freshMockChat.save).toHaveBeenCalled();
      expect(result).toBe(freshMockChat);
    });

    test('should trim message content', async () => {
      const freshMockChat = {
        sessionId: 'test-session',
        messages: [],
        save: jest.fn().mockResolvedValue()
      };

      Chat.findOne.mockResolvedValue(freshMockChat);

      await chatService.addMessageToSession('test-session', 'user', '  Trimmed message  ');

      expect(freshMockChat.messages[0].content).toBe('Trimmed message');
    });

    test('should handle database errors', async () => {
      const error = new Error('Database error');
      Chat.findOne.mockRejectedValue(error);

      await expect(chatService.addMessageToSession('test-session', 'user', 'message'))
        .rejects.toThrow('Database error');
    });
  });

  describe('clearChatSession', () => {
    test('should clear messages from session', async () => {
      const freshMockChat = {
        sessionId: 'test-session',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' }
        ],
        updatedAt: new Date('2023-01-01'),
        save: jest.fn().mockResolvedValue()
      };

      Chat.findOne.mockResolvedValue(freshMockChat);

      const result = await chatService.clearChatSession('test-session');

      expect(Chat.findOne).toHaveBeenCalledWith({ sessionId: 'test-session' });
      expect(freshMockChat.messages).toEqual([]);
      expect(freshMockChat.updatedAt).toBeInstanceOf(Date);
      expect(freshMockChat.save).toHaveBeenCalled();
      expect(result).toBe(freshMockChat);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database error');
      Chat.findOne.mockRejectedValue(error);

      await expect(chatService.clearChatSession('test-session'))
        .rejects.toThrow('Database error');
    });
  });

  describe('getSessionStats', () => {
    test('should return stats for existing session', async () => {
      const mockChatWithStats = {
        sessionId: 'test-session',
        systemPrompt: '',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' }
        ],
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      };
      Chat.findOne.mockResolvedValue(mockChatWithStats);

      const result = await chatService.getSessionStats('test-session');

      expect(Chat.findOne).toHaveBeenCalledWith({ sessionId: 'test-session' });
      expect(result).toEqual({
        sessionId: 'test-session',
        systemPrompt: '',
        totalMessages: 3,
        userMessages: 2,
        assistantMessages: 1,
        totalCharacters: 26, // 'Hello' (5) + 'Hi there!' (9) + 'How are you?' (12) = 26
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      });
    });

    test('should return null for non-existent session', async () => {
      Chat.findOne.mockResolvedValue(null);

      const result = await chatService.getSessionStats('non-existent');

      expect(result).toBeNull();
    });

    test('should handle database errors', async () => {
      const error = new Error('Database error');
      Chat.findOne.mockRejectedValue(error);

      await expect(chatService.getSessionStats('test-session'))
        .rejects.toThrow('Database error');
    });
  });

  describe('cleanupOldSessions', () => {
    test('should cleanup old sessions with default days', async () => {
      Chat.deleteMany.mockResolvedValue({ deletedCount: 5 });

      const result = await chatService.cleanupOldSessions();

      expect(Chat.deleteMany).toHaveBeenCalledWith({
        updatedAt: { $lt: expect.any(Date) }
      });
      expect(result).toBe(5);
    });

    test('should cleanup old sessions with custom days', async () => {
      Chat.deleteMany.mockResolvedValue({ deletedCount: 3 });

      const result = await chatService.cleanupOldSessions(7);

      expect(Chat.deleteMany).toHaveBeenCalledWith({
        updatedAt: { $lt: expect.any(Date) }
      });
      expect(result).toBe(3);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database error');
      Chat.deleteMany.mockRejectedValue(error);

      await expect(chatService.cleanupOldSessions())
        .rejects.toThrow('Database error');
    });
  });
});