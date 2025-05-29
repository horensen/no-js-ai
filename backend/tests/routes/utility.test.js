const request = require('supertest');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const utilityRoutes = require('../../src/routes/utility');

describe('Utility Routes', () => {
  let app;

  beforeEach(() => {
    app = express();

    // Setup middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());

    // Mock the render function instead of setting up view engine
    app.use((req, res, next) => {
      const originalRender = res.render;
      res.render = jest.fn((template, data) => {
        res.status(200).send(`Rendered ${template} with data: ${JSON.stringify(data)}`);
      });
      next();
    });

    app.use('/', utilityRoutes);
  });

  describe('GET /debug', () => {
    test('should return debug information', async () => {
      const response = await request(app).get('/debug');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Rendered debug');
    });

    test('should include theme information', async () => {
      const response = await request(app)
        .get('/debug')
        .set('Cookie', 'theme=dark');

      expect(response.status).toBe(200);
      expect(response.text).toContain('dark');
    });
  });

  describe('POST /toggle-theme', () => {
    test('should toggle theme from light to dark', async () => {
      const response = await request(app)
        .post('/toggle-theme')
        .set('Cookie', 'theme=light');

      expect(response.status).toBe(302);
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('theme=dark');
    });

    test('should toggle theme from dark to light', async () => {
      const response = await request(app)
        .post('/toggle-theme')
        .set('Cookie', 'theme=dark');

      expect(response.status).toBe(302);
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('theme=light');
    });

    test('should default to dark when no theme cookie present', async () => {
      const response = await request(app)
        .post('/toggle-theme');

      expect(response.status).toBe(302);
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('theme=dark');
    });

    test('should redirect to default URL when no returnUrl provided', async () => {
      const response = await request(app)
        .post('/toggle-theme');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });

    test('should redirect to provided returnUrl', async () => {
      const response = await request(app)
        .post('/toggle-theme')
        .send({ returnUrl: '/custom-page' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/custom-page');
    });
  });
});