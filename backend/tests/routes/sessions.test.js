const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const sessionsRoutes = require('../../src/routes/sessions');

// Mock the chat service
jest.mock('../../src/services/chatService', () => ({
  getAllChatSessions: jest.fn(),
  deleteChatSession: jest.fn()
}));

// Mock validation utilities
jest.mock('../../src/utils/validation', () => ({
  isValidSessionId: jest.fn()
}));

const chatService = require('../../src/services/chatService');
const { isValidSessionId } = require('../../src/utils/validation');

describe('Sessions Routes', () => {
  let app;

  beforeEach(() => {
    app = express();

    // Setup middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());

    // Mock the render function
    app.use((req, res, next) => {
      res.render = jest.fn((template, data) => {
        res.status(200).send(`Rendered ${template}`);
      });
      next();
    });

    app.use('/', sessionsRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/sessions', () => {
    test('should return empty array when no sessions exist', async () => {
      chatService.getAllChatSessions.mockResolvedValue([]);

      const response = await request(app).get('/api/sessions');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: []
      });
    });

    test('should return formatted session data', async () => {
      const mockSessions = [
        {
          sessionId: 'session1',
          messages: [
            { role: 'user', content: 'Hello there' },
            { role: 'assistant', content: 'Hi! How can I help?' }
          ],
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01')
        },
        {
          sessionId: 'session2',
          messages: [
            { role: 'user', content: 'What is the weather?' }
          ],
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02')
        }
      ];
      chatService.getAllChatSessions.mockResolvedValue(mockSessions);

      const response = await request(app).get('/api/sessions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);

      // Use toMatchObject to ignore date serialization differences
      expect(response.body.data[0]).toMatchObject({
        sessionId: 'session1',
        messageCount: 2,
        messageCounts: { user: 1, assistant: 1, total: 2 },
        preview: 'Hello there',
        lastMessage: { role: 'assistant', content: 'Hi! How can I help?' }
      });
    });

    test('should handle database errors', async () => {
      chatService.getAllChatSessions.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/sessions');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to fetch sessions');
    });
  });

  describe('POST /sessions/:sessionId/delete', () => {
    test('should reject invalid session ID', async () => {
      isValidSessionId.mockReturnValue(false);

      const response = await request(app).post('/sessions/invalid-id/delete');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Rendered error');
    });

    test('should delete existing session and redirect to new session', async () => {
      isValidSessionId.mockReturnValue(true);
      chatService.deleteChatSession.mockResolvedValue(true);
      chatService.getAllChatSessions.mockResolvedValue([
        {
          sessionId: 'remaining-session',
          messages: []
        }
      ]);

      const response = await request(app).post('/sessions/valid-session-id/delete');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/?session=remaining-session');
      expect(chatService.deleteChatSession).toHaveBeenCalledWith('valid-session-id');
    });

    test('should handle non-existent session gracefully', async () => {
      isValidSessionId.mockReturnValue(true);
      chatService.deleteChatSession.mockResolvedValue(false);

      const response = await request(app).post('/sessions/non-existent/delete');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Rendered error');
    });

    test('should handle database errors during deletion', async () => {
      isValidSessionId.mockReturnValue(true);
      chatService.deleteChatSession.mockRejectedValue(new Error('Database error'));

      const response = await request(app).post('/sessions/valid-session/delete');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Rendered error');
    });

    test('should render chat page when no sessions remain after deletion', async () => {
      isValidSessionId.mockReturnValue(true);
      chatService.deleteChatSession.mockResolvedValue(true);
      chatService.getAllChatSessions.mockResolvedValue([]);

      const response = await request(app).post('/sessions/last-session/delete');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Rendered chat');
    });
  });
});