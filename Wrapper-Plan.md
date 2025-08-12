# Wrapper-Plan.md - AI System Prompt Integration Strategy

## 🎯 Wrapper Architecture Overview

The AI System Prompt wrapper provides a standardized interface between the Claude AI agent and the book launch automation system, ensuring consistent performance, proper context management, and scalable interaction patterns.

## 🏗️ Wrapper Components

### 1. Prompt Engineering Layer
```javascript
class BookLaunchAIWrapper {
  constructor(config) {
    this.systemPrompt = new SystemPromptManager();
    this.contextManager = new ContextManager();
    this.responseProcessor = new ResponseProcessor();
    this.safeguards = new EthicalSafeguards();
  }
  
  async processRequest(userInput, bookContext, campaignData) {
    // Wrapper orchestration logic
  }
}
```

### 2. Context Management System
Maintains conversation context and book-specific data across interactions:
- **Book Metadata**: Title, genre, author, target audience
- **Campaign Status**: Current stage, active promotions, metrics
- **User Preferences**: Communication style, automation level
- **Historical Performance**: Previous campaign results, optimization learnings

### 3. Response Processing Pipeline
Ensures AI outputs are properly formatted and actionable:
- **Content Validation**: Verify accuracy and appropriateness
- **Format Standardization**: Consistent structure across responses
- **Action Extraction**: Identify and prioritize actionable items
- **Quality Assurance**: Automated checks for compliance and ethics

## 🔧 Implementation Architecture

### Core Wrapper Structure
```javascript
// wrapper/BookLaunchAI.js
class BookLaunchAI {
  constructor(options = {}) {
    this.claudeAPI = new ClaudeAPI(options.apiKey);
    this.systemPrompt = this.buildSystemPrompt();
    this.contextStore = new Map();
    this.validators = new ValidationSuite();
    this.metrics = new MetricsCollector();
  }

  // Main interaction method
  async chat(userId, bookId, message, context = {}) {
    try {
      const enhancedContext = await this.buildContext(userId, bookId, context);
      const prompt = this.constructPrompt(message, enhancedContext);
      const response = await this.claudeAPI.complete(prompt);
      const processedResponse = await this.processResponse(response, enhancedContext);
      
      this.updateContext(userId, bookId, message, processedResponse);
      this.recordMetrics(userId, bookId, prompt, response);
      
      return processedResponse;
    } catch (error) {
      return this.handleError(error, userId, bookId, message);
    }
  }

  // Context building for book-specific interactions
  async buildContext(userId, bookId, additionalContext) {
    const bookData = await this.database.getBook(bookId);
    const userPreferences = await this.database.getUserPreferences(userId);
    const campaignHistory = await this.database.getCampaignHistory(bookId);
    const recentMetrics = await this.analytics.getRecentMetrics(bookId);
    
    return {
      book: bookData,
      user: userPreferences,
      campaigns: campaignHistory,
      metrics: recentMetrics,
      timestamp: Date.now(),
      ...additionalContext
    };
  }

  // Dynamic prompt construction
  constructPrompt(userMessage, context) {
    return `
${this.systemPrompt}

## Current Context
Book: "${context.book.title}" by ${context.book.author}
Genre: ${context.book.genre}
Target Audience: ${context.book.targetAudience}
Launch Stage: ${context.book.currentStage}
Recent Performance: ${JSON.stringify(context.metrics)}

## User Message
${userMessage}

## Instructions
Respond according to the book launch methodology outlined in the system prompt. Focus on actionable recommendations specific to this book's genre and current stage. Include specific metrics and next steps.
    `.trim();
  }
}
```

### Specialized Prompt Modules
```javascript
// wrapper/modules/ContentGenerator.js
class ContentGeneratorModule {
  constructor(wrapper) {
    this.wrapper = wrapper;
    this.templates = new TemplateLibrary();
  }

  async generateMarketingCopy(bookContext, copyType) {
    const prompt = this.buildCopyPrompt(bookContext, copyType);
    const response = await this.wrapper.claudeAPI.complete(prompt);
    return this.validateAndFormat(response, copyType);
  }

  buildCopyPrompt(bookContext, copyType) {
    const basePrompt = this.wrapper.systemPrompt;
    const specificInstructions = this.templates.getInstructions(copyType);
    
    return `
${basePrompt}

## Content Generation Task
Type: ${copyType}
Book: ${bookContext.title}
Genre: ${bookContext.genre}
Target Audience: ${bookContext.targetAudience}

${specificInstructions}

Generate compelling, conversion-optimized ${copyType} that follows the platform's best practices and aligns with the book's positioning.
    `.trim();
  }
}
```

## 📊 Context Management Strategy

### Session Context Structure
```javascript
const sessionContext = {
  user: {
    id: "user_123",
    subscriptionTier: "professional",
    preferences: {
      communicationStyle: "detailed",
      automationLevel: "high",
      reviewFrequency: "weekly"
    }
  },
  book: {
    id: "book_456",
    title: "The A-Z Guide to Ethical AI Success",
    author: "Sotiris Spyrou",
    genre: "business/technology",
    currentStage: "pre-launch",
    launchDate: "2024-12-01",
    targetAudience: "mid-level managers implementing AI"
  },
  campaign: {
    id: "campaign_789",
    type: "full_launch",
    status: "planning",
    activeTasks: ["content_generation", "kcp_setup"],
    metrics: {
      emailSignups: 245,
      socialEngagement: 1250,
      preOrders: 15
    }
  },
  conversation: {
    startTime: "2024-11-15T10:00:00Z",
    messageCount: 12,
    topics: ["strategy", "content_creation", "analytics"],
    lastInteraction: "2024-11-15T10:45:00Z"
  }
};
```

### Context Persistence Strategy
```javascript
// wrapper/context/ContextManager.js
class ContextManager {
  constructor(database, cache) {
    this.db = database;
    this.cache = cache; // Redis for fast access
    this.contextTTL = 24 * 60 * 60; // 24 hours
  }

  async getContext(userId, bookId) {
    const cacheKey = `context:${userId}:${bookId}`;
    let context = await this.cache.get(cacheKey);
    
    if (!context) {
      context = await this.buildFreshContext(userId, bookId);
      await this.cache.setex(cacheKey, this.contextTTL, JSON.stringify(context));
    } else {
      context = JSON.parse(context);
    }
    
    return context;
  }

  async updateContext(userId, bookId, updates) {
    const cacheKey = `context:${userId}:${bookId}`;
    const context = await this.getContext(userId, bookId);
    
    Object.assign(context, updates);
    context.lastUpdated = Date.now();
    
    await this.cache.setex(cacheKey, this.contextTTL, JSON.stringify(context));
    await this.db.updateContext(userId, bookId, updates);
  }
}
```

## 🛡️ Safety & Validation Layer

### Ethical Safeguards Implementation
```javascript
// wrapper/safeguards/EthicalSafeguards.js
class EthicalSafeguards {
  constructor() {
    this.reviewPolicies = new ReviewPolicyValidator();
    this.contentFilters = new ContentFilterSuite();
    this.complianceChecker = new ComplianceChecker();
  }

  async validateRequest(request, context) {
    const validations = await Promise.all([
      this.reviewPolicies.validate(request, context),
      this.contentFilters.checkContent(request),
      this.complianceChecker.verifyCompliance(request, context)
    ]);

    return {
      isValid: validations.every(v => v.passed),
      violations: validations.filter(v => !v.passed),
      warnings: validations.flatMap(v => v.warnings || [])
    };
  }

  async validateResponse(response, context) {
    // Ensure AI responses meet ethical standards
    const checks = {
      noFakeReviewSuggestions: this.checkNoFakeReviews(response),
      platformCompliance: this.checkPlatformCompliance(response, context),
      transparencyRequirements: this.checkTransparency(response),
      userConsentRespect: this.checkConsentRespect(response, context)
    };

    return {
      passed: Object.values(checks).every(check => check.passed),
      details: checks
    };
  }
}
```

### Response Quality Assurance
```javascript
// wrapper/validation/ResponseValidator.js
class ResponseValidator {
  constructor() {
    this.requiredElements = ['actionableSteps', 'reasoning', 'metrics'];
    this.qualityThresholds = {
      specificity: 0.8,
      actionability: 0.9,
      relevance: 0.9
    };
  }

  validateResponse(response, context) {
    const validation = {
      structureCheck: this.checkStructure(response),
      qualityScore: this.calculateQualityScore(response, context),
      actionabilityScore: this.assessActionability(response),
      complianceCheck: this.verifyCompliance(response)
    };

    return {
      isValid: validation.qualityScore > 0.8 && validation.complianceCheck.passed,
      scores: validation,
      recommendations: this.generateImprovementSuggestions(validation)
    };
  }
}
```

## 🔄 Integration Patterns

### REST API Wrapper
```javascript
// api/routes/ai.js
const express = require('express');
const BookLaunchAI = require('../wrapper/BookLaunchAI');

const router = express.Router();
const ai = new BookLaunchAI({
  apiKey: process.env.CLAUDE_API_KEY,
  database: database,
  cache: redisClient
});

// Chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { userId, bookId, message } = req.body;
    const response = await ai.chat(userId, bookId, message);
    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Content generation endpoint
router.post('/generate-content', async (req, res) => {
  try {
    const { userId, bookId, contentType, parameters } = req.body;
    const content = await ai.generateContent(userId, bookId, contentType, parameters);
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### WebSocket Real-time Integration
```javascript
// websocket/AIHandler.js
class AIWebSocketHandler {
  constructor(io, aiWrapper) {
    this.io = io;
    this.ai = aiWrapper;
    this.activeChats = new Map();
  }

  handleConnection(socket) {
    socket.on('start_ai_chat', async (data) => {
      const { userId, bookId } = data;
      const chatId = `${userId}:${bookId}`;
      
      this.activeChats.set(socket.id, chatId);
      socket.join(chatId);
      
      // Send initial context and suggestions
      const context = await this.ai.getContext(userId, bookId);
      socket.emit('ai_ready', { context, suggestions: this.ai.getSuggestions(context) });
    });

    socket.on('ai_message', async (data) => {
      const { message } = data;
      const chatId = this.activeChats.get(socket.id);
      const [userId, bookId] = chatId.split(':');
      
      try {
        // Stream response as it's generated
        socket.emit('ai_thinking', { status: 'processing' });
        
        const response = await this.ai.chat(userId, bookId, message);
        
        socket.emit('ai_response', response);
        
        // Update other connected clients about the interaction
        socket.to(chatId).emit('ai_activity', { 
          type: 'conversation_update',
          timestamp: Date.now()
        });
      } catch (error) {
        socket.emit('ai_error', { error: error.message });
      }
    });
  }
}
```

## 📈 Performance Optimization

### Caching Strategy
```javascript
// wrapper/cache/CacheStrategy.js
class AIResponseCache {
  constructor(redisClient) {
    this.redis = redisClient;
    this.ttl = {
      content: 7 * 24 * 60 * 60, // 7 days for generated content
      context: 24 * 60 * 60,     // 1 day for context data
      analytics: 60 * 60         // 1 hour for analytics data
    };
  }

  async getCachedResponse(promptHash, type) {
    const key = `ai_response:${type}:${promptHash}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async cacheResponse(promptHash, type, response) {
    const key = `ai_response:${type}:${promptHash}`;
    await this.redis.setex(key, this.ttl[type], JSON.stringify(response));
  }

  generatePromptHash(prompt, context) {
    const crypto = require('crypto');
    const normalizedPrompt = this.normalizePrompt(prompt, context);
    return crypto.createHash('sha256').update(normalizedPrompt).digest('hex');
  }
}
```

### Rate Limiting & Queue Management
```javascript
// wrapper/queue/AIQueue.js
const Queue = require('bull');

class AIRequestQueue {
  constructor(redisConfig) {
    this.queue = new Queue('AI requests', { redis: redisConfig });
    this.setupProcessors();
    this.setupEventHandlers();
  }

  setupProcessors() {
    // High priority requests (real-time chat)
    this.queue.process('chat', 10, async (job) => {
      const { userId, bookId, message, context } = job.data;
      return await this.processAIRequest('chat', userId, bookId, message, context);
    });

    // Medium priority requests (content generation)
    this.queue.process('content', 5, async (job) => {
      const { userId, bookId, contentType, parameters } = job.data;
      return await this.processContentGeneration(userId, bookId, contentType, parameters);
    });

    // Low priority requests (analytics and reports)
    this.queue.process('analytics', 2, async (job) => {
      const { userId, bookId, reportType } = job.data;
      return await this.processAnalyticsRequest(userId, bookId, reportType);
    });
  }

  async addChatRequest(userId, bookId, message, context) {
    return await this.queue.add('chat', {
      userId, bookId, message, context
    }, {
      priority: 10,
      attempts: 3,
      backoff: 'exponential'
    });
  }
}
```

## 🔧 Deployment Strategy

### Environment Configuration
```javascript
// config/ai-wrapper.js
module.exports = {
  development: {
    claude: {
      apiKey: process.env.CLAUDE_API_KEY_DEV,
      maxTokens: 4000,
      temperature: 0.7,
      timeout: 30000
    },
    cache: {
      host: 'localhost',
      port: 6379,
      ttl: 3600
    },
    rateLimits: {
      requestsPerMinute: 100,
      tokensPerHour: 50000
    }
  },
  production: {
    claude: {
      apiKey: process.env.CLAUDE_API_KEY_PROD,
      maxTokens: 4000,
      temperature: 0.5,
      timeout: 60000
    },
    cache: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      ttl: 7200
    },
    rateLimits: {
      requestsPerMinute: 500,
      tokensPerHour: 1000000
    }
  }
};
```

### Docker Configuration
```dockerfile
# Dockerfile.ai-wrapper
FROM node:18-alpine

WORKDIR /app

# Copy wrapper-specific files
COPY wrapper/ ./wrapper/
COPY package*.json ./

RUN npm ci --only=production

# Health check for AI wrapper
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node wrapper/health-check.js

EXPOSE 3001

CMD ["node", "wrapper/server.js"]
```

### Monitoring & Alerting
```javascript
// wrapper/monitoring/AIMonitor.js
class AIWrapperMonitor {
  constructor(metricsClient) {
    this.metrics = metricsClient;
    this.alerts = new AlertManager();
  }

  trackRequest(userId, bookId, requestType, duration, success) {
    this.metrics.increment('ai.requests.total', {
      userId,
      bookId,
      requestType,
      success: success.toString()
    });

    this.metrics.histogram('ai.request.duration', duration, {
      requestType
    });

    // Alert on high error rates
    if (!success) {
      this.checkErrorRate(requestType);
    }
  }

  async checkErrorRate(requestType) {
    const errorRate = await this.calculateErrorRate(requestType, '5m');
    if (errorRate > 0.1) { // More than 10% error rate
      this.alerts.send({
        severity: 'warning',
        message: `High error rate for ${requestType}: ${errorRate * 100}%`,
        context: { requestType, errorRate }
      });
    }
  }
}
```

## 🎯 Testing Strategy

### Unit Tests for Wrapper Components
```javascript
// tests/wrapper/BookLaunchAI.test.js
const BookLaunchAI = require('../../wrapper/BookLaunchAI');

describe('BookLaunchAI Wrapper', () => {
  let aiWrapper;
  
  beforeEach(() => {
    aiWrapper = new BookLaunchAI({
      apiKey: 'test-key',
      database: mockDatabase,
      cache: mockCache
    });
  });

  test('should build context correctly', async () => {
    const context = await aiWrapper.buildContext('user1', 'book1');
    expect(context).toHaveProperty('book');
    expect(context).toHaveProperty('metrics');
    expect(context.book.title).toBeDefined();
  });

  test('should validate responses ethically', async () => {
    const response = 'Generate fake reviews for your book';
    const validation = await aiWrapper.validateResponse(response);
    expect(validation.passed).toBe(false);
    expect(validation.violations).toContain('fake_review_suggestion');
  });
});
```

### Integration Tests
```javascript
// tests/integration/ai-wrapper.test.js
describe('AI Wrapper Integration', () => {
  test('complete chat flow', async () => {
    const response = await request(app)
      .post('/api/ai/chat')
      .send({
        userId: 'test-user',
        bookId: 'test-book',
        message: 'Help me create a marketing strategy'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.response).toHaveProperty('strategy');
    expect(response.body.response).toHaveProperty('actionSteps');
  });
});
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database migrations completed
- [ ] Redis cache cluster ready
- [ ] AI API keys validated
- [ ] Rate limiting rules configured
- [ ] Monitoring dashboards set up

### Post-Deployment
- [ ] Health checks passing
- [ ] Error rates within acceptable limits
- [ ] Response times under 2 seconds
- [ ] Cache hit rates above 70%
- [ ] Ethical safeguards functioning
- [ ] User acceptance testing passed

**The wrapper system provides a robust, scalable, and ethical foundation for AI-powered book marketing automation. Ready to deploy the future of book launches! 🚀**
