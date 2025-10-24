/**
 * Analysis Fee Manager
 * نظام مركزي قوي لإدارة رسوم التحليل
 * 
 * الميزات:
 * - خصم فوري سريع
 * - استرجاع تلقائي ذكي بناءً على جودة الإشارة
 * - معالجة أخطاء شاملة
 * - logging مفصل
 * - validation قوي
 */

const { createLogger } = require('./centralized-logger');
const db = require('./database');

const logger = createLogger('analysis-fee-manager');

class AnalysisFeeManager {
  constructor() {
    this.ANALYSIS_FEE = 0.1;
    this.QUALITY_THRESHOLD = 60;
  }

  /**
   * استخراج نسبة جودة الإشارة من نتيجة التحليل
   * @param {Object} analysisResult - نتيجة التحليل
   * @returns {number} - نسبة الجودة (0-100)
   */
  extractSignalQuality(analysisResult) {
    try {
      let quality = 0;
      
      // محاولة الحصول على agreementPercentage من scores
      if (analysisResult?.scores?.agreementPercentage) {
        const qualityStr = analysisResult.scores.agreementPercentage;
        
        if (typeof qualityStr === 'string') {
          quality = parseFloat(qualityStr.replace('%', ''));
        } else if (typeof qualityStr === 'number') {
          quality = qualityStr;
        }
      }
      
      // محاولة بديلة من confidence
      if ((!quality || quality === 0) && analysisResult?.confidence) {
        const confidenceStr = analysisResult.confidence;
        
        if (typeof confidenceStr === 'string') {
          quality = parseFloat(confidenceStr.replace('%', ''));
        } else if (typeof confidenceStr === 'number') {
          quality = confidenceStr * 100;
        }
      }
      
      // محاولة أخرى من signalStrength
      if ((!quality || quality === 0) && analysisResult?.signalStrength) {
        quality = analysisResult.signalStrength * 10;
      }
      
      // محاولة من totalScore
      if ((!quality || quality === 0) && analysisResult?.totalScore) {
        quality = Math.min(100, Math.abs(analysisResult.totalScore) * 10);
      }
      
      // التأكد من أن القيمة رقم صحيح بين 0 و 100
      quality = parseFloat(quality) || 0;
      quality = Math.max(0, Math.min(100, quality));
      
      logger.info(`Signal quality extracted: ${quality.toFixed(1)}%`, {
        hasScores: !!analysisResult?.scores,
        hasAgreementPercentage: !!analysisResult?.scores?.agreementPercentage,
        hasConfidence: !!analysisResult?.confidence,
        finalQuality: quality
      });
      
      return quality;
    } catch (error) {
      logger.error('Error extracting signal quality:', error);
      return 0;
    }
  }

  /**
   * خصم رسوم التحليل من رصيد المستخدم
   * @param {number} userId - معرف المستخدم
   * @param {string} symbol - رمز العملة/الأصل
   * @param {string} analysisType - نوع التحليل
   * @param {string} marketType - نوع السوق
   * @returns {Object} - نتيجة الخصم
   */
  async deductFee(userId, symbol, analysisType, marketType) {
    const startTime = Date.now();
    
    try {
      logger.info(`Deducting analysis fee for user ${userId}`, {
        symbol,
        analysisType,
        marketType,
        fee: this.ANALYSIS_FEE
      });
      
      const result = await db.deductAnalysisFee(
        userId, 
        this.ANALYSIS_FEE, 
        symbol, 
        analysisType, 
        marketType
      );
      
      const duration = Date.now() - startTime;
      
      if (result.success) {
        logger.info(`✅ Fee deducted successfully in ${duration}ms`, {
          userId,
          newBalance: result.new_balance,
          transactionId: result.transaction_id
        });
      } else {
        logger.warn(`⚠️ Fee deduction failed in ${duration}ms`, {
          userId,
          error: result.error
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Fee deduction error in ${duration}ms:`, error);
      
      return {
        success: false,
        error: 'حدث خطأ أثناء خصم رسوم التحليل: ' + error.message
      };
    }
  }

  /**
   * فحص جودة الإشارة واسترجاع الرسوم إذا كانت ضعيفة
   * @param {number} userId - معرف المستخدم
   * @param {Object} analysisResult - نتيجة التحليل
   * @param {string} transactionId - معرف المعاملة
   * @returns {Object} - نتيجة الفحص
   */
  async checkQualityAndRefund(userId, analysisResult, transactionId) {
    const startTime = Date.now();
    
    try {
      if (!transactionId) {
        logger.warn('No transaction ID provided for quality check');
        return {
          shouldRefund: false,
          quality: 0,
          reason: 'No transaction to refund'
        };
      }
      
      const quality = this.extractSignalQuality(analysisResult);
      
      logger.info(`Checking signal quality: ${quality.toFixed(1)}%`, {
        userId,
        transactionId,
        threshold: this.QUALITY_THRESHOLD
      });
      
      if (quality < this.QUALITY_THRESHOLD) {
        // جودة منخفضة - استرجاع المبلغ
        const reason = `جودة الإشارة منخفضة (${quality.toFixed(1)}%) - تم استرجاع المبلغ`;
        
        const refundResult = await db.refundAnalysisFee(
          userId,
          this.ANALYSIS_FEE,
          transactionId,
          reason
        );
        
        const duration = Date.now() - startTime;
        
        if (refundResult.success) {
          logger.info(`💰 Refund completed in ${duration}ms`, {
            userId,
            quality: quality.toFixed(1),
            amount: this.ANALYSIS_FEE
          });
        } else {
          logger.error(`❌ Refund failed in ${duration}ms`, {
            userId,
            error: refundResult.error
          });
        }
        
        return {
          shouldRefund: true,
          refunded: refundResult.success,
          quality: quality.toFixed(1),
          reason: reason,
          refundResult
        };
      } else {
        // جودة جيدة - لا استرجاع
        const duration = Date.now() - startTime;
        
        logger.info(`✅ Good quality signal in ${duration}ms - No refund`, {
          userId,
          quality: quality.toFixed(1),
          threshold: this.QUALITY_THRESHOLD
        });
        
        return {
          shouldRefund: false,
          quality: quality.toFixed(1),
          reason: `إشارة جيدة (${quality.toFixed(1)}%) - تم الاحتفاظ بالرسوم`
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Quality check error in ${duration}ms:`, error);
      
      return {
        shouldRefund: false,
        quality: 0,
        reason: 'Error checking quality: ' + error.message,
        error: error.message
      };
    }
  }

  /**
   * استرجاع الرسوم في حالة فشل التحليل
   * @param {number} userId - معرف المستخدم
   * @param {string} transactionId - معرف المعاملة
   * @param {string} reason - سبب الفشل
   * @returns {Object} - نتيجة الاسترجاع
   */
  async refundOnFailure(userId, transactionId, reason) {
    const startTime = Date.now();
    
    try {
      if (!transactionId) {
        logger.warn('No transaction ID provided for refund');
        return {
          success: false,
          error: 'No transaction to refund'
        };
      }
      
      logger.info(`Refunding due to failure: ${reason}`, {
        userId,
        transactionId
      });
      
      const result = await db.refundAnalysisFee(
        userId,
        this.ANALYSIS_FEE,
        transactionId,
        `فشل التحليل: ${reason}`
      );
      
      const duration = Date.now() - startTime;
      
      if (result.success) {
        logger.info(`💰 Failure refund completed in ${duration}ms`, {
          userId,
          amount: this.ANALYSIS_FEE
        });
      } else {
        logger.error(`❌ Failure refund failed in ${duration}ms`, {
          userId,
          error: result.error
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Failure refund error in ${duration}ms:`, error);
      
      return {
        success: false,
        error: 'حدث خطأ أثناء استرجاع الرسوم: ' + error.message
      };
    }
  }

  /**
   * معالجة كاملة لرسوم التحليل - من الخصم إلى الفحص والاسترجاع
   * @param {Object} params - معاملات المعالجة
   * @returns {Object} - نتيجة المعالجة
   */
  async processFee({
    userId,
    paymentMode,
    symbol,
    analysisType,
    marketType,
    analysisResult,
    checkQuality = true
  }) {
    const result = {
      transactionId: null,
      feeDeducted: false,
      qualityChecked: false,
      refunded: false,
      quality: 0,
      error: null
    };
    
    try {
      // إذا لم يكن نظام الدفع لكل تحليل، لا حاجة لمعالجة الرسوم
      if (paymentMode !== 'per_analysis') {
        return result;
      }
      
      // خصم الرسوم
      const deductResult = await this.deductFee(userId, symbol, analysisType, marketType);
      
      if (!deductResult.success) {
        result.error = deductResult.error;
        return result;
      }
      
      result.transactionId = deductResult.transaction_id;
      result.feeDeducted = true;
      
      // فحص الجودة واسترجاع إذا لزم الأمر (بعد اكتمال التحليل)
      if (checkQuality && analysisResult) {
        const qualityResult = await this.checkQualityAndRefund(
          userId,
          analysisResult,
          result.transactionId
        );
        
        result.qualityChecked = true;
        result.quality = qualityResult.quality;
        result.refunded = qualityResult.shouldRefund && qualityResult.refunded;
      }
      
      return result;
    } catch (error) {
      logger.error('Error processing fee:', error);
      result.error = error.message;
      return result;
    }
  }
}

// إنشاء instance واحدة للاستخدام
const analysisFeeManager = new AnalysisFeeManager();

module.exports = analysisFeeManager;
