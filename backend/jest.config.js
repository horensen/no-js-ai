module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/jest.setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js', // Exclude main server file
    '!**/node_modules/**'
  ],
  testTimeout: 30000,
  verbose: true,
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/'
  ],
  // Add a global teardown to clean up MongoDB InMemory Server if used
  globalTeardown: './tests/jest.teardown.js',
};