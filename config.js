const { getWebhookConfig, getEnvironmentInfo } = require('./environment-detector');

const requiredEnvVars = ['BOT_TOKEN', 'MONGODB_PASSWORD', 'OWNER_ID', 'MONGODB_USER', 'MONGODB_CLUSTER', 'CHANNEL_ID'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ ${envVar} environment variable is required`);
    throw new Error(`${envVar} is required but not found in environment variables`);
  }
}

const webhookConfig = getWebhookConfig();

const isReplit = !!(process.env.REPLIT_DB_URL || process.env.REPL_ID || process.env.REPL_OWNER);
if (!isReplit && !process.env.PUBLIC_URL) {
  console.error(`❌ PUBLIC_URL environment variable is required for AWS/Production deployment`);
  throw new Error(`PUBLIC_URL is required in AWS/Production environment`);
}

if (!webhookConfig.publicUrl) {
  console.error(`❌ Cannot determine public URL. Set PUBLIC_URL or ensure REPLIT_DOMAINS is available`);
  throw new Error(`PUBLIC_URL detection failed`);
}

const baseConfig = { 
  BOT_TOKEN: process.env.BOT_TOKEN,
  OWNER_ID: parseInt(process.env.OWNER_ID),
  CHANNEL_USERNAME: process.env.CHANNEL_USERNAME || '@ME_MAGDY_TRADING',
  CHANNEL_ID: parseInt(process.env.CHANNEL_ID),
  
  BOT_WALLET_ADDRESS: process.env.BOT_WALLET_ADDRESS || 'TCZwoWnmi8uBssqjtKGmUwAjToAxcJkjLP',
  
  CRYPTAPI_CALLBACK_URL: process.env.CRYPTAPI_CALLBACK_URL || 
    (webhookConfig.publicUrl ? `${webhookConfig.publicUrl}/api/payment/callback` : null),
  
  SUBSCRIPTION_PRICE: parseInt(process.env.SUBSCRIPTION_PRICE) || 10,
  PUMP_SUBSCRIPTION_PRICE: parseInt(process.env.PUMP_SUBSCRIPTION_PRICE) || 5,
  WITHDRAWAL_FEE: parseInt(process.env.WITHDRAWAL_FEE) || 1,
  FREE_TRIAL_DAYS: parseInt(process.env.FREE_TRIAL_DAYS) || 7,
  
  MONGODB_URI: `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}/obentchi_bot?retryWrites=true&w=majority&appName=Cluster0`,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'obentchi_bot',
  
  PROXY_URL: process.env.PROXY_URL || null,
  
  MAX_WITHDRAWAL_AMOUNT: 1000,
  MIN_DEPOSIT_AMOUNT: 1,
  MAX_REQUESTS_PER_MINUTE: 30,
  
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || null,
  FOREX_API_KEY: process.env.FOREX_API_KEY || null,
  CURRENCY_API_KEY: process.env.CURRENCY_API_KEY || null,
  CURRENCY_FREAKS_API_KEY: process.env.CURRENCY_FREAKS_API_KEY || null,
  ALPHA_VANTAGE_API_KEY: process.env.ALPHA_VANTAGE_API_KEY || null,
  WHALE_ALERT_API_KEY: process.env.WHALE_ALERT_API_KEY || null,
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || null,
  BSCSCAN_API_KEY: process.env.BSCSCAN_API_KEY || null,
  
  OKX_API_KEY: process.env.OKX_API_KEY || null,
  OKX_SECRET_KEY: process.env.OKX_SECRET_KEY || null,
  OKX_PASSPHRASE: process.env.OKX_PASSPHRASE || null,
  
  AI_FEATURES_ENABLED: process.env.AI_FEATURES_ENABLED === 'true',
  
  WEBAPP_URL: webhookConfig.publicUrl,
  
  WEBHOOK_CONFIG: webhookConfig,
  ENVIRONMENT: getEnvironmentInfo()
};

module.exports = baseConfig;
