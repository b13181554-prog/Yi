/**
 * Flexible Action System
 * نظام مرن لإدارة الإجراءات والأوامر
 * 
 * Features:
 * - Custom action workflows
 * - Action chaining
 * - Conditional execution
 * - Scheduled actions
 * - Action history and rollback
 * - Dynamic action registration
 */

const { createLogger } = require('./centralized-logger');
const db = require('./database');
const cron = require('node-cron');

const logger = createLogger('action-system');

class FlexibleActionSystem {
  constructor() {
    this.actions = new Map();
    this.scheduledActions = new Map();
    this.actionHistory = [];
    this.maxHistorySize = 1000;
    
    this.registerDefaultActions();
  }

  registerDefaultActions() {
    this.registerAction('send_notification', async (context) => {
      const { user_id, message, options = {} } = context;
      const bot = require('./bot');
      
      await bot.sendMessage(user_id, message, options);
      
      return { success: true, action: 'notification_sent' };
    });

    this.registerAction('update_balance', async (context) => {
      const { user_id, amount, reason } = context;
      
      await db.updateUserBalance(user_id, amount);
      
      return { success: true, action: 'balance_updated', amount };
    });

    this.registerAction('grant_subscription', async (context) => {
      const { user_id, days = 30 } = context;
      
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
      
      await db.updateUser(user_id, {
        subscription_expires: expiryDate
      });
      
      return { success: true, action: 'subscription_granted', expires: expiryDate };
    });

    this.registerAction('make_analyst', async (context) => {
      const { user_id } = context;
      
      await db.updateUser(user_id, {
        is_analyst: true,
        analyst_since: new Date()
      });
      
      return { success: true, action: 'analyst_status_granted' };
    });

    this.registerAction('send_reward', async (context) => {
      const { user_id, amount, reason } = context;
      
      await db.updateUserBalance(user_id, amount);
      
      const bot = require('./bot');
      await bot.sendMessage(
        user_id,
        `🎁 تهانينا! لقد حصلت على مكافأة بقيمة ${amount} USDT\n\n📝 السبب: ${reason}`
      );
      
      return { success: true, action: 'reward_sent', amount };
    });

    this.registerAction('ban_user', async (context) => {
      const { user_id, reason } = context;
      
      await db.updateUser(user_id, {
        banned: true,
        ban_reason: reason,
        banned_at: new Date()
      });
      
      return { success: true, action: 'user_banned', reason };
    });

    logger.info('✅ Default actions registered');
  }

  registerAction(name, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new Error('Action handler must be a function');
    }

    this.actions.set(name, {
      handler,
      options: {
        requiresAuth: options.requiresAuth !== false,
        requiresAdmin: options.requiresAdmin || false,
        canRollback: options.canRollback || false,
        ...options
      },
      registeredAt: new Date()
    });

    logger.info({ name, options }, '✅ Action registered');

    return { success: true, action: name };
  }

  async executeAction(actionName, context = {}, executorId = null) {
    try {
      const action = this.actions.get(actionName);

      if (!action) {
        return {
          success: false,
          error: 'action_not_found',
          message: `الإجراء "${actionName}" غير موجود`
        };
      }

      if (action.options.requiresAuth && !context.user_id) {
        return {
          success: false,
          error: 'authentication_required',
          message: 'يجب تسجيل الدخول لتنفيذ هذا الإجراء'
        };
      }

      if (action.options.requiresAdmin) {
        const config = require('./config');
        if (executorId !== config.OWNER_ID) {
          return {
            success: false,
            error: 'admin_required',
            message: 'يتطلب هذا الإجراء صلاحيات المسؤول'
          };
        }
      }

      const startTime = Date.now();
      
      const result = await action.handler(context);

      const duration = Date.now() - startTime;

      await this.recordActionExecution({
        action_name: actionName,
        context,
        executor_id: executorId,
        result,
        duration,
        timestamp: Date.now()
      });

      logger.info({ 
        actionName, 
        executorId, 
        duration, 
        success: result.success 
      }, '✅ Action executed');

      return result;
    } catch (error) {
      logger.error({ err: error, actionName }, '❌ Action execution failed');
      
      return {
        success: false,
        error: 'execution_error',
        message: error.message
      };
    }
  }

  async executeChain(actions, context = {}, executorId = null) {
    const results = [];
    const chainContext = { ...context };

    for (const actionConfig of actions) {
      const { action, context: actionContext = {}, condition } = actionConfig;

      if (condition && !this.evaluateCondition(condition, chainContext)) {
        results.push({
          action,
          skipped: true,
          reason: 'condition_not_met'
        });
        continue;
      }

      const mergedContext = { ...chainContext, ...actionContext };
      
      const result = await this.executeAction(action, mergedContext, executorId);

      results.push({
        action,
        result
      });

      if (result.success) {
        Object.assign(chainContext, result);
      } else if (actionConfig.breakOnFailure !== false) {
        logger.warn({ action, chainContext }, '⚠️ Chain execution stopped due to failure');
        break;
      }
    }

    return {
      success: true,
      results,
      finalContext: chainContext
    };
  }

  evaluateCondition(condition, context) {
    try {
      if (typeof condition === 'function') {
        return condition(context);
      }

      if (typeof condition === 'object') {
        for (const [key, value] of Object.entries(condition)) {
          if (context[key] !== value) {
            return false;
          }
        }
        return true;
      }

      return Boolean(condition);
    } catch (error) {
      logger.error({ err: error, condition }, 'Error evaluating condition');
      return false;
    }
  }

  scheduleAction(name, actionName, context, cronExpression, executorId = null) {
    try {
      const task = cron.schedule(cronExpression, async () => {
        logger.info({ name, actionName }, '⏰ Executing scheduled action');
        await this.executeAction(actionName, context, executorId);
      });

      this.scheduledActions.set(name, {
        task,
        actionName,
        context,
        cronExpression,
        executorId,
        createdAt: new Date()
      });

      logger.info({ 
        name, 
        actionName, 
        cronExpression 
      }, '📅 Action scheduled');

      return {
        success: true,
        scheduled_name: name,
        cron: cronExpression
      };
    } catch (error) {
      logger.error({ err: error, name }, '❌ Failed to schedule action');
      return {
        success: false,
        error: error.message
      };
    }
  }

  cancelScheduledAction(name) {
    const scheduled = this.scheduledActions.get(name);

    if (!scheduled) {
      return {
        success: false,
        error: 'scheduled_action_not_found'
      };
    }

    scheduled.task.stop();
    this.scheduledActions.delete(name);

    logger.info({ name }, '🗑️ Scheduled action cancelled');

    return { success: true };
  }

  async recordActionExecution(executionData) {
    try {
      this.actionHistory.push(executionData);

      if (this.actionHistory.length > this.maxHistorySize) {
        this.actionHistory.shift();
      }

      const database = db.getDB();
      const actions = database.collection('action_executions');

      await actions.insertOne({
        ...executionData,
        created_at: new Date()
      });

      return { success: true };
    } catch (error) {
      logger.error({ err: error }, 'Error recording action execution');
      throw error;
    }
  }

  async getActionHistory(filters = {}) {
    try {
      const database = db.getDB();
      const actions = database.collection('action_executions');

      const query = {};

      if (filters.action_name) {
        query.action_name = filters.action_name;
      }

      if (filters.executor_id) {
        query.executor_id = filters.executor_id;
      }

      if (filters.from_date) {
        query.timestamp = { $gte: new Date(filters.from_date).getTime() };
      }

      const limit = Math.min(filters.limit || 50, 200);

      const history = await actions
        .find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      return {
        success: true,
        history,
        count: history.length
      };
    } catch (error) {
      logger.error({ err: error, filters }, '❌ Error getting action history');
      return {
        success: false,
        error: error.message
      };
    }
  }

  getRegisteredActions() {
    const actionsList = [];

    for (const [name, action] of this.actions.entries()) {
      actionsList.push({
        name,
        options: action.options,
        registered_at: action.registeredAt
      });
    }

    return {
      success: true,
      actions: actionsList,
      count: actionsList.length
    };
  }

  getScheduledActions() {
    const scheduledList = [];

    for (const [name, scheduled] of this.scheduledActions.entries()) {
      scheduledList.push({
        name,
        action_name: scheduled.actionName,
        cron_expression: scheduled.cronExpression,
        created_at: scheduled.createdAt
      });
    }

    return {
      success: true,
      scheduled_actions: scheduledList,
      count: scheduledList.length
    };
  }

  async executeTemplate(templateName, context = {}, executorId = null) {
    const templates = {
      welcome_new_user: [
        {
          action: 'send_notification',
          context: {
            message: '🎉 مرحباً بك في OBENTCHI! نحن سعداء بانضمامك إلينا.'
          }
        },
        {
          action: 'update_balance',
          context: { amount: 10, reason: 'bonus_new_user' }
        },
        {
          action: 'send_notification',
          context: {
            message: '🎁 حصلت على مكافأة ترحيب: 10 USDT'
          }
        }
      ],
      
      reward_top_analyst: [
        {
          action: 'update_balance',
          context: { amount: 500, reason: 'top_analyst_reward' }
        },
        {
          action: 'send_notification',
          context: {
            message: '🏆 تهانينا! لقد حصلت على جائزة أفضل محلل: 500 USDT'
          }
        }
      ],
      
      monthly_vip_bonus: [
        {
          action: 'update_balance',
          context: { amount: 100, reason: 'monthly_vip_bonus' }
        },
        {
          action: 'send_notification',
          context: {
            message: '💎 مكافأة VIP الشهرية: 100 USDT'
          }
        }
      ]
    };

    const template = templates[templateName];

    if (!template) {
      return {
        success: false,
        error: 'template_not_found'
      };
    }

    const actions = template.map(t => ({
      ...t,
      context: { ...context, ...t.context }
    }));

    return await this.executeChain(actions, context, executorId);
  }
}

const actionSystem = new FlexibleActionSystem();

module.exports = actionSystem;
