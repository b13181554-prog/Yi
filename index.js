#!/usr/bin/env node

/**
 * OBENTCHI Trading Bot - Main Entry Point
 * Unified Webhook Server for AWS Deployment Only
 */

require('dotenv').config();

const { startUnifiedServer } = require('./services/unified-webhook-server');

console.log('🚀 Starting OBENTCHI Trading Bot...');
console.log('📡 Mode: Webhook Server (AWS)');
console.log('');

startUnifiedServer();
