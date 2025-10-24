/**
 * Batch Data Loader
 * لتحميل البيانات بشكل دفعي وتجنب N+1 queries
 * يدعم ملايين المستخدمين بكفاءة عالية
 * 
 * تم إعادة تصميمه لمنع فقدان الطلبات أثناء الـ flush المتزامن
 */

class BatchLoader {
  constructor(db) {
    this.db = db;
    this.batches = new Map();
  }

  /**
   * تحميل user بشكل batch
   */
  async loadUser(userId) {
    return this.load('users', 'user_id', userId);
  }

  /**
   * تحميل analyst بشكل batch
   */
  async loadAnalyst(analystId) {
    return this.load('analysts', 'user_id', analystId);
  }

  /**
   * تحميل عدة users مرة واحدة
   */
  async loadUsers(userIds) {
    if (!userIds || userIds.length === 0) return [];
    
    const results = await Promise.all(
      userIds.map(userId => this.loadUser(userId))
    );
    
    return results.filter(user => user !== null);
  }

  /**
   * الدالة الأساسية للتحميل
   * تستخدم snapshot لمنع فقدان الطلبات أثناء الـ flush
   */
  async load(collection, keyField, keyValue) {
    const batchKey = `${collection}:${keyField}`;
    
    if (!this.batches.has(batchKey)) {
      this.batches.set(batchKey, {
        keys: new Set(),
        promises: new Map(),
        timeout: null,
        isFlushing: false
      });
    }

    const batch = this.batches.get(batchKey);
    
    // إذا كان موجود مسبقاً، ننتظر نفس الـ Promise
    if (batch.promises.has(keyValue)) {
      return batch.promises.get(keyValue).promise;
    }

    // إنشاء promise جديد مع حفظ resolve و reject
    let promiseResolve, promiseReject;
    const promise = new Promise((resolve, reject) => {
      promiseResolve = resolve;
      promiseReject = reject;
    });
    
    // حفظ Promise مع resolve و reject functions
    batch.promises.set(keyValue, { 
      promise, 
      resolve: promiseResolve, 
      reject: promiseReject 
    });
    batch.keys.add(keyValue);
    
    // تجدول flush إذا لم يكن قيد التنفيذ
    if (!batch.timeout && !batch.isFlushing) {
      this.scheduleBatchFlush(batchKey, collection, keyField);
    }

    return promise;
  }

  /**
   * جدولة flush للـ batch
   */
  scheduleBatchFlush(batchKey, collection, keyField) {
    const batch = this.batches.get(batchKey);
    
    batch.timeout = setTimeout(async () => {
      batch.timeout = null;
      await this.flushBatch(batchKey, collection, keyField);
    }, 10); // تأخير 10ms لتجميع الطلبات
  }

  /**
   * تنفيذ flush للـ batch مع أخذ snapshot لمنع فقدان الطلبات الجديدة
   */
  async flushBatch(batchKey, collection, keyField) {
    const batch = this.batches.get(batchKey);
    if (!batch || batch.keys.size === 0) return;
    
    // منع flush متزامن
    if (batch.isFlushing) return;
    batch.isFlushing = true;
    
    // أخذ snapshot من الـ keys و promises الحالية قبل أي معالجة
    const keysToProcess = Array.from(batch.keys);
    const promisesToResolve = new Map();
    
    for (const key of keysToProcess) {
      promisesToResolve.set(key, batch.promises.get(key));
      batch.keys.delete(key);
      batch.promises.delete(key);
    }
    
    try {
      // تحميل البيانات من قاعدة البيانات
      const results = await this.db.collection(collection)
        .find({ [keyField]: { $in: keysToProcess } })
        .toArray();
      
      // إنشاء map للنتائج
      const resultMap = new Map(
        results.map(r => [r[keyField], r])
      );
      
      // حل جميع الـ promises من الـ snapshot
      for (const key of keysToProcess) {
        const promiseData = promisesToResolve.get(key);
        if (promiseData && promiseData.resolve) {
          const result = resultMap.get(key);
          promiseData.resolve(result || null);
        }
      }
      
    } catch (error) {
      console.error('Batch loader error:', error);
      
      // رفض الـ promises من الـ snapshot فقط (وليس الجديدة)
      for (const key of keysToProcess) {
        const promiseData = promisesToResolve.get(key);
        if (promiseData && promiseData.reject) {
          promiseData.reject(error);
        }
      }
    } finally {
      batch.isFlushing = false;
      
      // إذا كانت هناك keys جديدة، جدول flush جديد
      if (batch.keys.size > 0 && !batch.timeout) {
        this.scheduleBatchFlush(batchKey, collection, keyField);
      }
    }
  }

  /**
   * تنظيف فوري (للاستخدام في حالات خاصة)
   */
  clear() {
    for (const batch of this.batches.values()) {
      if (batch.timeout) {
        clearTimeout(batch.timeout);
      }
    }
    this.batches.clear();
  }
}

module.exports = { BatchLoader };
