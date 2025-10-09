const requiredEnvVars = ['BOT_TOKEN', 'MONGODB_PASSWORD', 'OWNER_ID', 'MONGODB_USER'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ ${envVar} environment variable is required`);
    throw new Error(`${envVar} is required but not found in environment variables`);
  }
}

module.exports = { 
  BOT_TOKEN: process.env.BOT_TOKEN,
  OWNER_ID: parseInt(process.env.OWNER_ID),
  CHANNEL_USERNAME: process.env.CHANNEL_USERNAME || '@ME_MAGDY_TRADING',
  CHANNEL_ID: parseInt(process.env.CHANNEL_ID || '-1002776929451'),
  
  BOT_WALLET_ADDRESS: process.env.BOT_WALLET_ADDRESS || 'TCZwoWnmi8uBssqjtKGmUwAjToAxcJkjLP',
  
  SUBSCRIPTION_PRICE: parseInt(process.env.SUBSCRIPTION_PRICE) || 10,
  PUMP_SUBSCRIPTION_PRICE: parseInt(process.env.PUMP_SUBSCRIPTION_PRICE) || 25,
  WITHDRAWAL_FEE: parseInt(process.env.WITHDRAWAL_FEE) || 1,
  FREE_TRIAL_DAYS: parseInt(process.env.FREE_TRIAL_DAYS) || 7,
  
  MONGODB_URI: `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@cluster0.m97dto9.mongodb.net/obentchi_bot?retryWrites=true&w=majority&appName=Cluster0`,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'obentchi_bot',
  
  PROXY_URL: process.env.PROXY_URL || null,
  
  MAX_WITHDRAWAL_AMOUNT: 1000,
  MIN_DEPOSIT_AMOUNT: 1,
  MAX_REQUESTS_PER_MINUTE: 30,
  
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || null,
  FOREX_API_KEY: process.env.FOREX_API_KEY || null,
  CURRENCY_API_KEY: process.env.CURRENCY_API_KEY || null,
  CURRENCY_FREAKS_API_KEY: process.env.CURRENCY_FREAKS_API_KEY || null,
  
  OKX_API_KEY: process.env.OKX_API_KEY || null,
  OKX_SECRET_KEY: process.env.OKX_SECRET_KEY || null,
  OKX_PASSPHRASE: process.env.OKX_PASSPHRASE || null,
  
  WEBAPP_URL: process.env.WEBAPP_URL 
    || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}` : null)
    || 'https://obentchi-bot.replit.app',
};
