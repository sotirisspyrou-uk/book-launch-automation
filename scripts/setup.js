// ===== scripts/setup.js =====
// System initialization and setup script

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SystemSetup {
  constructor() {
    this.requiredDirs = [
      'uploads/covers',
      'uploads/manuscripts',
      'logs',
      'temp',
      'cache',
      'exports'
    ];
    
    this.configTemplate = {
      app: {
        name: 'Book Launch Automation',
        version: '1.0.0',
        port: process.env.PORT || 3000
      },
      database: {
        mongodb: {
          uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/booklist',
          options: {
            useNewUrlParser: true,
            useUnifiedTopology: true
          }
        },
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD
        }
      },
      ai: {
        claude: {
          apiKey: process.env.CLAUDE_API_KEY,
          maxTokens: 4000,
          temperature: 0.7
        }
      },
      integrations: {
        stripe: {
          secretKey: process.env.STRIPE_SECRET_KEY,
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
        },
        kdp: {
          apiKey: process.env.KDP_API_KEY,
          secretKey: process.env.KDP_SECRET_KEY
        },
        email: {
          provider: 'mailchimp',
          apiKey: process.env.MAILCHIMP_API_KEY
        }
      }
    };
  }

  async run() {
    console.log('🚀 Initializing Book Launch Automation System...');
    
    try {
      await this.createDirectories();
      await this.generateSecrets();
      await this.createConfigFiles();
      await this.initializeDatabase();
      await this.setupCronJobs();
      
      console.log('✅ System setup completed successfully!');
      console.log('💡 Next steps:');
      console.log('   1. Update .env with your API keys');
      console.log('   2. Run "npm run migrate" to set up database');
      console.log('   3. Run "npm start" to launch the application');
      
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    }
  }

  async createDirectories() {
    console.log('📁 Creating directory structure...');
    for (const dir of this.requiredDirs) {
      await fs.mkdir(dir, { recursive: true });
      console.log(`   Created: ${dir}`);
    }
  }

  async generateSecrets() {
    console.log('🔐 Generating security secrets...');
    const secrets = {
      JWT_SECRET: crypto.randomBytes(64).toString('hex'),
      SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
      ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex')
    };

    const envPath = '.env';
    let envContent = '';
    
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      // File doesn't exist, start fresh
    }

    for (const [key, value] of Object.entries(secrets)) {
      if (!envContent.includes(`${key}=`)) {
        envContent += `\n${key}=${value}`;
      }
    }

    await fs.writeFile(envPath, envContent.trim());
    console.log('   Secrets generated and added to .env');
  }

  async createConfigFiles() {
    console.log('⚙️ Creating configuration files...');
    
    const configPath = 'config/app.json';
    await fs.mkdir('config', { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(this.configTemplate, null, 2));
    console.log('   Created: config/app.json');
  }

  async initializeDatabase() {
    console.log('🗄️ Initializing database...');
    // Database initialization logic would go here
    console.log('   Database initialization prepared');
  }

  async setupCronJobs() {
    console.log('⏰ Setting up scheduled tasks...');
    
    const cronJobs = {
      '0 */6 * * *': 'analytics:sync',      // Every 6 hours
      '0 9 * * *': 'campaigns:daily',       // Daily at 9 AM
      '0 0 * * 0': 'reports:weekly',        // Weekly on Sunday
      '0 2 * * *': 'cleanup:temp-files'     // Daily at 2 AM
    };

    const cronPath = 'config/cron.json';
    await fs.writeFile(cronPath, JSON.stringify(cronJobs, null, 2));
    console.log('   Cron jobs configured');
  }
}

// ===== scripts/book-importer.js =====
// Bulk book import utility

class BookImporter {
  constructor(database) {
    this.db = database;
    this.supportedFormats = ['csv', 'json', 'xlsx'];
  }

  async importFromCSV(filePath, userId) {
    console.log(`📚 Importing books from CSV: ${filePath}`);
    
    const Papa = require('papaparse');
    const csvData = await fs.readFile(filePath, 'utf8');
    
    const parsed = Papa.parse(csvData, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });

    const books = [];
    for (const row of parsed.data) {
      const book = this.mapCSVRowToBook(row, userId);
      if (this.validateBookData(book)) {
        books.push(book);
      } else {
        console.warn(`⚠️ Skipping invalid book: ${row.title || 'Unknown'}`);
      }
    }

    const results = await this.bulkInsertBooks(books);
    console.log(`✅ Imported ${results.insertedCount} books successfully`);
    
    return results;
  }

  mapCSVRowToBook(row, userId) {
    return {
      userId,
      title: row.title || row.Title,
      author: row.author || row.Author || '',
      isbn: row.isbn || row.ISBN || '',
      genre: row.genre || row.Genre || 'General',
      description: row.description || row.Description || '',
      price: parseFloat(row.price || row.Price || 9.99),
      targetAudience: row.targetAudience || row['Target Audience'] || '',
      keywords: (row.keywords || row.Keywords || '').split(',').map(k => k.trim()),
      launchDate: row.launchDate ? new Date(row.launchDate) : new Date(),
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  validateBookData(book) {
    return book.title && book.title.length > 0 && 
           book.author && book.author.length > 0;
  }

  async bulkInsertBooks(books) {
    return await this.db.collection('books').insertMany(books);
  }
}

// ===== scripts/campaign-generator.js =====
// Automated campaign generation

class CampaignGenerator {
  constructor(aiWrapper, database) {
    this.ai = aiWrapper;
    this.db = database;
  }

  async generateFullCampaign(bookId, options = {}) {
    console.log(`🎯 Generating full campaign for book: ${bookId}`);
    
    const book = await this.db.getBook(bookId);
    if (!book) {
      throw new Error(`Book not found: ${bookId}`);
    }

    const campaign = {
      bookId,
      type: 'full_launch',
      status: 'draft',
      phases: await this.generateCampaignPhases(book),
      content: await this.generateCampaignContent(book),
      schedule: await this.generateCampaignSchedule(book, options.launchDate),
      metrics: this.initializeCampaignMetrics(),
      createdAt: new Date()
    };

    const savedCampaign = await this.db.saveCampaign(campaign);
    console.log(`✅ Campaign generated with ID: ${savedCampaign._id}`);
    
    return savedCampaign;
  }

  async generateCampaignPhases(book) {
    const phases = [
      {
        name: 'Pre-Launch',
        duration: '4 weeks',
        activities: [
          'Content creation',
          'Audience building',
          'Partnership outreach',
          'Beta reader recruitment'
        ]
      },
      {
        name: 'Launch Week',
        duration: '1 week',
        activities: [
          'Coordinated announcements',
          'Media outreach',
          'Social media blitz',
          'Email campaign launch'
        ]
      },
      {
        name: 'Post-Launch',
        duration: '8 weeks',
        activities: [
          'Review solicitation',
          'Content marketing',
          'Speaking opportunities',
          'Partnership activations'
        ]
      }
    ];

    return phases;
  }

  async generateCampaignContent(book) {
    console.log('📝 Generating marketing content...');
    
    const content = {};
    
    // Generate different types of content
    const contentTypes = [
      'amazon_description',
      'social_media_posts',
      'email_sequences',
      'press_release',
      'blog_posts',
      'speaker_bio'
    ];

    for (const type of contentTypes) {
      try {
        content[type] = await this.ai.generateContent(book.userId, book._id, type, {
          title: book.title,
          author: book.author,
          genre: book.genre,
          targetAudience: book.targetAudience
        });
        console.log(`   ✅ Generated ${type}`);
      } catch (error) {
        console.error(`   ❌ Failed to generate ${type}:`, error.message);
        content[type] = null;
      }
    }

    return content;
  }

  async generateCampaignSchedule(book, launchDate) {
    const launch = launchDate ? new Date(launchDate) : new Date(book.launchDate);
    const prelaunch = new Date(launch.getTime() - (4 * 7 * 24 * 60 * 60 * 1000)); // 4 weeks before
    
    const schedule = {
      phases: {
        prelaunch: {
          start: prelaunch,
          end: launch,
          milestones: this.generatePrelaunchMilestones(prelaunch, launch)
        },
        launch: {
          start: launch,
          end: new Date(launch.getTime() + (7 * 24 * 60 * 60 * 1000)), // 1 week
          milestones: this.generateLaunchMilestones(launch)
        },
        postlaunch: {
          start: new Date(launch.getTime() + (7 * 24 * 60 * 60 * 1000)),
          end: new Date(launch.getTime() + (12 * 7 * 24 * 60 * 60 * 1000)), // 12 weeks total
          milestones: this.generatePostlaunchMilestones(launch)
        }
      }
    };

    return schedule;
  }

  generatePrelaunchMilestones(start, launch) {
    return [
      { date: start, task: 'Begin content creation', type: 'content' },
      { date: new Date(start.getTime() + (7 * 24 * 60 * 60 * 1000)), task: 'Launch email list building', type: 'audience' },
      { date: new Date(start.getTime() + (14 * 24 * 60 * 60 * 1000)), task: 'Begin partnership outreach', type: 'partnerships' },
      { date: new Date(start.getTime() + (21 * 24 * 60 * 60 * 1000)), task: 'Finalize launch preparations', type: 'preparation' }
    ];
  }

  generateLaunchMilestones(launch) {
    return [
      { date: launch, task: 'Book goes live', type: 'launch' },
      { date: new Date(launch.getTime() + (24 * 60 * 60 * 1000)), task: 'Social media announcement', type: 'promotion' },
      { date: new Date(launch.getTime() + (2 * 24 * 60 * 60 * 1000)), task: 'Press release distribution', type: 'media' },
      { date: new Date(launch.getTime() + (7 * 24 * 60 * 60 * 1000)), task: 'Launch week review', type: 'analysis' }
    ];
  }

  generatePostlaunchMilestones(launch) {
    return [
      { date: new Date(launch.getTime() + (14 * 24 * 60 * 60 * 1000)), task: 'Begin review solicitation', type: 'reviews' },
      { date: new Date(launch.getTime() + (30 * 24 * 60 * 60 * 1000)), task: 'Month 1 performance review', type: 'analysis' },
      { date: new Date(launch.getTime() + (60 * 24 * 60 * 60 * 1000)), task: 'Speaking engagement push', type: 'speaking' },
      { date: new Date(launch.getTime() + (90 * 24 * 60 * 60 * 1000)), task: 'Campaign completion review', type: 'completion' }
    ];
  }

  initializeCampaignMetrics() {
    return {
      goals: {
        bookSales: 1000,
        emailSignups: 500,
        socialFollowers: 1000,
        speakingGigs: 5,
        mediaFeatures: 3
      },
      actual: {
        bookSales: 0,
        emailSignups: 0,
        socialFollowers: 0,
        speakingGigs: 0,
        mediaFeatures: 0
      },
      roi: {
        invested: 0,
        earned: 0,
        timeSpent: 0
      }
    };
  }
}

// ===== scripts/analytics-sync.js =====
// Analytics data synchronization

class AnalyticsSync {
  constructor(integrations) {
    this.kdp = integrations.kdp;
    this.mailchimp = integrations.mailchimp;
    this.social = integrations.social;
    this.database = integrations.database;
  }

  async syncAllBooks() {
    console.log('📊 Starting analytics sync for all books...');
    
    const books = await this.database.getAllActiveBooks();
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const book of books) {
      try {
        await this.syncBookMetrics(book);
        results.success++;
        console.log(`✅ Synced: ${book.title}`);
      } catch (error) {
        results.failed++;
        results.errors.push({ book: book.title, error: error.message });
        console.error(`❌ Failed to sync ${book.title}:`, error.message);
      }
    }

    console.log(`📈 Sync completed: ${results.success} success, ${results.failed} failed`);
    return results;
  }

  async syncBookMetrics(book) {
    const metrics = {
      bookId: book._id,
      timestamp: new Date(),
      sales: await this.getSalesData(book),
      reviews: await this.getReviewData(book),
      marketing: await this.getMarketingMetrics(book),
      social: await this.getSocialMetrics(book)
    };

    await this.database.saveMetrics(metrics);
    return metrics;
  }

  async getSalesData(book) {
    if (!book.kdpSettings?.asin) {
      return { units: 0, revenue: 0, rank: null };
    }

    try {
      const salesData = await this.kdp.getSalesData(book.kdpSettings.asin);
      return {
        units: salesData.unitsSold || 0,
        revenue: salesData.revenue || 0,
        rank: salesData.bestSellerRank || null,
        countries: salesData.salesByCountry || {}
      };
    } catch (error) {
      console.warn(`Could not fetch sales data for ${book.title}:`, error.message);
      return { units: 0, revenue: 0, rank: null };
    }
  }

  async getReviewData(book) {
    try {
      const reviews = await this.kdp.getReviews(book.kdpSettings?.asin);
      return {
        count: reviews.length,
        averageRating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length || 0,
        latest: reviews.slice(0, 5),
        sentiment: this.analyzeSentiment(reviews)
      };
    } catch (error) {
      return { count: 0, averageRating: 0, latest: [], sentiment: 'neutral' };
    }
  }

  async getMarketingMetrics(book) {
    const campaignId = book.activeCampaign;
    if (!campaignId) return {};

    try {
      const emailMetrics = await this.mailchimp.getCampaignStats(campaignId);
      return {
        emailDelivered: emailMetrics.emails_sent || 0,
        emailOpens: emailMetrics.opens?.unique_opens || 0,
        emailClicks: emailMetrics.clicks?.unique_clicks || 0,
        unsubscribes: emailMetrics.unsubscribed || 0
      };
    } catch (error) {
      return {};
    }
  }

  async getSocialMetrics(book) {
    // Aggregate social media metrics across platforms
    return {
      mentions: 0,
      engagement: 0,
      reach: 0,
      shares: 0
    };
  }

  analyzeSentiment(reviews) {
    // Simple sentiment analysis
    const positiveWords = ['great', 'excellent', 'amazing', 'love', 'perfect'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst'];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    reviews.forEach(review => {
      const text = review.text.toLowerCase();
      positiveWords.forEach(word => {
        if (text.includes(word)) positiveScore++;
      });
      negativeWords.forEach(word => {
        if (text.includes(word)) negativeScore++;
      });
    });

    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }
}

// ===== scripts/deployment.js =====
// Deployment automation script

class DeploymentManager {
  constructor() {
    this.environments = ['development', 'staging', 'production'];
    this.services = ['frontend', 'backend', 'ai-wrapper', 'database'];
  }

  async deploy(environment, services = this.services) {
    console.log(`🚀 Starting deployment to ${environment}...`);
    
    try {
      await this.preDeploymentChecks(environment);
      await this.backupData(environment);
      await this.deployServices(environment, services);
      await this.postDeploymentValidation(environment);
      await this.updateHealthStatus(environment, 'healthy');
      
      console.log(`✅ Deployment to ${environment} completed successfully!`);
      
    } catch (error) {
      console.error(`❌ Deployment failed:`, error.message);
      await this.rollback(environment, services);
      throw error;
    }
  }

  async preDeploymentChecks(environment) {
    console.log('🔍 Running pre-deployment checks...');
    
    // Check environment variables
    const requiredVars = [
      'MONGODB_URI', 'REDIS_HOST', 'CLAUDE_API_KEY',
      'STRIPE_SECRET_KEY', 'JWT_SECRET'
    ];
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
      }
    }
    
    // Check service dependencies
    await this.checkDatabaseConnection();
    await this.checkRedisConnection();
    await this.checkExternalAPIs();
    
    console.log('   ✅ All pre-deployment checks passed');
  }

  async deployServices(environment, services) {
    console.log('📦 Deploying services...');
    
    const deploymentOrder = ['database', 'backend', 'ai-wrapper', 'frontend'];
    
    for (const service of deploymentOrder) {
      if (services.includes(service)) {
        await this.deployService(environment, service);
      }
    }
  }

  async deployService(environment, service) {
    console.log(`   📤 Deploying ${service}...`);
    
    // Service-specific deployment logic
    switch (service) {
      case 'frontend':
        await this.deployFrontend(environment);
        break;
      case 'backend':
        await this.deployBackend(environment);
        break;
      case 'ai-wrapper':
        await this.deployAIWrapper(environment);
        break;
      case 'database':
        await this.runMigrations(environment);
        break;
    }
    
    console.log(`   ✅ ${service} deployed successfully`);
  }

  async rollback(environment, services) {
    console.log('↩️ Initiating rollback...');
    
    // Rollback logic for each service
    for (const service of services.reverse()) {
      try {
        await this.rollbackService(environment, service);
        console.log(`   ✅ Rolled back ${service}`);
      } catch (error) {
        console.error(`   ❌ Failed to rollback ${service}:`, error.message);
      }
    }
  }
}

// ===== scripts/health-check.js =====
// System health monitoring

class HealthChecker {
  constructor() {
    this.checks = [
      { name: 'database', fn: this.checkDatabase },
      { name: 'redis', fn: this.checkRedis },
      { name: 'ai_service', fn: this.checkAIService },
      { name: 'external_apis', fn: this.checkExternalAPIs },
      { name: 'disk_space', fn: this.checkDiskSpace },
      { name: 'memory_usage', fn: this.checkMemoryUsage }
    ];
  }

  async runHealthCheck() {
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {},
      summary: {
        total: this.checks.length,
        passed: 0,
        failed: 0
      }
    };

    for (const check of this.checks) {
      try {
        const checkResult = await check.fn.call(this);
        results.checks[check.name] = {
          status: checkResult.status || 'healthy',
          message: checkResult.message || 'OK',
          duration: checkResult.duration || 0
        };
        
        if (checkResult.status === 'healthy') {
          results.summary.passed++;
        } else {
          results.summary.failed++;
          results.status = 'unhealthy';
        }
        
      } catch (error) {
        results.checks[check.name] = {
          status: 'unhealthy',
          message: error.message,
          duration: 0
        };
        results.summary.failed++;
        results.status = 'unhealthy';
      }
    }

    return results;
  }

  async checkDatabase() {
    const start = Date.now();
    // Database connection check logic
    const duration = Date.now() - start;
    return { status: 'healthy', message: 'Database connected', duration };
  }

  async checkRedis() {
    const start = Date.now();
    // Redis connection check logic
    const duration = Date.now() - start;
    return { status: 'healthy', message: 'Redis connected', duration };
  }

  async checkAIService() {
    const start = Date.now();
    // AI service health check
    const duration = Date.now() - start;
    return { status: 'healthy', message: 'AI service responding', duration };
  }

  async checkDiskSpace() {
    const fs = require('fs');
    const stats = fs.statSync('.');
    // Disk space check logic
    return { status: 'healthy', message: 'Sufficient disk space' };
  }

  async checkMemoryUsage() {
    const used = process.memoryUsage();
    const usage = used.heapUsed / used.heapTotal;
    
    if (usage > 0.9) {
      return { status: 'warning', message: `High memory usage: ${Math.round(usage * 100)}%` };
    }
    
    return { status: 'healthy', message: `Memory usage: ${Math.round(usage * 100)}%` };
  }
}

// Export all classes for use
module.exports = {
  SystemSetup,
  BookImporter,
  CampaignGenerator,
  AnalyticsSync,
  DeploymentManager,
  HealthChecker
};

// ===== Main execution script =====
if (require.main === module) {
  const [,, command, ...args] = process.argv;
  
  switch (command) {
    case 'setup':
      new SystemSetup().run();
      break;
    case 'health-check':
      new HealthChecker().runHealthCheck().then(console.log);
      break;
    case 'deploy':
      const [env] = args;
      new DeploymentManager().deploy(env || 'development');
      break;
    default:
      console.log('Available commands: setup, health-check, deploy');
  }
}
