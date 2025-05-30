const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const utilityRoutes = require('../../src/routes/utility');

describe('Utility Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(cookieParser());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    // Mock view engine
    app.set('view engine', 'ejs');
    app.set('views', 'views');

    // Mock render function
    app.use((req, res, next) => {
      res.render = jest.fn((view, data) => {
        res.json({ view, data });
      });
      next();
    });

    app.use('/utility', utilityRoutes);
  });

  describe('GET /debug', () => {
    it('should render debug page with light theme by default', async () => {
      const response = await request(app)
        .get('/utility/debug')
        .expect(200);

      expect(response.body.view).toBe('debug');
      expect(response.body.data.theme).toBe('light');
    });

    it('should render debug page with theme from cookie', async () => {
      const response = await request(app)
        .get('/utility/debug')
        .set('Cookie', ['theme=dark'])
        .expect(200);

      expect(response.body.view).toBe('debug');
      expect(response.body.data.theme).toBe('dark');
    });

    it('should handle missing theme cookie gracefully', async () => {
      const response = await request(app)
        .get('/utility/debug')
        .expect(200);

      expect(response.body.data.theme).toBe('light');
    });
  });

  describe('POST /toggle-theme', () => {
    it('should toggle from light to dark theme', async () => {
      const response = await request(app)
        .post('/utility/toggle-theme')
        .set('Cookie', ['theme=light'])
        .send({ returnUrl: '/test' })
        .expect(302);

      expect(response.headers.location).toBe('/test');
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('theme=dark');
    });

    it('should toggle from dark to light theme', async () => {
      const response = await request(app)
        .post('/utility/toggle-theme')
        .set('Cookie', ['theme=dark'])
        .send({ returnUrl: '/home' })
        .expect(302);

      expect(response.headers.location).toBe('/home');
      expect(response.headers['set-cookie'][0]).toContain('theme=light');
    });

    it('should default to light theme when no cookie is set', async () => {
      const response = await request(app)
        .post('/utility/toggle-theme')
        .send({ returnUrl: '/dashboard' })
        .expect(302);

      expect(response.headers.location).toBe('/dashboard');
      expect(response.headers['set-cookie'][0]).toContain('theme=dark');
    });

    it('should redirect to root when no returnUrl is provided', async () => {
      const response = await request(app)
        .post('/utility/toggle-theme')
        .expect(302);

      expect(response.headers.location).toBe('/');
    });

    it('should set secure cookie in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/utility/toggle-theme')
        .expect(302);

      expect(response.headers['set-cookie'][0]).toContain('Secure');

      process.env.NODE_ENV = originalEnv;
    });

    it('should set cookie with correct attributes', async () => {
      const response = await request(app)
        .post('/utility/toggle-theme')
        .expect(302);

      const setCookieHeader = response.headers['set-cookie'][0];
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('SameSite=Strict');
      expect(setCookieHeader).toContain('Max-Age=31536000'); // 1 year in seconds
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/utility/toggle-theme')
        .send('invalid-data')
        .expect(302);

      expect(response.headers.location).toBe('/');
    });

    it('should handle empty POST body', async () => {
      const response = await request(app)
        .post('/utility/toggle-theme')
        .expect(302);

      expect(response.headers.location).toBe('/');
    });
  });
});