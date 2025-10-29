/**
 * Advanced AI Service - نظام الذكاء الاصطناعي المتقدم
 * يدعم: تحليل الملفات، البحث في الإنترنت، إنشاء الصور
 * يستخدم: Google Gemini AI (مجاني، بدون حدود، يدعم الصور والفيديو)
 */

const geminiService = require('./gemini-service');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { t } = require('./languages');
const { systemPrompts } = require('./ai-system-prompts');

class AdvancedAIService {
  constructor() {
    this.aiService = geminiService;
    this.conversationHistory = new Map();
    this.maxHistoryLength = 20;
    this.tools = {
      read_file: 'قراءة وتحليل الملفات',
      search_internet: 'البحث في الإنترنت',
      generate_image: 'إنشاء صور',
      analyze_code: 'تحليل وتحسين الكود',
      analyze_market: 'تحليل السوق',
      get_latest_news: 'الحصول على أحدث الأخبار'
    };
    
    console.log('🚀 Advanced AI Service initialized');
  }

  /**
   * معالجة طلب المستخدم بذكاء
   */
  async processRequest(userId, message, options = {}) {
    const { lang = 'ar', files = [], context = {}, saveHistory = true } = options;
    
    try {
      
      // تحديد نوع الطلب
      const intent = await this.detectIntent(message, lang);
      
      // معالجة الملفات إذا كانت موجودة
      let filesContext = '';
      if (files.length > 0) {
        filesContext = await this.processFiles(files, lang);
      }
      
      // الحصول على السياق فقط إذا كان الحفظ مفعل
      const conversationContext = saveHistory ? this.getConversationHistory(userId) : [];
      
      // بناء الرسالة للذكاء الاصطناعي
      let enhancedMessage = message;
      
      if (filesContext) {
        enhancedMessage += `\n\n📁 الملفات المرفقة:\n${filesContext}`;
      }
      
      // معالجة حسب نوع الطلب
      let response;
      
      switch (intent.type) {
        case 'search_internet':
          response = await this.searchAndAnalyze(intent.query, lang);
          break;
          
        case 'generate_image':
          response = await this.generateImage(intent.description, lang);
          break;
          
        case 'analyze_code':
          response = await this.analyzeCode(intent.code, lang);
          break;
          
        case 'analyze_file':
          response = await this.analyzeFile(intent.filePath, lang);
          break;
          
        default:
          response = await this.chatWithAI(userId, enhancedMessage, lang, conversationContext);
      }
      
      // حفظ في السجل فقط إذا كان مطلوب
      if (saveHistory) {
        this.saveToHistory(userId, message, response.content);
      }
      
      return {
        success: true,
        content: response.content,
        type: intent.type,
        tools_used: response.tools_used || [],
        metadata: response.metadata || {}
      };
      
    } catch (error) {
      console.error('Advanced AI Error:', error);
      return {
        success: false,
        error: error.message,
        content: lang === 'ar' 
          ? '❌ عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.'
          : '❌ Sorry, an error occurred. Please try again.'
      };
    }
  }

  /**
   * تحديد نوع الطلب بذكاء
   */
  async detectIntent(message, lang = 'ar') {
    const lowerMessage = message.toLowerCase();
    
    // البحث في الإنترنت
    if (lowerMessage.includes('ابحث') || lowerMessage.includes('search') || 
        lowerMessage.includes('what is') || lowerMessage.includes('ما هو') ||
        lowerMessage.includes('معلومات عن') || lowerMessage.includes('information about')) {
      return {
        type: 'search_internet',
        query: message
      };
    }
    
    // إنشاء صورة
    if (lowerMessage.includes('ارسم') || lowerMessage.includes('draw') || 
        lowerMessage.includes('صورة') || lowerMessage.includes('image') ||
        lowerMessage.includes('generate') || lowerMessage.includes('create picture')) {
      return {
        type: 'generate_image',
        description: message.replace(/ارسم|draw|صورة|image|generate|create/gi, '').trim()
      };
    }
    
    // تحليل الكود
    if (lowerMessage.includes('راجع') || lowerMessage.includes('review') || 
        lowerMessage.includes('analyze') || lowerMessage.includes('حسن') ||
        lowerMessage.includes('improve') || lowerMessage.includes('كود')) {
      return {
        type: 'analyze_code',
        code: message
      };
    }
    
    // قراءة ملف
    const fileMatch = message.match(/[\w\-\.\/]+\.(js|json|txt|md|py|java)/i);
    if (fileMatch) {
      return {
        type: 'analyze_file',
        filePath: fileMatch[0]
      };
    }
    
    // محادثة عادية
    return {
      type: 'chat',
      message: message
    };
  }

  /**
   * البحث في الإنترنت وتحليل النتائج
   */
  async searchAndAnalyze(query, lang = 'ar') {
    try {
      console.log(`🔍 Searching internet for: ${query}`);
      
      // استخدام DuckDuckGo API (مجاني وبدون API key)
      const searchResults = await this.searchDuckDuckGo(query);
      
      if (!searchResults || searchResults.length === 0) {
        return {
          content: lang === 'ar' 
            ? '❌ لم أجد نتائج للبحث. حاول إعادة صياغة السؤال.'
            : '❌ No search results found. Try rephrasing your question.',
          tools_used: ['search_internet'],
          metadata: { results_count: 0 }
        };
      }
      
      // تحليل النتائج بواسطة Google Gemini AI
      const analysisPrompt = lang === 'ar' 
        ? `قم بتحليل نتائج البحث التالية والإجابة على السؤال: "${query}"

نتائج البحث:
${searchResults.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   المصدر: ${r.url}`).join('\n\n')}

قدم إجابة شاملة ودقيقة بناءً على هذه المعلومات:`
        : `Analyze these search results and answer the question: "${query}"

Search Results:
${searchResults.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   Source: ${r.url}`).join('\n\n')}

Provide a comprehensive and accurate answer based on this information:`;

      const aiResponse = await this.aiService.chat([
        { role: 'system', content: lang === 'ar' 
          ? 'أنت مساعد ذكي متخصص في تحليل المعلومات من الإنترنت وتقديم إجابات دقيقة ومفيدة.'
          : 'You are an intelligent assistant specialized in analyzing internet information and providing accurate, helpful answers.'
        },
        { role: 'user', content: analysisPrompt }
      ], {
        temperature: 0.3,
        maxOutputTokens: 2000
      });
      
      // إضافة المصادر
      const sources = searchResults.slice(0, 3).map(r => `• ${r.title} - ${r.url}`).join('\n');
      const finalResponse = `${aiResponse.content}\n\n📚 المصادر:\n${sources}`;
      
      return {
        content: finalResponse,
        tools_used: ['search_internet', 'gemini_analysis'],
        metadata: {
          results_count: searchResults.length,
          sources: searchResults.slice(0, 3).map(r => r.url)
        }
      };
      
    } catch (error) {
      console.error('Search error:', error);
      return {
        content: lang === 'ar'
          ? '❌ حدث خطأ في البحث. يرجى المحاولة لاحقاً.'
          : '❌ Search error occurred. Please try again later.',
        tools_used: ['search_internet'],
        metadata: { error: error.message }
      };
    }
  }

  /**
   * البحث في DuckDuckGo (مجاني بدون API key)
   */
  async searchDuckDuckGo(query) {
    try {
      // استخدام DuckDuckGo Instant Answer API
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: 1,
          skip_disambig: 1
        },
        timeout: 10000
      });
      
      const data = response.data;
      const results = [];
      
      // إضافة النتيجة الرئيسية
      if (data.AbstractText) {
        results.push({
          title: data.Heading || 'معلومات عامة',
          snippet: data.AbstractText,
          url: data.AbstractURL || 'https://duckduckgo.com'
        });
      }
      
      // إضافة المواضيع ذات الصلة
      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        data.RelatedTopics.slice(0, 5).forEach(topic => {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.substring(0, 100),
              snippet: topic.Text,
              url: topic.FirstURL
            });
          }
        });
      }
      
      return results;
      
    } catch (error) {
      console.error('DuckDuckGo search error:', error);
      return [];
    }
  }

  /**
   * إنشاء صورة (سنستخدم Replicate API - مجاني)
   */
  async generateImage(description, lang = 'ar') {
    try {
      console.log(`🎨 Generating image: ${description}`);
      
      // للآن سنستخدم placeholder - يمكن تطويرها لاحقاً بـ Replicate API
      const imageInfo = {
        description: description,
        status: 'pending',
        message: lang === 'ar'
          ? `📝 تم استلام طلب إنشاء الصورة: "${description}"\n\n⚠️ لإنشاء الصور، نحتاج إلى إضافة Replicate API key.\n\nيمكنك الحصول عليه من: https://replicate.com\n\nميزات Replicate:\n• مجاني للاستخدام المحدود\n• يدعم Stable Diffusion و SDXL\n• جودة عالية\n• سريع\n\nبعد الحصول على API key، يمكنني إنشاء صور احترافية فوراً! 🎨`
          : `📝 Image generation request received: "${description}"\n\n⚠️ To generate images, we need to add Replicate API key.\n\nGet it from: https://replicate.com\n\nReplicate Features:\n• Free for limited use\n• Supports Stable Diffusion & SDXL\n• High quality\n• Fast\n\nOnce you add the API key, I can create professional images instantly! 🎨`
      };
      
      return {
        content: imageInfo.message,
        tools_used: ['generate_image'],
        metadata: imageInfo
      };
      
    } catch (error) {
      console.error('Image generation error:', error);
      return {
        content: lang === 'ar'
          ? '❌ حدث خطأ في إنشاء الصورة.'
          : '❌ Image generation error.',
        tools_used: ['generate_image'],
        metadata: { error: error.message }
      };
    }
  }

  /**
   * تحليل الكود
   */
  async analyzeCode(code, lang = 'ar') {
    try {
      const prompt = lang === 'ar'
        ? `قم بتحليل الكود التالي وقدم تحسينات وملاحظات:

\`\`\`
${code}
\`\`\`

يرجى تقديم:
1. تحليل شامل للكود
2. المشاكل المحتملة
3. تحسينات مقترحة
4. أفضل الممارسات
5. تقييم عام (ممتاز/جيد/يحتاج تحسين)`
        : `Analyze this code and provide improvements and notes:

\`\`\`
${code}
\`\`\`

Please provide:
1. Comprehensive code analysis
2. Potential issues
3. Suggested improvements
4. Best practices
5. Overall rating (Excellent/Good/Needs Improvement)`;

      const aiResponse = await this.aiService.chat([
        { role: 'system', content: lang === 'ar'
          ? 'أنت خبير برمجي متخصص في مراجعة وتحسين الأكواد. قدم تحليلات دقيقة ومفيدة.'
          : 'You are an expert programmer specialized in code review and improvement. Provide accurate and helpful analysis.'
        },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.2,
        maxOutputTokens: 3000
      });

      return {
        content: aiResponse.content,
        tools_used: ['analyze_code', 'gemini_analysis'],
        metadata: { code_length: code.length }
      };

    } catch (error) {
      console.error('Code analysis error:', error);
      return {
        content: lang === 'ar'
          ? '❌ حدث خطأ في تحليل الكود.'
          : '❌ Code analysis error.',
        tools_used: ['analyze_code'],
        metadata: { error: error.message }
      };
    }
  }

  /**
   * تحليل ملف
   */
  async analyzeFile(filePath, lang = 'ar') {
    try {
      const fullPath = path.resolve(__dirname, filePath);
      
      // التحقق من الأمان
      const relative = path.relative(__dirname, fullPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Access denied - security restriction');
      }
      
      const content = await fs.readFile(fullPath, 'utf-8');
      const fileExt = path.extname(filePath);
      
      let analysisType = 'general';
      if (['.js', '.ts', '.py', '.java', '.cpp'].includes(fileExt)) {
        analysisType = 'code';
      } else if (['.json', '.yaml', '.yml'].includes(fileExt)) {
        analysisType = 'config';
      }
      
      const prompt = lang === 'ar'
        ? `قم بتحليل الملف التالي (${filePath}):

\`\`\`
${content.substring(0, 5000)}${content.length > 5000 ? '\n... (truncated)' : ''}
\`\`\`

قدم تحليلاً شاملاً وملاحظات مفيدة.`
        : `Analyze this file (${filePath}):

\`\`\`
${content.substring(0, 5000)}${content.length > 5000 ? '\n... (truncated)' : ''}
\`\`\`

Provide comprehensive analysis and helpful notes.`;

      const aiResponse = await this.aiService.chat([
        { role: 'system', content: lang === 'ar'
          ? 'أنت محلل ملفات ذكي. قدم تحليلات مفصلة ومفيدة.'
          : 'You are an intelligent file analyzer. Provide detailed and helpful analysis.'
        },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,
        maxOutputTokens: 3000
      });

      return {
        content: `📁 تحليل الملف: ${filePath}\n\n${aiResponse.content}`,
        tools_used: ['analyze_file', 'gemini_analysis'],
        metadata: {
          file_path: filePath,
          file_size: content.length,
          analysis_type: analysisType
        }
      };

    } catch (error) {
      console.error('File analysis error:', error);
      return {
        content: lang === 'ar'
          ? `❌ حدث خطأ في تحليل الملف: ${error.message}`
          : `❌ File analysis error: ${error.message}`,
        tools_used: ['analyze_file'],
        metadata: { error: error.message }
      };
    }
  }

  /**
   * معالجة الملفات المرفقة
   */
  async processFiles(files, lang = 'ar') {
    const filesInfo = [];
    
    for (const file of files) {
      try {
        if (file.type === 'image') {
          filesInfo.push(`🖼️ صورة: ${file.name} (${file.size} bytes)`);
        } else if (file.type === 'document') {
          filesInfo.push(`📄 مستند: ${file.name}`);
        } else {
          filesInfo.push(`📎 ملف: ${file.name}`);
        }
      } catch (error) {
        console.error('File processing error:', error);
      }
    }
    
    return filesInfo.join('\n');
  }

  /**
   * المحادثة مع الذكاء الاصطناعي
   */
  async chatWithAI(userId, message, lang = 'ar', history = []) {
    try {
      const systemPrompt = systemPrompts[lang] || systemPrompts['ar'];

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message }
      ];

      const aiResponse = await this.aiService.chat(messages, {
        temperature: 0.7,
        maxOutputTokens: 2500
      });

      return {
        content: aiResponse.content,
        tools_used: ['gemini_chat'],
        metadata: {
          model: 'gemini-2.0-flash-exp',
          tokens: aiResponse.usage
        }
      };

    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  }

  /**
   * إدارة سجل المحادثات
   */
  getConversationHistory(userId) {
    if (!this.conversationHistory.has(userId)) {
      return [];
    }
    return this.conversationHistory.get(userId);
  }

  saveToHistory(userId, userMessage, aiResponse) {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }
    
    const history = this.conversationHistory.get(userId);
    history.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiResponse }
    );
    
    // الحفاظ على آخر N رسالة فقط
    if (history.length > this.maxHistoryLength * 2) {
      history.splice(0, 2);
    }
    
    this.conversationHistory.set(userId, history);
  }

  clearHistory(userId) {
    this.conversationHistory.delete(userId);
    return { success: true };
  }

  /**
   * الحصول على إحصائيات الخدمة
   */
  getStats() {
    return {
      activeConversations: this.conversationHistory.size,
      availableTools: Object.keys(this.tools).length,
      tools: this.tools,
      geminiEnabled: this.aiService.enabled
    };
  }

  /**
   * الحصول على أحدث الأخبار
   */
  async getLatestNews(topic, lang = 'ar') {
    return await this.searchAndAnalyze(`latest news about ${topic}`, lang);
  }

  /**
   * تحليل السوق
   */
  async analyzeMarket(asset, lang = 'ar') {
    const query = lang === 'ar'
      ? `أحدث تحليل وأخبار عن ${asset} في السوق`
      : `latest analysis and news about ${asset} in the market`;
    
    return await this.searchAndAnalyze(query, lang);
  }
}

// إنشاء instance واحدة (Singleton)
const advancedAIService = new AdvancedAIService();

module.exports = advancedAIService;
