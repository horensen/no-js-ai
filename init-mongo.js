// MongoDB initialization script for no-js-ai-chat
// This script runs when the MongoDB container starts for the first time

print('Starting MongoDB initialization...');

// Switch to the application database
db = db.getSiblingDB('no-js-ai-chat');

// Create collections with validation
db.createCollection('chats', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['sessionId', 'messages', 'createdAt', 'updatedAt'],
      properties: {
        sessionId: {
          bsonType: 'string',
          description: 'Session ID must be a string and is required'
        },
        messages: {
          bsonType: 'array',
          description: 'Messages must be an array',
          items: {
            bsonType: 'object',
            required: ['role', 'content', 'timestamp'],
            properties: {
              role: {
                enum: ['user', 'assistant'],
                description: 'Role must be either user or assistant'
              },
              content: {
                bsonType: 'string',
                description: 'Content must be a string'
              },
              timestamp: {
                bsonType: 'date',
                description: 'Timestamp must be a date'
              }
            }
          }
        },
        createdAt: {
          bsonType: 'date',
          description: 'Created at must be a date'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Updated at must be a date'
        }
      }
    }
  }
});

// Create indexes for performance
db.chats.createIndex({ sessionId: 1 }, { unique: true });
db.chats.createIndex({ createdAt: 1 });
db.chats.createIndex({ updatedAt: 1 });
db.chats.createIndex({ 'messages.timestamp': 1 });

// Create a TTL index to automatically delete old chats after 30 days
db.chats.createIndex(
  { updatedAt: 1 },
  { expireAfterSeconds: 2592000 } // 30 days in seconds
);

// Insert a sample document for testing
db.chats.insertOne({
  sessionId: 'sample-session-123',
  messages: [
    {
      role: 'user',
      content: 'Hello, this is a test message!',
      timestamp: new Date()
    },
    {
      role: 'assistant',
      content: 'Hello! This is a sample response from the AI assistant. This chat application works without JavaScript for maximum security.',
      timestamp: new Date()
    }
  ],
  createdAt: new Date(),
  updatedAt: new Date()
});

print('MongoDB initialization completed successfully!');
print('Database: no-js-ai-chat created without authentication');
print('Collection: chats created with validation and indexes');
print('Sample data inserted for testing');