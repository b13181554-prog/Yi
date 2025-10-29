const Groq = require('groq-sdk');
const fs = require('fs').promises;
const path = require('path');
const { t } = require('./languages');

class AICodeAgent {
  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is required for AI Code Agent');
    }
    
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.model = 'llama-3.3-70b-versatile';
    this.conversationHistory = new Map();
    this.maxHistoryLength = 10;
    
    this.tools = [
      {
        name: 'read_file',
        description: 'قراءة محتوى ملف من المشروع',
        parameters: {
          filePath: 'string - المسار الكامل للملف'
        }
      },
      {
        name: 'list_files',
        description: 'عرض قائمة بالملفات في مجلد معين',
        parameters: {
          directory: 'string - مسار المجلد (اختياري، افتراضياً الجذر)'
        }
      },
      {
        name: 'analyze_code',
        description: 'تحليل كود برمجي وإيجاد المشاكل والتحسينات',
        parameters: {
          code: 'string - الكود المراد تحليله'
        }
      },
      {
        name: 'search_in_files',
        description: 'البحث عن نص في ملفات المشروع',
        parameters: {
          query: 'string - النص المراد البحث عنه'
        }
      }
    ];
  }

  getSystemPrompt(lang = 'ar') {
    const prompts = {
      ar: `أنت مساعد برمجي ذكي متخصص في مشروع OBENTCHI Trading Bot.

المشروع:
- بوت تليجرام للتحليل الفني والتداول في العملات الرقمية
- مبني بـ Node.js, Express, MongoDB, Redis
- يستخدم Telegram Bot API و Web App
- يحتوي على أنظمة متقدمة للتحليل الفني باستخدام AI

مهامك:
1. مراجعة وتحليل الكود البرمجي
2. اقتراح تحسينات وحلول للمشاكل
3. توليد كود جديد عند الطلب
4. شرح الأكواد الموجودة
5. إيجاد الأخطاء وتصحيحها
6. الإجابة على الأسئلة التقنية

الأدوات المتاحة لك:
- read_file: قراءة محتوى الملفات
- list_files: عرض قائمة الملفات
- analyze_code: تحليل الكود
- search_in_files: البحث في الملفات

إرشادات:
- أجب بوضوح ودقة
- اقترح حلولاً عملية وقابلة للتطبيق
- استخدم أمثلة كود واضحة
- ركز على الأمان وأفضل الممارسات البرمجية
- تذكر دائماً أن المشروع يجب أن يكون متوافق مع الشريعة الإسلامية
- لا تقترح أي ميزات تتعلق بالتداول بالهامش أو العقود المستقبلية

القواعد الأمنية:
- لا يمكنك تعديل الملفات مباشرة (فقط اقتراح التعديلات)
- لا يمكنك تنفيذ أوامر نظام التشغيل
- لا يمكنك الوصول للمتغيرات البيئية الحساسة`,

      en: `You are an intelligent programming assistant specialized in the OBENTCHI Trading Bot project.

Project:
- Telegram bot for technical analysis and cryptocurrency trading
- Built with Node.js, Express, MongoDB, Redis
- Uses Telegram Bot API and Web App
- Contains advanced AI-powered technical analysis systems

Your tasks:
1. Review and analyze code
2. Suggest improvements and solutions
3. Generate new code when requested
4. Explain existing code
5. Find and fix errors
6. Answer technical questions

Available tools:
- read_file: Read file contents
- list_files: List files
- analyze_code: Analyze code
- search_in_files: Search in files

Guidelines:
- Answer clearly and accurately
- Suggest practical and applicable solutions
- Use clear code examples
- Focus on security and best practices
- Remember the project must comply with Islamic Sharia law
- Don't suggest features related to margin trading or futures

Security rules:
- You cannot modify files directly (only suggest modifications)
- You cannot execute OS commands
- You cannot access sensitive environment variables`
    };

    return prompts[lang] || prompts.ar;
  }

  async readFile(filePath) {
    try {
      const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
      const fullPath = path.resolve(__dirname, normalizedPath);
      
      const relative = path.relative(__dirname, fullPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return {
          success: false,
          error: 'Path traversal not allowed - access restricted to project directory only'
        };
      }
      
      const stats = await fs.stat(fullPath);
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      
      if (stats.size > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `File too large (${(stats.size / 1024 / 1024).toFixed(2)} MB). Maximum allowed: 5 MB`
        };
      }
      
      const content = await fs.readFile(fullPath, 'utf-8');
      
      return {
        success: true,
        content: content,
        path: normalizedPath,
        size: content.length
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: false,
          error: 'File not found'
        };
      } else if (error.code === 'EISDIR') {
        return {
          success: false,
          error: 'Path is a directory, not a file'
        };
      } else if (error.message.includes('invalid') || error.message.includes('binary')) {
        return {
          success: false,
          error: 'File appears to be binary or invalid UTF-8'
        };
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  async listFiles(directory = '.', depth = 0, maxDepth = 2) {
    try {
      const normalizedDir = path.normalize(directory).replace(/^(\.\.(\/|\\|$))+/, '');
      const fullPath = path.resolve(__dirname, normalizedDir);
      
      const relative = path.relative(__dirname, fullPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return {
          success: false,
          error: 'Path traversal not allowed - access restricted to project directory only'
        };
      }
      
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      
      const fileList = [];
      
      for (const item of items) {
        if (item.name.startsWith('.') || 
            item.name === 'node_modules' || 
            item.name === 'attached_assets') {
          continue;
        }

        const itemPath = path.join(directory, item.name);
        
        if (item.isDirectory()) {
          fileList.push({
            type: 'directory',
            name: item.name,
            path: itemPath
          });
          
          if (depth < maxDepth) {
            const subFiles = await this.listFiles(itemPath, depth + 1, maxDepth);
            fileList.push(...subFiles.files);
          }
        } else {
          fileList.push({
            type: 'file',
            name: item.name,
            path: itemPath
          });
        }
      }
      
      return {
        success: true,
        files: fileList
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async searchInFiles(query, directory = '.') {
    try {
      const normalizedDir = path.normalize(directory).replace(/^(\.\.(\/|\\|$))+/, '');
      const fullPath = path.resolve(__dirname, normalizedDir);
      
      const relative = path.relative(__dirname, fullPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return [];
      }
      
      const results = [];
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.name.startsWith('.') || 
            item.name === 'node_modules' || 
            item.name === 'attached_assets') {
          continue;
        }

        const itemPath = path.join(directory, item.name);
        
        if (item.isDirectory()) {
          const subResults = await this.searchInFiles(query, itemPath);
          results.push(...subResults);
        } else if (item.isFile() && item.name.endsWith('.js')) {
          try {
            const itemFullPath = path.resolve(__dirname, itemPath);
            const itemRelative = path.relative(__dirname, itemFullPath);
            
            if (!itemRelative.startsWith('..') && !path.isAbsolute(itemRelative)) {
              const content = await fs.readFile(itemFullPath, 'utf-8');
              const lines = content.split('\n');
              
              lines.forEach((line, index) => {
                if (line.toLowerCase().includes(query.toLowerCase())) {
                  results.push({
                    file: itemPath,
                    line: index + 1,
                    content: line.trim()
                  });
                }
              });
            }
          } catch (readError) {
          }
        }
      }
      
      return results;
    } catch (error) {
      return [];
    }
  }

  analyzeCode(code) {
    const issues = [];
    const suggestions = [];
    
    if (code.includes('var ')) {
      issues.push('استخدام var بدلاً من const أو let');
      suggestions.push('استبدل var بـ const للثوابت و let للمتغيرات');
    }
    
    if (!code.includes('try') && (code.includes('await') || code.includes('.then'))) {
      issues.push('عدم وجود معالجة للأخطاء');
      suggestions.push('أضف try-catch block لمعالجة الأخطاء المحتملة');
    }
    
    if (code.includes('console.log')) {
      suggestions.push('استخدم نظام logging احترافي بدلاً من console.log');
    }
    
    if (code.includes('==') && !code.includes('===')) {
      issues.push('استخدام == بدلاً من ===');
      suggestions.push('استخدم === للمقارنة الصارمة');
    }
    
    return {
      issues: issues,
      suggestions: suggestions,
      quality: issues.length === 0 ? 'ممتاز' : issues.length <= 2 ? 'جيد' : 'يحتاج تحسين'
    };
  }

  async detectIntent(userMessage, lang = 'ar') {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('اقرأ') || lowerMessage.includes('read') || lowerMessage.includes('عرض') || lowerMessage.includes('show')) {
      const fileMatch = userMessage.match(/[\w\-\.\/]+\.js/);
      if (fileMatch) {
        return { intent: 'read_file', filePath: fileMatch[0] };
      }
    }
    
    if (lowerMessage.includes('ابحث') || lowerMessage.includes('search') || lowerMessage.includes('find')) {
      return { intent: 'search' };
    }
    
    if (lowerMessage.includes('ملفات') || lowerMessage.includes('list') || lowerMessage.includes('files')) {
      return { intent: 'list_files' };
    }
    
    if (lowerMessage.includes('راجع') || lowerMessage.includes('review') || lowerMessage.includes('analyze')) {
      return { intent: 'analyze' };
    }
    
    return { intent: 'chat' };
  }

  async processUserRequest(userId, userMessage, lang = 'ar') {
    try {
      if (!this.conversationHistory.has(userId)) {
        this.conversationHistory.set(userId, []);
      }
      
      const history = this.conversationHistory.get(userId);
      
      const intent = await this.detectIntent(userMessage, lang);
      
      let contextualMessage = userMessage;
      
      if (intent.intent === 'read_file' && intent.filePath) {
        const fileResult = await this.readFile(intent.filePath);
        if (fileResult.success) {
          const truncatedContent = fileResult.content.length > 3000 
            ? fileResult.content.substring(0, 3000) + '\n... (truncated)'
            : fileResult.content;
          
          contextualMessage = lang === 'ar' 
            ? `المستخدم يطلب قراءة الملف ${intent.filePath}. محتوى الملف:\n\n${truncatedContent}\n\nالرجاء شرح هذا الملف وتحليله.`
            : `User requested to read file ${intent.filePath}. File content:\n\n${truncatedContent}\n\nPlease explain and analyze this file.`;
        }
      }
      
      if (intent.intent === 'list_files') {
        const filesResult = await this.listFiles('.');
        if (filesResult.success) {
          const filesList = filesResult.files
            .filter(f => f.type === 'file' && f.name.endsWith('.js'))
            .map(f => f.path)
            .slice(0, 50)
            .join('\n');
          
          contextualMessage = lang === 'ar'
            ? `المستخدم يطلب عرض الملفات. قائمة الملفات الرئيسية (.js):\n\n${filesList}\n\nالرجاء تنظيم القائمة وشرح الملفات الرئيسية.`
            : `User requested file listing. Main JavaScript files:\n\n${filesList}\n\nPlease organize and explain the main files.`;
        }
      }
      
      history.push({
        role: 'user',
        content: contextualMessage
      });
      
      if (history.length > this.maxHistoryLength * 2) {
        history.splice(0, 2);
      }
      
      const messages = [
        {
          role: 'system',
          content: this.getSystemPrompt(lang)
        },
        ...history
      ];
      
      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: 0.3,
        max_tokens: 4000,
        top_p: 0.9
      });
      
      const assistantResponse = completion.choices[0].message.content;
      
      history.push({
        role: 'assistant',
        content: assistantResponse
      });
      
      this.conversationHistory.set(userId, history);
      
      return {
        success: true,
        response: assistantResponse,
        intent: intent.intent,
        usage: {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens
        }
      };
    } catch (error) {
      console.error('AI Code Agent Error:', error);
      return {
        success: false,
        error: error.message,
        fallback: lang === 'ar' 
          ? 'عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.'
          : 'Sorry, an error occurred processing your request. Please try again.'
      };
    }
  }

  async executeToolCommand(userId, toolName, parameters, lang = 'ar') {
    try {
      let result;
      
      switch (toolName) {
        case 'read_file':
          result = await this.readFile(parameters.filePath);
          break;
          
        case 'list_files':
          result = await this.listFiles(parameters.directory || '.');
          break;
          
        case 'analyze_code':
          result = this.analyzeCode(parameters.code);
          break;
          
        case 'search_in_files':
          result = await this.searchInFiles(parameters.query);
          break;
          
        default:
          return {
            success: false,
            error: `أداة غير معروفة: ${toolName}`
          };
      }
      
      const toolResultMessage = lang === 'ar' 
        ? `تم تنفيذ الأداة ${toolName} بنجاح. النتيجة:\n${JSON.stringify(result, null, 2)}`
        : `Tool ${toolName} executed successfully. Result:\n${JSON.stringify(result, null, 2)}`;
      
      return await this.processUserRequest(userId, toolResultMessage, lang);
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  clearHistory(userId) {
    this.conversationHistory.delete(userId);
    return { success: true };
  }

  getAvailableTools() {
    return this.tools;
  }

  getStats() {
    return {
      activeConversations: this.conversationHistory.size,
      model: this.model,
      maxHistoryLength: this.maxHistoryLength
    };
  }
}

const aiCodeAgent = new AICodeAgent();

module.exports = aiCodeAgent;
