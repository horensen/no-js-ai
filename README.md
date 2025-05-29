# No-JS AI Chat - Secure AI Conversations

A secure, private AI chat application that operates without JavaScript for enhanced security.

## Overview

No-JS AI Chat is a web-based AI conversation platform designed with security as the primary concern. The application functions entirely without client-side JavaScript, eliminating common web vulnerabilities while providing a responsive chat experience through server-side rendering and polling-based updates.

## Features

### Security
- **JavaScript-free operation** - Functions with JavaScript disabled for maximum security
- **Local AI processing** - Uses local AI models via Ollama, no external API calls
- **Content Security Policy** - Strict CSP headers prevent XSS attacks
- **Input sanitization** - All user inputs are validated and sanitized
- **Private conversations** - All data remains on your server/computer

### User Experience
- **Immediate message display** - User messages appear instantly
- **Auto-refresh updates** - Polling-based system checks for AI response completion
- **Visual loading indicators** - Clear feedback during AI processing
- **Markdown rendering** - Rich formatting for AI responses including code blocks, lists, and emphasis
- **Theme support** - Complete light and dark mode implementation with persistence
- **Multiple chat sessions** - Organize conversations by topic
- **Persistent history** - Conversations saved automatically in MongoDB
- **Responsive design** - Works on desktop and mobile devices

## Architecture

### Streaming Limitations

Real token-by-token streaming requires JavaScript for fundamental technical reasons:
- Event-driven architecture needs `EventSource` or `fetch()` streams
- DOM manipulation for inserting tokens requires JavaScript APIs
- HTML is request-response based, not event-driven
- Server-push requires JavaScript event handlers

This application instead:
- Processes complete responses from Ollama
- Uses server-side markdown rendering
- Implements polling-based updates for response completion
- Provides smooth UX through loading indicators and immediate user message display

### System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    No-JS AI Chat Architecture              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    │
│  │   Browser   │◄──►│   Express    │◄──►│  MongoDB    │    │
│  │             │    │   Server     │    │             │    │
│  │ • EJS Views │    │              │    │ • Chat Data │    │
│  │ • CSS Only  │    │ • Rate Limit │    │ • Sessions  │    │
│  │ • No JS     │    │ • Validation │    │ • Messages  │    │
│  └─────────────┘    │ • Polling    │    └─────────────┘    │
│                     └──────────────┘                       │
│                              │                             │
│                              ▼                             │
│                     ┌──────────────┐                       │
│                     │    Ollama    │                       │
│                     │              │                       │
│                     │ • LLaMA 3.2  │                       │
│                     └──────────────┘                       │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ Data Flow:                                                 │
│ 1. User submits form → Express validates & stores          │
│ 2. Express calls Ollama API → Gets complete response       │
│ 3. Server processes markdown → Renders final page          │
│ 4. Client polls for completion → Shows finished response   │
│ 5. MongoDB persists → Session history maintained           │
└────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Backend

**Node.js + Express.js**
- Efficient polling-based response handling
- Comprehensive middleware ecosystem for security (Helmet, CORS, rate limiting)
- Server-side rendering eliminates JavaScript dependency
- Fast development with extensive ecosystem

**MongoDB + Mongoose**
- Flexible schema for chat messages and user sessions
- Efficient handling of large conversation histories
- Native Node.js integration with Mongoose ODM
- Scalable and replicable

**EJS Templates**
- Server-side rendering for zero JavaScript dependency
- Dynamic content generation with simple syntax
- Built-in XSS protection features
- Progressive enhancement approach

### Frontend

**Pure CSS + HTML**
- Maximum security through JavaScript elimination
- Fast loading with minimal attack surface
- Accessible by default (screen readers, keyboard navigation)
- No build process required

**Theme System**
- Complete light and dark mode support
- Cookie-based theme persistence (1-year duration)
- Server-side theme detection and rendering
- Theme toggle functionality without JavaScript
- Consistent color schemes and contrast ratios

**Meta Refresh Polling**
- Reliable response checking without JavaScript
- Works through firewalls and proxies
- Graceful degradation in all browsers
- Efficient server-side response completion detection

### AI Integration

**Ollama**
- Local AI model execution - no external data transmission
- Uses LLaMA 3.2 model for AI responses
- Complete response generation for optimal processing
- Simple model management

**Marked + DOMPurify**
- Safe markdown rendering for AI responses
- XSS protection through content sanitization
- Support for code blocks, tables, and formatting
- Server-side processing for security

## Setup Instructions

### Prerequisites

- Node.js (v16+ required, v18+ recommended)
- MongoDB (v5.0+ recommended)
- Ollama
- Git

### Docker Setup (Recommended)

1. **Clone and Setup**
```bash
git clone https://github.com/horensen/no-js-ai.git
cd no-js-ai
chmod +x docker-setup.sh
```

2. **Configure Environment**
```bash
cp docker.env.example docker.env
nano docker.env
```

Key configuration options in `docker.env`:
```bash
# Application Environment
NODE_ENV=production
PORT=3000

# MongoDB Configuration (Docker Compose)
MONGODB_URI=mongodb://mongodb:27017/no-js-ai

# MongoDB Authentication (recommended for production)
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=changeme-secure-password

# Ollama Configuration
OLLAMA_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.2

# Security Configuration
SESSION_SECRET=your-super-secret-session-key-change-this-in-production-minimum-32-chars

# Rate Limiting Configuration
RATE_LIMIT_ENABLED=true

# Message Configuration
MAX_MESSAGE_LENGTH=2000

# Streaming Configuration
STREAMING_ENABLED=true
THINKING_DELAY=1500

# Logging Configuration
LOG_LEVEL=info
```

3. **Install Ollama and Models**

**For macOS:**
```bash
# Install Ollama
brew install ollama

# Start Ollama service
ollama serve

# Download LLaMA 3.2 model (in new terminal)
ollama pull llama3.2
```

**For Windows:**
```bash
# Download and install Ollama from https://ollama.ai/
# Run the installer and follow the setup wizard

# Start Ollama (from Command Prompt or PowerShell)
ollama serve

# Download LLaMA 3.2 model (in new terminal/command prompt)
ollama pull llama3.2
```

4. **Start Application**
```bash
# Start all services
./docker-setup.sh start

# View logs
./docker-setup.sh logs

# Stop services
./docker-setup.sh stop
```

5. **Access Application**
- Main application: http://localhost:3000
- Database admin: http://localhost:8081 (with `./docker-setup.sh dev`)

### Manual Development Setup

1. **Clone and Install**
```bash
git clone https://github.com/horensen/no-js-ai.git
cd no-js-ai
cd backend
npm install
cd ..
```

2. **Setup MongoDB**
```bash
# Local MongoDB
mongod --dbpath ./data/db

# Or use MongoDB Atlas (cloud)
# Create account at mongodb.com/atlas and get connection string
```

3. **Setup Ollama**

**For macOS:**
```bash
# Install Ollama
brew install ollama

# Start service
ollama serve

# Download LLaMA 3.2 model
ollama pull llama3.2
```

**For Windows:**
```bash
# Download and install Ollama from https://ollama.ai/
# Run the installer

# Start service (from Command Prompt or PowerShell)
ollama serve

# Download LLaMA 3.2 model
ollama pull llama3.2
```

4. **Configure Environment**
```bash
cp backend/env.example backend/.env
nano backend/.env
```

Example `.env` configuration:
```bash
# Environment Configuration for No-JS AI Chat Backend

# Application Settings
NODE_ENV=development
PORT=3000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/no-js-ai

# Ollama AI Service Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Message Configuration
MAX_MESSAGE_LENGTH=2000

# Streaming Configuration
STREAMING_ENABLED=true
THINKING_DELAY=1500
```

5. **Start Development Server**
```bash
cd backend
npm run dev  # or npm start for production
```

## Local Development Guide

### Project Structure

```
no-js-ai/
├── backend/                     # Node.js backend
│   ├── src/
│   │   ├── config/             # Configuration files
│   │   │   └── database.js     # MongoDB connection
│   │   ├── middleware/         # Express middleware
│   │   │   ├── security.js     # Security middleware & rate limiting
│   │   │   └── validation.js   # Input validation
│   │   ├── models/             # MongoDB schemas
│   │   │   └── Chat.js         # Chat session schema
│   │   ├── routes/             # API routes
│   │   │   ├── chatRoutes.js   # Chat route exports
│   │   │   └── healthRoutes.js # Health check endpoints
│   │   ├── services/           # Business logic
│   │   │   ├── chatService.js  # Chat operations
│   │   │   └── ollamaService.js # AI integration
│   │   ├── utils/              # Utility functions
│   │   │   ├── constants.js    # Application constants
│   │   │   ├── logger.js       # Logging utility
│   │   │   ├── markdown.js     # Markdown processing
│   │   │   ├── response.js     # Response helpers
│   │   │   ├── session.js      # Session utilities
│   │   │   └── validation.js   # Input validation
│   │   └── server.js           # Main server file
│   ├── tests/                  # Test suites
│   │   ├── middleware/         # Middleware tests
│   │   ├── routes/             # Route tests
│   │   ├── services/           # Service tests
│   │   ├── utils/              # Utility tests
│   │   └── setup.js            # Test setup configuration
│   ├── coverage/               # Test coverage reports
│   ├── jest.config.js          # Jest configuration
│   ├── package.json            # Backend dependencies
│   └── env.example             # Environment template
├── frontend/                   # Static frontend
│   ├── public/
│   │   ├── css/               # Stylesheets
│   │   │   ├── base.css       # Base styles and reset
│   │   │   ├── chat.css       # Chat-specific styles
│   │   │   ├── components.css # UI components
│   │   │   ├── main.css       # Main CSS import file
│   │   │   ├── responsive.css # Mobile optimizations
│   │   │   ├── themes.css     # Light/dark theme styles
│   │   │   └── utilities.css  # Utility classes
│   │   └── js/                # JavaScript directory (unused)
│   └── views/                 # EJS templates
│       ├── partials/          # Reusable components
│       │   ├── head.ejs       # HTML head with theme support
│       │   ├── input-form.ejs # Message input form
│       │   ├── messages.ejs   # Message display components
│       │   └── sidebar.ejs    # Sidebar with theme toggle
│       ├── chat.ejs           # Main chat page
│       ├── debug.ejs          # Debug information page
│       └── error.ejs          # Error page template
├── .dockerignore              # Docker ignore file
├── .gitignore                 # Git ignore file
├── docker-compose.yml         # Docker configuration
├── docker-setup.sh           # Docker setup script
├── docker.env                # Docker environment variables
├── docker.env.example        # Docker environment template
├── Dockerfile                # Container definition
├── init-mongo.js             # MongoDB initialization
├── package.json              # Root package configuration
└── README.md                 # Documentation
```

### Development Workflow

**Running Tests**
```bash
cd backend
npm test                 # Run all tests
npm run test:coverage    # With coverage report
npm run test:watch       # Watch mode
npm run test:ci          # CI environment
```

**Adding Database Models**
```javascript
// Create: backend/src/models/newModel.js
const mongoose = require('mongoose');

const newSchema = new mongoose.Schema({
  field1: { type: String, required: true },
  field2: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NewModel', newSchema);
```

**Customizing Themes**
```css
/* Add custom theme overrides in themes.css */

/* Light mode customization */
body.gptv4-body-light .custom-component {
    background: #ffffff !important;
    color: #1f1f1f !important;
    border: 1px solid #e5e7eb !important;
}

/* Dark mode customization */
body.gptv4-body .custom-component {
    background: #444654 !important;
    color: #ececf1 !important;
    border: 1px solid #565869 !important;
}
```

**Adding Theme Support to New Templates**
```html
<!-- Ensure all new EJS templates include theme class -->
<body class="<%= (locals.theme === 'light') ? 'gptv4-body-light' : 'gptv4-body' %>">
  <!-- Template content -->
</body>
```