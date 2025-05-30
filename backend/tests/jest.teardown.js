// jest.teardown.js
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }
};