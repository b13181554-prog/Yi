const axios = require('axios');

async function testPrices() {
  console.log('🧪 Testing API prices...\n');
  
  // Test Yahoo Finance for stocks
  console.log('1️⃣ Testing Yahoo Finance (Stock - AAPL):');
  try {
    const response = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d', { timeout: 10000 });
    const quote = response.data.chart.result[0].indicators.quote[0];
    const lastClose = quote.close[quote.close.length - 1];
    console.log(`   ✅ AAPL Price: $${lastClose.toFixed(2)}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test Yahoo Finance for commodity (Gold)
  console.log('\n2️⃣ Testing Yahoo Finance (Gold - GC=F):');
  try {
    const response = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d', { timeout: 10000 });
    const quote = response.data.chart.result[0].indicators.quote[0];
    const lastClose = quote.close[quote.close.length - 1];
    console.log(`   ✅ Gold Price: $${lastClose.toFixed(2)}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test Yahoo Finance for index (S&P 500)
  console.log('\n3️⃣ Testing Yahoo Finance (S&P 500 - ^GSPC):');
  try {
    const response = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/^GSPC?interval=1d&range=1d', { timeout: 10000 });
    const quote = response.data.chart.result[0].indicators.quote[0];
    const lastClose = quote.close[quote.close.length - 1];
    console.log(`   ✅ S&P 500: ${lastClose.toFixed(2)}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test Frankfurter for Forex
  console.log('\n4️⃣ Testing Frankfurter API (EUR/USD):');
  try {
    const response = await axios.get('https://api.frankfurter.app/latest?from=EUR&to=USD', { timeout: 10000 });
    const rate = response.data.rates.USD;
    console.log(`   ✅ EUR/USD: ${rate.toFixed(5)}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  console.log('\n✅ Price testing completed!\n');
}

testPrices().catch(console.error);
