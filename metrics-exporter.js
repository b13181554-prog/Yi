/**
 * Prometheus Metrics Exporter
 * تصدير مقاييس Prometheus لجميع الخدمات
 */

const promClient = require('prom-client');
const express = require('express');
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

// إنشاء Registry
const register = new promClient.Registry();

// إضافة Default metrics
promClient.collectDefaultMetrics({ register });

// Custom Metrics

// HTTP Requests
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

// Bot Updates
const botUpdatesTotal = new promClient.Counter({
  name: 'bot_updates_total',
  help: 'Total number of bot updates received',
  labelNames: ['update_type'],
  registers: [register]
});

const botUpdateProcessingDuration = new promClient.Histogram({
  name: 'bot_update_processing_duration_seconds',
  help: 'Duration of bot update processing in seconds',
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
});

// Queue Metrics
const queueJobsTotal = new promClient.Counter({
  name: 'queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue_name', 'status'],
  registers: [register]
});

const queueJobDuration = new promClient.Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue job processing',
  labelNames: ['queue_name'],
  buckets: [1, 5, 10, 30, 60, 120],
  registers: [register]
});

const queueSize = new promClient.Gauge({
  name: 'queue_size',
  help: 'Current size of the queue',
  labelNames: ['queue_name', 'status'],
  registers: [register]
});

// Database Metrics
const databaseQueriesTotal = new promClient.Counter({
  name: 'database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'collection'],
  registers: [register]
});

const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'collection'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register]
});

// Redis Metrics
const redisOperationsTotal = new promClient.Counter({
  name: 'redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation'],
  registers: [register]
});

// Active Connections
const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['type'],
  registers: [register]
});

// Error Metrics
const errorsTotal = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'service'],
  registers: [register]
});

/**
 * إضافة middleware لتتبع HTTP requests
 */
function httpMetricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestsTotal.labels(req.method, route, res.statusCode).inc();
    httpRequestDuration.labels(req.method, route, res.statusCode).observe(duration);
  });
  
  next();
}

/**
 * تتبع Bot updates
 */
function trackBotUpdate(updateType, duration) {
  botUpdatesTotal.labels(updateType).inc();
  if (duration) {
    botUpdateProcessingDuration.observe(duration);
  }
}

/**
 * تتبع Queue jobs
 */
function trackQueueJob(queueName, status, duration = null) {
  queueJobsTotal.labels(queueName, status).inc();
  if (duration) {
    queueJobDuration.labels(queueName).observe(duration);
  }
}

/**
 * تحديث حجم الـ queue
 */
function updateQueueSize(queueName, status, size) {
  queueSize.labels(queueName, status).set(size);
}

/**
 * تتبع Database queries
 */
function trackDatabaseQuery(operation, collection, duration) {
  databaseQueriesTotal.labels(operation, collection).inc();
  databaseQueryDuration.labels(operation, collection).observe(duration);
}

/**
 * تتبع Redis operations
 */
function trackRedisOperation(operation) {
  redisOperationsTotal.labels(operation).inc();
}

/**
 * تتبع Errors
 */
function trackError(type, service) {
  errorsTotal.labels(type, service).inc();
}

/**
 * تحديث Active connections
 */
function updateActiveConnections(type, count) {
  activeConnections.labels(type).set(count);
}

/**
 * إنشاء endpoint للـ metrics
 */
function createMetricsEndpoint(app) {
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error('Error generating metrics:', error);
      res.status(500).end();
    }
  });
  
  logger.info('✅ Metrics endpoint created at /metrics');
}

module.exports = {
  register,
  httpMetricsMiddleware,
  createMetricsEndpoint,
  trackBotUpdate,
  trackQueueJob,
  updateQueueSize,
  trackDatabaseQuery,
  trackRedisOperation,
  trackError,
  updateActiveConnections
};
