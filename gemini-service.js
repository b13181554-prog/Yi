/**
 * Google Gemini AI Service
 * خدمة الذكاء الاصطناعي من Google Gemini
 * 
 * Features:
 * - مجاني تماماً
 * - بدون حدود يومية (1500 طلب/يوم)
 * - يدعم إنشاء وتحليل الصور
 * - يدعم تحليل الفيديوهات
 * - سريع جداً
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const pino = require('pino');

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

class GeminiService {
  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      logger.warn('⚠️ GOOGLE_API_KEY not found. Gemini Service will not work.');
      this.enabled = false;
      return;
    }
    
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    this.enabled = true;
    
    // نماذج متاحة
    this.models = {
      chat: 'gemini-1.5-flash',        // سريع ومجاني
      pro: 'gemini-1.5-pro',           // أقوى وأذكى
      vision: 'gemini-1.5-flash',      // لتحليل الصور والفيديو
    };
    
    // إحصائيات الاستخدام
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      imageGenerations: 0,
      videoAnalysis: 0,
      lastReset: Date.now()
    };
    
    logger.info('✅ Google Gemini Service initialized - Unlimited & Free!');
  }
  
  /**
   * محادثة نصية مع Gemini
   */
  async chat(messages, options = {}) {
    if (!this.enabled) {
      logger.error('❌ Gemini Service is disabled - no API key');
      throw new Error('Gemini Service is not available');
    }
    
    this.stats.totalRequests++;
    
    try {
      const {
        model = this.models.chat,
        temperature = 0.7,
        maxOutputTokens = 2048
      } = options;
      
      const geminiModel = this.genAI.getGenerativeModel({ 
        model,
        generationConfig: {
          temperature,
          maxOutputTokens
        }
      });
      
      // تحويل الرسائل إلى تنسيق Gemini
      const history = this.convertMessages(messages);
      
      // إنشاء جلسة محادثة
      const chat = geminiModel.startChat({
        history: history.slice(0, -1) // كل الرسائل ما عدا الأخيرة
      });
      
      // إرسال الرسالة الأخيرة
      const lastMessage = history[history.length - 1];
      const result = await chat.sendMessage(lastMessage.parts);
      const response = await result.response;
      
      this.stats.successfulRequests++;
      
      return {
        content: response.text(),
        model: model,
        isError: false,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0
        }
      };
      
    } catch (error) {
      this.stats.failedRequests++;
      logger.error({ err: error }, '❌ Gemini API Error');
      throw error;
    }
  }
  
  /**
   * تحويل الرسائل من تنسيق OpenAI إلى تنسيق Gemini
   */
  convertMessages(messages) {
    const geminiMessages = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        // دمج رسالة النظام مع أول رسالة مستخدم
        continue;
      }
      
      geminiMessages.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
    
    // إضافة رسالة النظام في البداية
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage && geminiMessages.length > 0) {
      geminiMessages[0].parts[0].text = 
        `${systemMessage.content}\n\n${geminiMessages[0].parts[0].text}`;
    }
    
    return geminiMessages;
  }
  
  /**
   * تحليل صورة
   */
  async analyzeImage(imageData, prompt, options = {}) {
    if (!this.enabled) {
      throw new Error('Gemini Service is not available');
    }
    
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.models.vision 
      });
      
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageData.toString('base64'),
            mimeType: options.mimeType || 'image/jpeg'
          }
        }
      ]);
      
      const response = await result.response;
      return {
        content: response.text(),
        isError: false
      };
      
    } catch (error) {
      logger.error({ err: error }, '❌ Gemini Image Analysis Error');
      throw error;
    }
  }
  
  /**
   * تحليل فيديو
   */
  async analyzeVideo(videoData, prompt, options = {}) {
    if (!this.enabled) {
      throw new Error('Gemini Service is not available');
    }
    
    this.stats.videoAnalysis++;
    
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.models.vision 
      });
      
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: videoData.toString('base64'),
            mimeType: options.mimeType || 'video/mp4'
          }
        }
      ]);
      
      const response = await result.response;
      return {
        content: response.text(),
        isError: false
      };
      
    } catch (error) {
      logger.error({ err: error }, '❌ Gemini Video Analysis Error');
      throw error;
    }
  }
  
  /**
   * الحصول على إحصائيات الخدمة
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.lastReset,
      successRate: this.stats.totalRequests > 0 
        ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }
  
  /**
   * إعادة تعيين الإحصائيات
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      imageGenerations: 0,
      videoAnalysis: 0,
      lastReset: Date.now()
    };
    logger.info('📊 Gemini stats reset');
  }
}

// إنشاء instance واحدة (Singleton)
const geminiService = new GeminiService();

module.exports = geminiService;
