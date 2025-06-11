const chatService = require('../../src/services/chatService');
const Chat = require('../../src/models/Chat');
const logger = require('../../src/utils/logger');
const { createSessionPreview } = require('../../src/utils/session');
const { MAX_MESSAGE_LENGTH } = require('../../src/utils/constants');

// Mock dependencies
jest.mock('../../src/models/Chat');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/session');
jest.mock('../../src/utils/constants', () => ({
  MAX_MESSAGE_LENGTH: 5000
}));

describe('ChatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks(); // Restore any spies

    // Mock logger methods
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.error = jest.fn();

    // Mock createSessionPreview
    createSessionPreview.mockReturnValue('Test preview');
  });

  describe('validateSessionId', () => {
    it('should validate correct session ID', () => {
      expect(() => {
        chatService.validateSessionId('validSessionId123');
      }).not.toThrow();
    });

    it('should throw error for null/undefined session ID', () => {
      expect(() => {
        chatService.validateSessionId(null);
      }).toThrow('Session ID is required and must be a string');

      expect(() => {
        chatService.validateSessionId(undefined);
      }).toThrow('Session ID is required and must be a string');
    });

    it('should throw error for non-string session ID', () => {
      expect(() => {
        chatService.validateSessionId(123);
      }).toThrow('Session ID is required and must be a string');
    });

    it('should throw error for too short session ID', () => {
      expect(() => {
        chatService.validateSessionId('short');
      }).toThrow('Session ID must be between 10 and 50 characters');
    });

    it('should throw error for too long session ID', () => {
      const longId = 'a'.repeat(51);
      expect(() => {
        chatService.validateSessionId(longId);
      }).toThrow('Session ID must be between 10 and 50 characters');
    });

    it('should throw error for invalid characters', () => {
      expect(() => {
        chatService.validateSessionId('invalid-session-id!');
      }).toThrow('Session ID can only contain alphanumeric characters');
    });
  });

  describe('validateMessageContent', () => {
    it('should validate correct message content', () => {
      expect(() => {
        chatService.validateMessageContent('Valid message', 'user');
      }).not.toThrow();
    });

    it('should throw error for null/undefined content', () => {
      expect(() => {
        chatService.validateMessageContent(null, 'user');
      }).toThrow('Message content is required and must be a string');

      expect(() => {
        chatService.validateMessageContent(undefined, 'user');
      }).toThrow('Message content is required and must be a string');
    });

    it('should throw error for non-string content', () => {
      expect(() => {
        chatService.validateMessageContent(123, 'user');
      }).toThrow('Message content is required and must be a string');
    });

    it('should throw error for empty content', () => {
      expect(() => {
        chatService.validateMessageContent('   ', 'user');
      }).toThrow('Message content cannot be empty');
    });

    it('should throw error for content too long', () => {
      const longContent = 'a'.repeat(MAX_MESSAGE_LENGTH + 1);
      expect(() => {
        chatService.validateMessageContent(longContent, 'user');
      }).toThrow(`Message content exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`);
    });

    it('should throw error for invalid role', () => {
      expect(() => {
        chatService.validateMessageContent('Valid message', 'invalid');
      }).toThrow('Message role must be either "user" or "assistant"');
    });
  });

  describe('generateSessionId', () => {
    it('should generate a valid session ID', () => {
      const sessionId = chatService.generateSessionId();

      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(10);
      expect(sessionId.length).toBeLessThan(50);
      expect(/^[a-zA-Z0-9-]+$/.test(sessionId)).toBe(true);
    });

    it('should generate unique session IDs', () => {
      const id1 = chatService.generateSessionId();
      const id2 = chatService.generateSessionId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('getOrCreateChatSession', () => {
    it('should return existing chat session', async () => {
      const mockChat = {
        sessionId: 'existingSession123',
        messages: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'Test prompt',
        selectedModel: 'llama2',
        save: jest.fn().mockResolvedValue()
      };

      Chat.findOne.mockResolvedValue(mockChat);

      const result = await chatService.getOrCreateChatSession('existingSession123');

      expect(Chat.findOne).toHaveBeenCalledWith({ sessionId: 'existingSession123' });
      expect(result).toBe(mockChat);
      expect(logger.debug).toHaveBeenCalledWith(
        'Retrieved existing chat session: existingSession123',
        'CHAT_SERVICE'
      );
    });

    it('should create new chat session when not found', async () => {
      const mockNewChat = {
        sessionId: 'newSession123',
        messages: [],
        systemPrompt: '',
        save: jest.fn().mockResolvedValue()
      };

      Chat.findOne.mockResolvedValue(null);
      Chat.mockImplementation(() => mockNewChat);

      const result = await chatService.getOrCreateChatSession('newSession123');

      expect(Chat.findOne).toHaveBeenCalledWith({ sessionId: 'newSession123' });
      expect(mockNewChat.save).toHaveBeenCalled();
      expect(result).toBe(mockNewChat);
      expect(logger.debug).toHaveBeenCalledWith(
        'Created new chat session: newSession123 with model: undefined',
        'CHAT_SERVICE'
      );
    });

    it('should handle database errors', async () => {
      Chat.findOne.mockRejectedValue(new Error('Database error'));

      await expect(chatService.getOrCreateChatSession('testSession123'))
        .rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error getting/creating chat session',
        'CHAT_SERVICE',
        expect.any(Error)
      );
    });

    it('should validate session ID', async () => {
      await expect(chatService.getOrCreateChatSession('invalid'))
        .rejects.toThrow('Session ID must be between 10 and 50 characters');
    });
  });

  describe('getChatHistory', () => {
    it('should return chat history for existing session', async () => {
      const mockMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      Chat.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ messages: mockMessages })
        })
      });

      const result = await chatService.getChatHistory('testSession123');

      expect(Chat.findOne).toHaveBeenCalledWith({ sessionId: 'testSession123' });
      expect(result).toEqual(mockMessages);
    });

    it('should return empty array for non-existent session', async () => {
      Chat.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null)
        })
      });

      const result = await chatService.getChatHistory('testSession123');

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      Chat.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      await expect(chatService.getChatHistory('testSession123'))
        .rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error getting chat history',
        'CHAT_SERVICE',
        expect.any(Error)
      );
    });
  });

  describe('getSystemPrompt', () => {
    it('should return system prompt for existing session', async () => {
      Chat.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ systemPrompt: 'Test prompt' })
        })
      });

      const result = await chatService.getSystemPrompt('testSession123');

      expect(result).toBe('Test prompt');
    });

    it('should return empty string for session without prompt', async () => {
      Chat.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ systemPrompt: null })
        })
      });

      const result = await chatService.getSystemPrompt('testSession123');

      expect(result).toBe('');
    });

    it('should return empty string for non-existent session', async () => {
      Chat.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null)
        })
      });

      const result = await chatService.getSystemPrompt('testSession123');

      expect(result).toBe('');
    });

    it('should handle database errors', async () => {
      Chat.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      await expect(chatService.getSystemPrompt('testSession123'))
        .rejects.toThrow('Database error');
    });
  });

  describe('updateSystemPrompt', () => {
    it('should update system prompt successfully', async () => {
      const mockChat = {
        sessionId: 'testSession123',
        systemPrompt: '',
        save: jest.fn().mockResolvedValue()
      };

      // Mock getOrCreateChatSession to return our mock chat object
      Chat.findOne = jest.fn().mockResolvedValue(mockChat);

      const result = await chatService.updateSystemPrompt('testSession123', 'New prompt');

      expect(mockChat.systemPrompt).toBe('New prompt');
      expect(mockChat.save).toHaveBeenCalled();
      expect(result).toBe(mockChat);
    });

    it('should trim whitespace from system prompt', async () => {
      const mockChat = {
        sessionId: 'testSession123',
        systemPrompt: '',
        save: jest.fn().mockResolvedValue()
      };

      Chat.findOne = jest.fn().mockResolvedValue(mockChat);

      await chatService.updateSystemPrompt('testSession123', '  New prompt  ');

      expect(mockChat.systemPrompt).toBe('New prompt');
    });

    it('should handle empty system prompt', async () => {
      const mockChat = {
        sessionId: 'testSession123',
        systemPrompt: 'old prompt',
        save: jest.fn().mockResolvedValue()
      };

      Chat.findOne = jest.fn().mockResolvedValue(mockChat);

      await chatService.updateSystemPrompt('testSession123', '');

      expect(mockChat.systemPrompt).toBe('');
      expect(mockChat.save).toHaveBeenCalled();
    });

    it('should throw error for system prompt too long', async () => {
      const longPrompt = 'a'.repeat(2001);

      await expect(chatService.updateSystemPrompt('testSession123', longPrompt))
        .rejects.toThrow('System prompt too long. Maximum 2000 characters allowed.');
    });

    it('should handle database errors', async () => {
      const mockChat = {
        sessionId: 'testSession123',
        systemPrompt: '',
        save: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      Chat.findOne = jest.fn().mockResolvedValue(mockChat);

      await expect(chatService.updateSystemPrompt('testSession123', 'New prompt'))
        .rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error updating system prompt',
        'CHAT_SERVICE',
        expect.any(Error)
      );
    });
  });

  describe('getAllChatSessions', () => {
    it('should return all chat sessions with metadata', async () => {
      const mockSessions = [
        {
          sessionId: 'session1',
          messages: [{ role: 'user', content: 'Hello' }],
          systemPrompt: 'Prompt 1',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          sessionId: 'session2',
          messages: [],
          systemPrompt: '',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      Chat.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockSessions)
              })
            })
          })
        })
      });

      const result = await chatService.getAllChatSessions();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        sessionId: 'session1',
        messageCount: 1,
        preview: 'Test preview'
      });
      expect(result[1]).toMatchObject({
        sessionId: 'session2',
        messageCount: 0,
        preview: 'Test preview'
      });
    });

    it('should handle pagination parameters', async () => {
      Chat.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([])
              })
            })
          })
        })
      });

      await chatService.getAllChatSessions(50, 10);

      expect(Chat.find().sort().limit).toHaveBeenCalledWith(50);
      expect(Chat.find().sort().limit().skip).toHaveBeenCalledWith(10);
    });

    it('should validate and limit pagination parameters', async () => {
      Chat.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([])
              })
            })
          })
        })
      });

      await chatService.getAllChatSessions(200, -5);

      expect(Chat.find().sort().limit).toHaveBeenCalledWith(100); // Max limit
      expect(Chat.find().sort().limit().skip).toHaveBeenCalledWith(0); // Min skip
    });

    it('should handle database errors', async () => {
      Chat.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                lean: jest.fn().mockRejectedValue(new Error('Database error'))
              })
            })
          })
        })
      });

      await expect(chatService.getAllChatSessions())
        .rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error getting all chat sessions',
        'CHAT_SERVICE',
        expect.any(Error)
      );
    });
  });

  describe('deleteChatSession', () => {
    it('should delete existing session successfully', async () => {
      Chat.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await chatService.deleteChatSession('testSession123');

      expect(Chat.deleteOne).toHaveBeenCalledWith({ sessionId: 'testSession123' });
      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Chat session deleted: testSession123'),
        'CHAT_SERVICE'
      );
    });

    it('should return false for non-existent session', async () => {
      Chat.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const result = await chatService.deleteChatSession('testSession123');

      expect(result).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        'Chat session not found for deletion: testSession123',
        'CHAT_SERVICE'
      );
    });

    it('should handle database errors', async () => {
      Chat.deleteOne.mockRejectedValue(new Error('Database error'));

      await expect(chatService.deleteChatSession('testSession123'))
        .rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error deleting chat session',
        'CHAT_SERVICE',
        expect.any(Error)
      );
    });

    it('should validate session ID', async () => {
      await expect(chatService.deleteChatSession('invalid'))
        .rejects.toThrow('Session ID must be between 10 and 50 characters');
    });
  });

  describe('addMessageToSession', () => {
    it('should add message to session successfully', async () => {
      const mockChat = {
        sessionId: 'testSession123',
        messages: [],
        save: jest.fn().mockResolvedValue()
      };

      Chat.findOne = jest.fn().mockResolvedValue(mockChat);

      const result = await chatService.addMessageToSession('testSession123', 'user', 'Hello world');

      expect(mockChat.messages).toHaveLength(1);
      expect(mockChat.messages[0]).toMatchObject({
        role: 'user',
        content: 'Hello world'
      });
      expect(mockChat.save).toHaveBeenCalled();
      expect(result).toBe(mockChat);
    });

    it('should trim message content', async () => {
      const mockChat = {
        sessionId: 'testSession123',
        messages: [],
        save: jest.fn().mockResolvedValue()
      };

      Chat.findOne = jest.fn().mockResolvedValue(mockChat);

      await chatService.addMessageToSession('testSession123', 'user', '  Hello world  ');

      expect(mockChat.messages[0].content).toBe('Hello world');
    });

    it('should validate message content and role', async () => {
      await expect(chatService.addMessageToSession('testSession123', 'invalid', 'Hello'))
        .rejects.toThrow('Message role must be either "user" or "assistant"');

      await expect(chatService.addMessageToSession('testSession123', 'user', ''))
        .rejects.toThrow('Message content cannot be empty');
    });

    it('should handle database errors', async () => {
      const mockChat = {
        sessionId: 'testSession123',
        messages: [],
        save: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      Chat.findOne = jest.fn().mockResolvedValue(mockChat);

      await expect(chatService.addMessageToSession('testSession123', 'user', 'Hello'))
        .rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error adding message to session',
        'CHAT_SERVICE',
        expect.any(Error)
      );
    });
  });

  describe('cleanupOldSessions', () => {
    it('should cleanup old sessions successfully', async () => {
      Chat.countDocuments.mockResolvedValue(5);
      Chat.deleteMany.mockResolvedValue({ deletedCount: 5 });

      const result = await chatService.cleanupOldSessions(7);

      expect(Chat.countDocuments).toHaveBeenCalledWith({
        updatedAt: { $lt: expect.any(Date) }
      });
      expect(Chat.deleteMany).toHaveBeenCalledWith({
        updatedAt: { $lt: expect.any(Date) }
      });
      expect(result).toBe(5);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up 5 sessions older than 7 days'),
        'CHAT_SERVICE'
      );
    });

    it('should return 0 when no old sessions found', async () => {
      Chat.countDocuments.mockResolvedValue(0);

      const result = await chatService.cleanupOldSessions(7);

      expect(result).toBe(0);
      expect(Chat.deleteMany).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'No old sessions found for cleanup',
        'CHAT_SERVICE'
      );
    });

    it('should use default days when invalid input provided', async () => {
      Chat.countDocuments.mockResolvedValue(0);

      await chatService.cleanupOldSessions(-1);
      await chatService.cleanupOldSessions('invalid');

      // Should use default value of 7 days
      expect(Chat.countDocuments).toHaveBeenCalledTimes(2);
    });

    it('should handle database errors', async () => {
      Chat.countDocuments.mockRejectedValue(new Error('Database error'));

      await expect(chatService.cleanupOldSessions(7))
        .rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error cleaning up old sessions',
        'CHAT_SERVICE',
        expect.any(Error)
      );
    });
  });
});