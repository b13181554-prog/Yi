if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN environment variable is required');
  throw new Error('BOT_TOKEN is required but not found in environment variables');
}

if (!process.env.MONGODB_PASSWORD) {
  console.error('❌ MONGODB_PASSWORD environment variable is required');
  throw new Error('MONGODB_PASSWORD is required but not found in environment variables');
}

module.exports = { 
  BOT_TOKEN: process.env.BOT_TOKEN,
  OWNER_ID: 7594466342,
  CHANNEL_USERNAME: '@ME_MAGDY_TRADING',
  CHANNEL_ID: -1002776929451,
  
  BOT_WALLET_ADDRESS: 'TCZwoWnmi8uBssqjtKGmUwAjToAxcJkjLP',
  
  SUBSCRIPTION_PRICE: 10,
  WITHDRAWAL_FEE: 1,
  FREE_TRIAL_DAYS: 7,
  
  MONGODB_URI: `mongodb+srv://mjdymr816_db_user:${process.env.MONGODB_PASSWORD}@cluster0.m97dto9.mongodb.net/obentchi_bot?retryWrites=true&w=majority&appName=Cluster0`,
  MONGODB_DB_NAME: 'obentchi_bot',
  
  PROXY_URL: process.env.PROXY_URL || null,
  
  MAX_WITHDRAWAL_AMOUNT: 1000,
  MIN_DEPOSIT_AMOUNT: 1,
  MAX_REQUESTS_PER_MINUTE: 30,
  
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || null,
  FOREX_API_KEY: process.env.FOREX_API_KEY || null,
  CURRENCY_API_KEY: process.env.CURRENCY_API_KEY || null,
  CURRENCY_FREAKS_API_KEY: process.env.CURRENCY_FREAKS_API_KEY || null,
  
  BINANCE_API_KEY: process.env.BINANCE_API_KEY || null,
  BINANCE_SECRET_KEY: process.env.BINANCE_SECRET_KEY || null,
  
  WEBAPP_URL: process.env.WEBAPP_URL 
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
    || 'https://your-repl-name.your-username.replit.dev',
};
