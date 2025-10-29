/**
 * AI Project Context - نظام السياق الشامل للمشروع
 * يوفر معلومات كاملة عن المشروع للذكاء الاصطناعي
 * 
 * Features:
 * - قراءة السياق من replit.md
 * - تحديثات من Git history
 * - المكونات التقنية
 * - قائمة الميزات
 */

const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('./centralized-logger');

// ✅ SECURITY: تم إزالة exec لمنع command injection
const logger = createLogger('ai-project-context');

/**
 * الحصول على سياق كامل عن المشروع من replit.md
 */
async function getFullProjectContext() {
  try {
    logger.info('📖 Reading full project context from replit.md');
    
    const replitMdPath = path.join(__dirname, 'replit.md');
    const content = await fs.readFile(replitMdPath, 'utf-8');
    
    // استخراج الأقسام المهمة
    const sections = {
      overview: extractSection(content, '## Overview'),
      architecture: extractSection(content, '## System Architecture'),
      userPreferences: extractSection(content, '## User Preferences'),
      recentChanges: extractSection(content, '## Recent Changes'),
      technicalStack: extractSection(content, '## Technical Stack'),
      features: extractSection(content, '## Key Features')
    };
    
    // إحصائيات عن المشروع
    const fileCount = await countProjectFiles();
    const linesOfCode = await countLinesOfCode();
    
    return {
      success: true,
      project_name: 'OBENTCHI Trading Bot',
      description: 'Telegram-based cryptocurrency trading bot with technical analysis',
      context: sections,
      statistics: {
        files: fileCount,
        lines_of_code: linesOfCode,
        last_updated: new Date().toISOString()
      }
    };
    
  } catch (error) {
    logger.error({ err: error }, '❌ Error reading project context');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * استخراج قسم معين من النص
 */
function extractSection(content, sectionHeader) {
  try {
    const startIndex = content.indexOf(sectionHeader);
    if (startIndex === -1) return 'Section not found';
    
    // البحث عن القسم التالي (##)
    const nextSectionIndex = content.indexOf('##', startIndex + sectionHeader.length);
    const endIndex = nextSectionIndex === -1 ? content.length : nextSectionIndex;
    
    const section = content.substring(startIndex, endIndex).trim();
    
    // إزالة العنوان والاحتفاظ بالمحتوى فقط
    return section.substring(sectionHeader.length).trim();
    
  } catch (error) {
    logger.error({ err: error }, `Error extracting section: ${sectionHeader}`);
    return 'Error extracting section';
  }
}

/**
 * أحدث التحسينات من replit.md
 * ✅ SECURITY: تم إزالة git log exec لمنع command injection
 * بدلاً من ذلك، نقرأ من replit.md مباشرة
 */
async function getRecentChanges(limit = 10) {
  try {
    logger.info('🔄 Getting recent changes from replit.md');
    
    const replitMdPath = path.join(__dirname, 'replit.md');
    const content = await fs.readFile(replitMdPath, 'utf-8');
    
    // استخراج قسم Recent Changes
    const recentChangesSection = extractSection(content, '## Recent Changes');
    
    if (!recentChangesSection || recentChangesSection === 'Section not found') {
      return {
        success: true,
        changes: [],
        message: 'No recent changes section found in replit.md'
      };
    }
    
    // تحليل التغييرات من النص
    const lines = recentChangesSection.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .slice(0, Math.min(limit, 20));
    
    const changes = lines.map((line, index) => ({
      id: `change-${index + 1}`,
      description: line.replace(/^[\s\-\*]+/, '').trim(),
      source: 'replit.md'
    }));
    
    return {
      success: true,
      count: changes.length,
      changes: changes,
      note: '✅ SECURITY: Reading from replit.md instead of git log'
    };
    
  } catch (error) {
    logger.warn({ err: error }, '⚠️ Could not read recent changes');
    return {
      success: false,
      error: error.message,
      message: 'Recent changes not available'
    };
  }
}

/**
 * المكونات التقنية المستخدمة
 */
async function getTechnicalStack() {
  try {
    logger.info('🔧 Getting technical stack information');
    
    // قراءة package.json
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    const stack = {
      runtime: {
        platform: 'Node.js',
        version: process.version,
        environment: process.env.NODE_ENV || 'development'
      },
      
      core_technologies: {
        web_framework: 'Express.js',
        bot_framework: 'node-telegram-bot-api',
        database: 'MongoDB',
        cache: 'Redis',
        ai_service: 'Google Gemini AI'
      },
      
      key_dependencies: {
        telegram: packageJson.dependencies['node-telegram-bot-api'],
        mongodb: packageJson.dependencies['mongodb'],
        redis: packageJson.dependencies['ioredis'],
        ai: packageJson.dependencies['@google/generative-ai'],
        queue: packageJson.dependencies['bull'],
        logging: packageJson.dependencies['pino'],
        blockchain: packageJson.dependencies['tronweb']
      },
      
      architecture_patterns: [
        'Microservices Architecture',
        'Event-Driven Architecture',
        'Queue-Based Processing',
        'Caching Strategy',
        'Rate Limiting',
        'Centralized Logging'
      ],
      
      external_services: [
        'Telegram Bot API',
        'Google Gemini AI',
        'MongoDB Atlas',
        'OKX Exchange API',
        'TRON Blockchain',
        'Yahoo Finance API',
        'CryptoAPI Payment Gateway'
      ]
    };
    
    return {
      success: true,
      stack: stack,
      package_info: {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description
      }
    };
    
  } catch (error) {
    logger.error({ err: error }, '❌ Error getting technical stack');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * قائمة الميزات المتاحة
 */
async function getFeaturesList() {
  try {
    logger.info('✨ Getting features list');
    
    const features = {
      core_features: [
        {
          name: 'Technical Analysis',
          description: 'Advanced technical analysis with multiple indicators',
          types: [
            'Complete Analysis - جميع المؤشرات الفنية',
            'Ultra Analysis - دقة عالية 75%+',
            'Zero Reversal Analysis - ضمان 100%',
            'Fibonacci Analysis - مستويات فيبوناتشي',
            'Pump Analysis - تحليل الارتفاع السريع'
          ]
        },
        {
          name: 'Multi-Market Support',
          description: 'Support for 1455+ assets across multiple markets',
          markets: [
            'Cryptocurrencies (300+)',
            'Forex (400+ pairs)',
            'Stocks (140+)',
            'Commodities (40+)',
            'Indices (50+)'
          ]
        },
        {
          name: 'Subscription System',
          description: 'Flexible subscription plans with USDT TRC20 payments',
          features: [
            'Monthly Subscription: 10 USDT',
            'Pump Analysis Subscription: 5 USDT/month',
            'Analyst Subscription: 20 USDT/month (customizable)',
            '7-day free trial for new users'
          ]
        },
        {
          name: 'Analyst System',
          description: 'Platform for analysts to publish signals',
          features: [
            'Signal publishing',
            'Subscriber management',
            'Earnings with Escrow',
            'Performance tracking',
            '5-tier ranking system',
            'AI Performance Advisor'
          ]
        },
        {
          name: 'Wallet System',
          description: 'USDT TRC20 wallet with automated deposits and withdrawals',
          features: [
            'Automatic deposit detection',
            'Queue-based automated withdrawals',
            'Transaction verification',
            'Duplicate prevention',
            '1 USDT withdrawal fee',
            'Max withdrawal: 1000 USDT'
          ]
        },
        {
          name: 'Referral Program',
          description: '3-level referral system with bonuses',
          features: [
            '10% commission on user payments',
            '20% commission on analyst subscriptions',
            '15% commission for analyst promoters',
            'Milestone bonuses',
            'Earnings dashboard'
          ]
        }
      ],
      
      advanced_features: [
        'Smart Multi-Market Scanner',
        'Real-time Notifications (15min intervals)',
        'Quality-Based Refund System',
        'Automated Safety System (24/7 monitoring)',
        'Advanced Security System (fraud detection)',
        'Google Gemini AI Customer Support',
        'Multi-Language Support (7 languages)',
        'Telegram Web App Integration',
        'Admin Dashboard',
        'Feature Flags System',
        'Centralized Logging',
        'Rate Limiting',
        'Caching Strategy'
      ],
      
      technical_features: [
        'Microservices Architecture',
        'Queue-Based Processing (Bull + Redis)',
        'MongoDB Transactions',
        'Redis Distributed Rate Limiting',
        'Safe Database Query Guards',
        'Batch Data Loader',
        'LRU Membership Cache',
        'Multi-Exchange Fallback',
        'API Timeout Configuration',
        'Health Checks & Monitoring',
        'Metrics Exporter (Prometheus)',
        'Docker & Kubernetes Support'
      ],
      
      compliance: [
        'Sharia-Compliant Trading (Spot Trading Only)',
        'No Futures or Leverage Trading',
        'No Interest-Based Transactions'
      ]
    };
    
    return {
      success: true,
      features: features,
      total_features: countFeatures(features)
    };
    
  } catch (error) {
    logger.error({ err: error }, '❌ Error getting features list');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * حساب إجمالي الميزات
 */
function countFeatures(features) {
  let count = 0;
  
  if (features.core_features) {
    count += features.core_features.length;
  }
  if (features.advanced_features) {
    count += features.advanced_features.length;
  }
  if (features.technical_features) {
    count += features.technical_features.length;
  }
  
  return count;
}

/**
 * عد ملفات المشروع
 * ✅ SECURITY: تم إزالة exec واستخدام fs بدلاً منه
 */
async function countProjectFiles() {
  try {
    let count = 0;
    
    async function countRecursive(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          // تجاهل المجلدات الخاصة
          if (entry.name.startsWith('.') || 
              entry.name === 'node_modules' || 
              entry.name === 'attached_assets' ||
              entry.name === 'docs') {
            continue;
          }
          
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await countRecursive(fullPath);
          } else if (entry.name.endsWith('.js')) {
            count++;
          }
        }
      } catch (error) {
        // تجاهل الأخطاء في المجلدات غير المتاحة
      }
    }
    
    await countRecursive(__dirname);
    return count;
  } catch (error) {
    logger.warn('Could not count project files');
    return 0;
  }
}

/**
 * عد أسطر الكود
 * ✅ SECURITY: تم إزالة exec واستخدام fs بدلاً منه
 */
async function countLinesOfCode() {
  try {
    let totalLines = 0;
    
    async function countInDirectory(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          // تجاهل المجلدات الخاصة
          if (entry.name.startsWith('.') || 
              entry.name === 'node_modules' || 
              entry.name === 'attached_assets' ||
              entry.name === 'docs') {
            continue;
          }
          
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await countInDirectory(fullPath);
          } else if (entry.name.endsWith('.js')) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              totalLines += content.split('\n').length;
            } catch (error) {
              // تجاهل أخطاء القراءة
            }
          }
        }
      } catch (error) {
        // تجاهل الأخطاء في المجلدات غير المتاحة
      }
    }
    
    await countInDirectory(__dirname);
    return totalLines;
  } catch (error) {
    logger.warn('Could not count lines of code');
    return 0;
  }
}

/**
 * الحصول على ملخص شامل للمشروع
 */
async function getProjectSummary() {
  try {
    logger.info('📋 Getting project summary');
    
    const [context, stack, features, changes] = await Promise.all([
      getFullProjectContext(),
      getTechnicalStack(),
      getFeaturesList(),
      getRecentChanges(5)
    ]);
    
    return {
      success: true,
      summary: {
        project_context: context.success ? context.context?.overview : 'Not available',
        technical_stack: stack.success ? stack.stack : 'Not available',
        features_count: features.success ? features.total_features : 0,
        recent_changes_count: changes.success ? changes.count : 0,
        last_updated: new Date().toISOString()
      },
      full_data: {
        context,
        stack,
        features,
        changes
      }
    };
    
  } catch (error) {
    logger.error({ err: error }, '❌ Error getting project summary');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * البحث في الوثائق
 */
async function searchDocumentation(keyword) {
  try {
    logger.info(`🔍 Searching documentation for: ${keyword}`);
    
    const docsDir = path.join(__dirname, 'docs');
    const files = await fs.readdir(docsDir);
    
    const results = [];
    
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      
      const filePath = path.join(docsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        // استخراج السطور المتعلقة بالكلمة المفتاحية
        const lines = content.split('\n');
        const relevantLines = lines.filter(line => 
          line.toLowerCase().includes(keyword.toLowerCase())
        );
        
        results.push({
          file: file,
          matches: relevantLines.length,
          preview: relevantLines.slice(0, 3)
        });
      }
    }
    
    return {
      success: true,
      keyword: keyword,
      files_found: results.length,
      results: results
    };
    
  } catch (error) {
    logger.error({ err: error }, '❌ Error searching documentation');
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  getFullProjectContext,
  getRecentChanges,
  getTechnicalStack,
  getFeaturesList,
  getProjectSummary,
  searchDocumentation
};
