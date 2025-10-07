const multiMarketData = require('./multi-market-data');

async function testMarketData() {
  console.log('🧪 Testing Market Data Service...\n');
  
  try {
    // Test Stock Candles
    console.log('1️⃣ Testing Stock Candles (AAPL):');
    const stockCandles = await multiMarketData.getStockCandles('AAPL', '1d', 5);
    console.log(`   ✅ Got ${stockCandles.length} candles`);
    console.log(`   Last candle close: $${stockCandles[stockCandles.length - 1].close}`);
    
    // Test Commodity Candles
    console.log('\n2️⃣ Testing Commodity Candles (Gold - XAUUSD):');
    const commodityCandles = await multiMarketData.getCommodityCandles('XAUUSD', '1d', 5);
    console.log(`   ✅ Got ${commodityCandles.length} candles`);
    console.log(`   Last candle close: $${commodityCandles[commodityCandles.length - 1].close}`);
    
    // Test Index Candles
    console.log('\n3️⃣ Testing Index Candles (S&P 500 - SPX500):');
    const indexCandles = await multiMarketData.getIndicesCandles('SPX500', '1d', 5);
    console.log(`   ✅ Got ${indexCandles.length} candles`);
    console.log(`   Last candle close: ${indexCandles[indexCandles.length - 1].close}`);
    
    // Test Forex Price
    console.log('\n4️⃣ Testing Forex Price (EURUSD):');
    const forexPrice = await multiMarketData.getForexPrice('EURUSD');
    console.log(`   ✅ EUR/USD: ${forexPrice.toFixed(5)}`);
    
    // Test Forex Candles
    console.log('\n5️⃣ Testing Forex Candles (EURUSD):');
    const forexCandles = await multiMarketData.getForexCandles('EURUSD', '1d', 5);
    console.log(`   ✅ Got ${forexCandles.length} candles`);
    console.log(`   Last candle close: ${forexCandles[forexCandles.length - 1].close}`);
    
    console.log('\n✅ All market data tests passed!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMarketData();
