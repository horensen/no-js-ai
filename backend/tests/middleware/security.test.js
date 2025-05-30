const request = require('supertest');
const express = require('express');
const { commonSecurityHeaders } = require('../../src/middleware/security');

describe('Security Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(commonSecurityHeaders);

    // Add a test route
    app.get('/test', (req, res) => {
      res.json({ message: 'success' });
    });
  });

  describe('Security Headers', () => {
    it('should set X-Content-Type-Options header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should set X-XSS-Protection header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should set Referrer-Policy header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should set Content-Security-Policy header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('Security Functionality', () => {
    it('should allow normal requests to pass through', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body).toEqual({ message: 'success' });
    });

    it('should work with POST requests', async () => {
      app.post('/test-post', (req, res) => {
        res.json({ method: 'POST' });
      });

      const response = await request(app)
        .post('/test-post')
        .expect(200);

      expect(response.body).toEqual({ method: 'POST' });
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should work with different HTTP methods', async () => {
      app.put('/test-put', (req, res) => {
        res.json({ method: 'PUT' });
      });

      const response = await request(app)
        .put('/test-put')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('Error Handling', () => {
    it('should maintain security headers even when errors occur', async () => {
      app.get('/error', (req, res) => {
        throw new Error('Test error');
      });

      app.use((err, req, res, next) => {
        res.status(500).json({ error: 'Internal error' });
      });

      const response = await request(app)
        .get('/error')
        .expect(500);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });
});