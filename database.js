const { MongoClient, ObjectId } = require('mongodb');
const config = require('./config');

let db = null;
let client = null;

async function initDatabase() {
  try {
    client = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      tls: true,
      tlsAllowInvalidCertificates: false,
    });
    
    await client.connect();
    db = client.db(config.MONGODB_DB_NAME);
    
    await db.collection('users').createIndex({ user_id: 1 }, { unique: true });
    await db.collection('users').createIndex({ referred_by: 1 });
    await db.collection('transactions').createIndex({ user_id: 1 });
    await db.collection('transactions').createIndex({ tx_id: 1 });
    await db.collection('analysts').createIndex({ user_id: 1 });
    
    await db.collection('analysts').deleteMany({ 
      $or: [
        { name: null }, 
        { name: '' },
        { name: { $exists: false } }
      ] 
    });
    
    try {
      await db.collection('analysts').createIndex(
        { name: 1 }, 
        { 
          unique: true, 
          sparse: true,
          collation: { locale: 'en', strength: 2 }
        }
      );
      console.log('✅ Analyst name unique index created successfully');
    } catch (indexError) {
      if (indexError.code === 11000 || indexError.code === 85 || indexError.code === 86) {
        console.log('⚠️ Analyst name index already exists or has conflicts, skipping...');
      } else {
        throw indexError;
      }
    }
    
    await db.collection('analyst_subscriptions').createIndex({ user_id: 1, analyst_id: 1 });
    await db.collection('referral_earnings').createIndex({ referrer_id: 1 });
    
    console.log('✅ Database connected and indexes created successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

async function getUser(userId) {
  return await db.collection('users').findOne({ user_id: userId });
}

async function createUser(userId, username, firstName, lastName, referredBy = null, referredByAnalyst = null) {
  const freeTrialStart = new Date();
  const user = {
    user_id: userId,
    username: username,
    first_name: firstName,
    last_name: lastName,
    created_at: new Date(),
    free_trial_start: freeTrialStart,
    free_trial_used: false,
    subscription_expires: null,
    balance: 0,
    selected_symbol: 'BTCUSDT',
    selected_timeframe: '1h',
    selected_indicators: null,
    market_type: 'crypto',
    temp_withdrawal_address: null,
    is_active: true,
    referred_by: referredBy,
    referred_by_analyst: referredByAnalyst,
    referral_earnings: 0,
    language: 'ar',
    notifications_enabled: true
  };
  
  await db.collection('users').updateOne(
    { user_id: userId },
    { $set: user },
    { upsert: true }
  );
  
  return user;
}

async function updateUserBalance(userId, amount) {
  const result = await db.collection('users').findOneAndUpdate(
    { user_id: userId },
    { $inc: { balance: amount } },
    { returnDocument: 'after' }
  );
  return result.value;
}

async function getUserBalance(userId) {
  const user = await getUser(userId);
  return user?.balance || 0;
}

async function isSubscriptionActive(userId) {
  const user = await getUser(userId);
  if (!user) return false;
  
  const now = new Date();
  
  if (!user.free_trial_used && user.free_trial_start) {
    const trialEnd = new Date(user.free_trial_start);
    trialEnd.setDate(trialEnd.getDate() + config.FREE_TRIAL_DAYS);
    if (now < trialEnd) {
      return true;
    }
  }
  
  if (user.subscription_expires && new Date(user.subscription_expires) > now) {
    return true;
  }
  
  return false;
}

async function activateSubscription(userId, paymentMethod = 'balance') {
  const user = await getUser(userId);
  
  if (!user.free_trial_used && user.free_trial_start) {
    const now = new Date();
    const trialEnd = new Date(user.free_trial_start);
    trialEnd.setDate(trialEnd.getDate() + config.FREE_TRIAL_DAYS);
    
    if (now < trialEnd) {
      await db.collection('users').updateOne(
        { user_id: userId },
        { $set: { free_trial_used: true } }
      );
    }
  }
  
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);
  
  await db.collection('users').updateOne(
    { user_id: userId },
    { $set: { subscription_expires: endDate } }
  );
  
  await db.collection('subscriptions').insertOne({
    user_id: userId,
    amount: config.SUBSCRIPTION_PRICE,
    start_date: new Date(),
    end_date: endDate,
    payment_method: paymentMethod
  });
  
  return endDate;
}

async function createTransaction(userId, type, amount, txId = null, walletAddress = null, status = 'completed') {
  const transaction = {
    user_id: userId,
    type: type,
    amount: amount,
    tx_id: txId,
    wallet_address: walletAddress,
    status: status,
    created_at: new Date(),
    completed_at: status === 'completed' ? new Date() : null
  };
  
  const result = await db.collection('transactions').insertOne(transaction);
  return { ...transaction, _id: result.insertedId };
}

async function getTransactionByTxId(txId) {
  return await db.collection('transactions').findOne({ tx_id: txId });
}

async function updateUser(userId, updates) {
  const result = await db.collection('users').findOneAndUpdate(
    { user_id: userId },
    { $set: updates },
    { returnDocument: 'after' }
  );
  return result.value;
}

async function createSubscription(userId, amount, endDate, paymentMethod) {
  const subscription = {
    user_id: userId,
    amount: amount,
    start_date: new Date(),
    end_date: endDate,
    payment_method: paymentMethod
  };
  
  const result = await db.collection('subscriptions').insertOne(subscription);
  return { ...subscription, _id: result.insertedId };
}

async function createWithdrawalRequest(userId, amount, walletAddress) {
  const request = {
    user_id: userId,
    amount: amount,
    wallet_address: walletAddress,
    status: 'pending',
    created_at: new Date(),
    processed_at: null
  };
  
  const result = await db.collection('withdrawal_requests').insertOne(request);
  return { ...request, _id: result.insertedId };
}

async function getPendingWithdrawals() {
  return await db.collection('withdrawal_requests').aggregate([
    { $match: { status: 'pending' } },
    {
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: 'user_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 1,
        user_id: 1,
        amount: 1,
        wallet_address: 1,
        status: 1,
        created_at: 1,
        username: '$user.username',
        first_name: '$user.first_name'
      }
    },
    { $sort: { created_at: 1 } }
  ]).toArray();
}

async function approveWithdrawal(requestId) {
  await db.collection('withdrawal_requests').updateOne(
    { _id: new ObjectId(requestId) },
    { 
      $set: { 
        status: 'approved', 
        processed_at: new Date() 
      } 
    }
  );
}

async function updateUserSettings(userId, symbol, timeframe, indicators, marketType) {
  await db.collection('users').updateOne(
    { user_id: userId },
    {
      $set: {
        selected_symbol: symbol,
        selected_timeframe: timeframe,
        selected_indicators: indicators,
        market_type: marketType
      }
    }
  );
}

async function getUserSettings(userId) {
  const user = await getUser(userId);
  if (!user) return null;
  
  return {
    selected_symbol: user.selected_symbol,
    selected_timeframe: user.selected_timeframe,
    selected_indicators: user.selected_indicators,
    market_type: user.market_type
  };
}

async function getAllUsers() {
  return await db.collection('users').find().sort({ created_at: -1 }).toArray();
}

async function getUserTransactions(userId) {
  return await db.collection('transactions')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(10)
    .toArray();
}

async function getAllTransactions(limit = 50) {
  return await db.collection('transactions')
    .aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'user_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          user_id: 1,
          type: 1,
          amount: 1,
          tx_id: 1,
          wallet_address: 1,
          status: 1,
          created_at: 1,
          username: '$user.username',
          first_name: '$user.first_name'
        }
      },
      { $sort: { created_at: -1 } },
      { $limit: limit }
    ])
    .toArray();
}

async function getTransactionStats() {
  const stats = await db.collection('transactions').aggregate([
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();
  
  const result = {
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalSubscriptions: 0,
    depositCount: 0,
    withdrawalCount: 0,
    subscriptionCount: 0
  };
  
  stats.forEach(stat => {
    if (stat._id === 'deposit') {
      result.totalDeposits = stat.total;
      result.depositCount = stat.count;
    } else if (stat._id === 'withdrawal') {
      result.totalWithdrawals = stat.total;
      result.withdrawalCount = stat.count;
    } else if (stat._id === 'subscription') {
      result.totalSubscriptions = stat.total;
      result.subscriptionCount = stat.count;
    }
  });
  
  return result;
}

function sanitizeInput(input) {
  if (typeof input === 'string') {
    return input.replace(/[^\w\s@.-]/gi, '');
  }
  return input;
}

function isValidTronAddress(address) {
  return /^T[A-Za-z1-9]{33}$/.test(address);
}

function isValidTxId(txId) {
  return /^[a-fA-F0-9]{64}$/.test(txId);
}

function sanitizeAnalystName(name) {
  if (typeof name !== 'string') return '';
  
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s_-]/g, '')
    .slice(0, 50);
}

async function createAnalyst(userId, name, description, monthlyPrice, markets = [], profilePicture = null) {
  const sanitizedName = sanitizeAnalystName(name);
  const sanitizedDescription = description.trim().slice(0, 500);
  
  if (!sanitizedName || sanitizedName.length < 3) {
    throw new Error('الاسم يجب أن يحتوي على 3 أحرف على الأقل بعد إزالة الأحرف الخاصة');
  }
  
  if (!sanitizedDescription || sanitizedDescription.length < 10) {
    throw new Error('الوصف يجب أن يحتوي على 10 أحرف على الأقل');
  }
  
  const duplicateName = await db.collection('analysts').findOne(
    { name: sanitizedName },
    { collation: { locale: 'en', strength: 2 } }
  );
  
  if (duplicateName) {
    throw new Error('هذا الاسم مستخدم بالفعل، يرجى اختيار اسم آخر');
  }
  
  console.log(`✅ إنشاء محلل جديد - ID: ${userId}, الاسم: ${sanitizedName}, السعر: ${monthlyPrice}`);
  
  const analyst = {
    user_id: userId,
    name: sanitizedName,
    description: sanitizedDescription,
    monthly_price: monthlyPrice,
    markets: markets,
    profile_picture: profilePicture || null,
    is_active: true,
    total_subscribers: 0,
    rating: 0,
    created_at: new Date(),
    last_post_date: new Date(),
    escrow_balance: 0,
    available_balance: 0,
    current_month_start: new Date(),
    is_suspended: false,
    suspension_reason: null
  };
  
  const result = await db.collection('analysts').insertOne(analyst);
  console.log(`✅ تم حفظ المحلل بنجاح - _id: ${result.insertedId}`);
  return { ...analyst, _id: result.insertedId };
}

async function getAnalyst(analystId) {
  return await db.collection('analysts').findOne({ _id: new ObjectId(analystId) });
}

async function getAnalystByUserId(userId) {
  return await db.collection('analysts').findOne({ user_id: userId });
}

async function getAllAnalysts() {
  return await db.collection('analysts').aggregate([
    { $match: { is_active: true } },
    {
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: 'user_id',
        as: 'user'
      }
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        username: '$user.username'
      }
    },
    { $sort: { total_subscribers: -1, created_at: -1 } }
  ]).toArray();
}

async function updateAnalyst(analystId, updates) {
  const result = await db.collection('analysts').findOneAndUpdate(
    { _id: new ObjectId(analystId) },
    { $set: updates },
    { returnDocument: 'after' }
  );
  return result.value;
}

async function updateAnalystSubscriberCount(analystId, increment = 1) {
  await db.collection('analysts').updateOne(
    { _id: new ObjectId(analystId) },
    { $inc: { total_subscribers: increment } }
  );
}

async function subscribeToAnalyst(userId, analystId, amount) {
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);
  
  const subscription = {
    user_id: userId,
    analyst_id: new ObjectId(analystId),
    amount: amount,
    start_date: new Date(),
    end_date: endDate,
    status: 'active',
    created_at: new Date()
  };
  
  const result = await db.collection('analyst_subscriptions').insertOne(subscription);
  return { ...subscription, _id: result.insertedId };
}

async function getUserAnalystSubscription(userId, analystId) {
  return await db.collection('analyst_subscriptions').findOne({
    user_id: userId,
    analyst_id: new ObjectId(analystId),
    status: 'active',
    end_date: { $gt: new Date() }
  });
}

async function getRecentAnalystSubscription(userId, analystId) {
  return await db.collection('analyst_subscriptions').findOne({
    user_id: userId,
    analyst_id: new ObjectId(analystId),
    end_date: { $lte: new Date() }
  }, {
    sort: { end_date: -1 }
  });
}

async function getAllUserAnalystSubscriptions(userId) {
  return await db.collection('analyst_subscriptions').aggregate([
    {
      $match: {
        user_id: userId,
        status: 'active',
        end_date: { $gt: new Date() }
      }
    },
    {
      $lookup: {
        from: 'analysts',
        localField: 'analyst_id',
        foreignField: '_id',
        as: 'analyst'
      }
    },
    { $unwind: '$analyst' },
    {
      $project: {
        _id: 1,
        user_id: 1,
        analyst_id: 1,
        amount: 1,
        start_date: 1,
        end_date: 1,
        status: 1,
        created_at: 1,
        analyst_name: '$analyst.name',
        analyst_description: '$analyst.description'
      }
    },
    { $sort: { created_at: -1 } }
  ]).toArray();
}

async function getAnalystSubscribers(analystId) {
  return await db.collection('analyst_subscriptions').aggregate([
    {
      $match: {
        analyst_id: new ObjectId(analystId),
        status: 'active',
        end_date: { $gt: new Date() }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: 'user_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 1,
        user_id: 1,
        analyst_id: 1,
        amount: 1,
        start_date: 1,
        end_date: 1,
        status: 1,
        created_at: 1,
        username: '$user.username',
        first_name: '$user.first_name'
      }
    },
    { $sort: { created_at: -1 } }
  ]).toArray();
}

async function addReferralEarning(referrerId, referredId, transactionType, amount, commission) {
  const earning = {
    referrer_id: referrerId,
    referred_id: referredId,
    transaction_type: transactionType,
    amount: amount,
    commission: commission,
    created_at: new Date()
  };
  
  const result = await db.collection('referral_earnings').insertOne(earning);
  
  await db.collection('users').updateOne(
    { user_id: referrerId },
    { $inc: { referral_earnings: commission } }
  );
  
  return { ...earning, _id: result.insertedId };
}

async function getReferralEarnings(userId) {
  return await db.collection('referral_earnings').aggregate([
    { $match: { referrer_id: userId } },
    {
      $lookup: {
        from: 'users',
        localField: 'referred_id',
        foreignField: 'user_id',
        as: 'referred_user'
      }
    },
    { $unwind: '$referred_user' },
    {
      $project: {
        _id: 1,
        referrer_id: 1,
        referred_id: 1,
        transaction_type: 1,
        amount: 1,
        commission: 1,
        created_at: 1,
        referred_username: '$referred_user.username',
        referred_name: '$referred_user.first_name'
      }
    },
    { $sort: { created_at: -1 } }
  ]).toArray();
}

async function getTotalReferralEarnings(userId) {
  const result = await db.collection('referral_earnings').aggregate([
    { $match: { referrer_id: userId } },
    { $group: { _id: null, total: { $sum: '$commission' } } }
  ]).toArray();
  
  return result[0]?.total || 0;
}

async function getReferralStats(userId) {
  const result = await db.collection('referral_earnings').aggregate([
    { $match: { referrer_id: userId } },
    {
      $group: {
        _id: null,
        total_referrals: { $addToSet: '$referred_id' },
        total_earnings: { $sum: '$commission' }
      }
    }
  ]).toArray();
  
  if (result.length === 0) {
    return { total_referrals: 0, total_earnings: 0 };
  }
  
  return {
    total_referrals: result[0].total_referrals.length,
    total_earnings: result[0].total_earnings
  };
}

async function getUserLanguage(userId) {
  const user = await getUser(userId);
  return user?.language || 'ar';
}

async function setUserLanguage(userId, language) {
  await db.collection('users').updateOne(
    { user_id: userId },
    { $set: { language: language } },
    { upsert: true }
  );
}

async function getReferralsByUserId(userId) {
  return await db.collection('users')
    .find({ referred_by: userId })
    .sort({ created_at: -1 })
    .toArray();
}

async function getActiveAnalystSubscriptions(userId) {
  return await db.collection('analyst_subscriptions')
    .find({
      user_id: userId,
      status: 'active',
      end_date: { $gt: new Date() }
    })
    .toArray();
}

async function recordAnalystTrade(analystId, symbol, action, entryPrice, stopLoss, takeProfit, tradingType, marketType) {
  const trade = {
    analyst_id: new ObjectId(analystId),
    symbol,
    action,
    entry_price: entryPrice,
    stop_loss: stopLoss,
    take_profit: takeProfit,
    trading_type: tradingType,
    market_type: marketType,
    status: 'open',
    created_at: new Date(),
    closed_at: null,
    profit_loss: null,
    profit_loss_percentage: null
  };
  
  const result = await db.collection('analyst_trades').insertOne(trade);
  return { ...trade, _id: result.insertedId };
}

async function closeAnalystTrade(tradeId, currentPrice, result) {
  const trade = await db.collection('analyst_trades').findOne({ _id: new ObjectId(tradeId) });
  if (!trade) return null;
  
  const entryPrice = parseFloat(trade.entry_price);
  const profitLossPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;
  const profitLoss = currentPrice - entryPrice;
  
  const update = {
    status: result,
    closed_at: new Date(),
    exit_price: currentPrice,
    profit_loss: profitLoss,
    profit_loss_percentage: profitLossPercentage
  };
  
  await db.collection('analyst_trades').updateOne(
    { _id: new ObjectId(tradeId) },
    { $set: update }
  );
  
  await updateAnalystStats(trade.analyst_id);
  
  return update;
}

async function updateAnalystStats(analystId) {
  const trades = await db.collection('analyst_trades')
    .find({ 
      analyst_id: new ObjectId(analystId),
      status: { $in: ['success', 'failed'] }
    })
    .toArray();
  
  if (trades.length === 0) {
    return;
  }
  
  const totalTrades = trades.length;
  const successfulTrades = trades.filter(t => t.status === 'success').length;
  const failedTrades = trades.filter(t => t.status === 'failed').length;
  const successRate = (successfulTrades / totalTrades) * 100;
  
  const totalProfitLoss = trades.reduce((sum, t) => sum + (t.profit_loss_percentage || 0), 0);
  const avgProfitLoss = totalProfitLoss / totalTrades;
  
  const lastTrades = trades.slice(-10);
  const recentSuccessRate = (lastTrades.filter(t => t.status === 'success').length / lastTrades.length) * 100;
  
  const score = (successRate * 0.4) + (avgProfitLoss * 0.3) + (recentSuccessRate * 0.3);
  
  await db.collection('analysts').updateOne(
    { _id: new ObjectId(analystId) },
    {
      $set: {
        total_trades: totalTrades,
        successful_trades: successfulTrades,
        failed_trades: failedTrades,
        success_rate: successRate,
        avg_profit_loss: avgProfitLoss,
        recent_success_rate: recentSuccessRate,
        performance_score: score,
        last_stats_update: new Date()
      }
    }
  );
}

async function getTop100Analysts() {
  return await db.collection('analysts').aggregate([
    { $match: { is_active: true } },
    {
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: 'user_id',
        as: 'user'
      }
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        username: '$user.username'
      }
    },
    { 
      $sort: { 
        likes: -1,
        total_subscribers: -1,
        performance_score: -1
      }
    },
    { $limit: 100 }
  ]).toArray();
}

async function getTop100AnalystsByMarket(marketType) {
  return await db.collection('analysts').aggregate([
    { 
      $match: { 
        is_active: true,
        markets: marketType
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: 'user_id',
        as: 'user'
      }
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        username: '$user.username'
      }
    },
    { $sort: { likes: -1 } },
    { $limit: 100 }
  ]).toArray();
}

async function getAnalystRank(analystId) {
  const allAnalysts = await db.collection('analysts')
    .find({ 
      is_active: true,
      total_trades: { $gte: 5 }
    })
    .sort({ 
      likes: -1,
      total_subscribers: -1,
      performance_score: -1
    })
    .toArray();
  
  const rank = allAnalysts.findIndex(a => a._id.toString() === analystId.toString()) + 1;
  return rank || null;
}

async function getAnalystTrades(analystId, limit = 20) {
  return await db.collection('analyst_trades')
    .find({ analyst_id: new ObjectId(analystId) })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
}

async function getAnalystStats(analystId) {
  const analyst = await db.collection('analysts').findOne({ _id: new ObjectId(analystId) });
  const trades = await getAnalystTrades(analystId, 50);
  const rank = await getAnalystRank(analystId);
  
  return {
    analyst_name: analyst?.name,
    total_trades: analyst?.total_trades || 0,
    successful_trades: analyst?.successful_trades || 0,
    failed_trades: analyst?.failed_trades || 0,
    success_rate: analyst?.success_rate || 0,
    avg_profit_loss: analyst?.avg_profit_loss || 0,
    recent_success_rate: analyst?.recent_success_rate || 0,
    performance_score: analyst?.performance_score || 0,
    rank: rank,
    total_subscribers: analyst?.total_subscribers || 0,
    recent_trades: trades.slice(0, 10)
  };
}

async function updateAllAnalystRankings() {
  const analysts = await db.collection('analysts')
    .find({ is_active: true })
    .toArray();
  
  for (const analyst of analysts) {
    await updateAnalystStats(analyst._id);
  }
  
  console.log(`✅ Updated rankings for ${analysts.length} analysts`);
  return analysts.length;
}

async function createAnalystSignal(signal) {
  const result = await db.collection('analyst_signals').insertOne(signal);
  return { ...signal, _id: result.insertedId };
}

async function getAnalystSignals(analystId) {
  return await db.collection('analyst_signals')
    .find({ analyst_id: analystId })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();
}

async function updateAnalystSignal(signalId, updates) {
  const result = await db.collection('analyst_signals').findOneAndUpdate(
    { _id: new ObjectId(signalId) },
    { $set: updates },
    { returnDocument: 'after' }
  );
  return result.value;
}

async function getActiveSignals() {
  return await db.collection('analyst_signals')
    .find({ status: 'active' })
    .toArray();
}

async function createAnalystReview(userId, analystId, rating, comment, marketType = null) {
  const review = {
    user_id: userId,
    analyst_id: new ObjectId(analystId),
    rating: rating,
    comment: comment,
    market_type: marketType,
    created_at: new Date()
  };
  
  const result = await db.collection('analyst_reviews').insertOne(review);
  return { ...review, _id: result.insertedId };
}

async function getAnalystReviews(analystId, marketType = null) {
  const query = { analyst_id: new ObjectId(analystId) };
  if (marketType) {
    query.market_type = marketType;
  }
  return await db.collection('analyst_reviews')
    .find(query)
    .sort({ created_at: -1 })
    .toArray();
}

async function getAnalystLikesByMarket(analystId, marketType) {
  const reviews = await db.collection('analyst_reviews')
    .find({ 
      analyst_id: new ObjectId(analystId),
      market_type: marketType,
      rating: 1
    })
    .toArray();
  return reviews.length;
}

async function getAnalystByName(name) {
  return await db.collection('analysts').findOne(
    { name: name.trim() },
    { collation: { locale: 'en', strength: 2 } }
  );
}

// Admin Functions
async function banUser(userId, reason, bannedBy, duration = null) {
  const banData = {
    is_banned: true,
    ban_reason: reason,
    banned_by: bannedBy,
    banned_at: new Date()
  };
  
  if (duration) {
    const unbanDate = new Date();
    unbanDate.setHours(unbanDate.getHours() + duration);
    banData.ban_expires = unbanDate;
  }
  
  await db.collection('users').updateOne(
    { user_id: userId },
    { $set: banData }
  );
  
  return banData;
}

async function unbanUser(userId) {
  await db.collection('users').updateOne(
    { user_id: userId },
    { 
      $set: { 
        is_banned: false,
        ban_expires: null 
      },
      $unset: {
        ban_reason: "",
        banned_by: "",
        banned_at: ""
      }
    }
  );
}

async function restrictUser(userId, restrictions, duration) {
  const restrictUntil = new Date();
  restrictUntil.setHours(restrictUntil.getHours() + duration);
  
  await db.collection('users').updateOne(
    { user_id: userId },
    { 
      $set: { 
        restrictions: restrictions,
        restrict_until: restrictUntil
      }
    }
  );
}

async function deleteUserAccount(userId) {
  await db.collection('users').deleteOne({ user_id: userId });
  await db.collection('transactions').deleteMany({ user_id: userId });
  await db.collection('analyst_subscriptions').deleteMany({ user_id: userId });
  await db.collection('analysts').deleteOne({ user_id: userId });
  return true;
}

async function checkUserBanStatus(userId) {
  const user = await db.collection('users').findOne({ user_id: userId });
  
  if (!user) return { banned: false };
  
  if (user.is_banned) {
    if (user.ban_expires) {
      if (new Date() > new Date(user.ban_expires)) {
        await unbanUser(userId);
        return { banned: false };
      }
    }
    return { 
      banned: true, 
      reason: user.ban_reason,
      expires: user.ban_expires 
    };
  }
  
  return { banned: false };
}

// Content Filter Functions
function containsProhibitedContent(text) {
  if (!text) return { prohibited: false };
  
  const lowerText = text.toLowerCase();
  
  // روابط
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\w+\.(com|net|org|io|me|co|app|xyz|info|biz)[^\s]*)/gi;
  if (urlPattern.test(text)) {
    return { prohibited: true, reason: 'يمنع نشر الروابط' };
  }
  
  // معرفات تليجرام
  const telegramPattern = /@\w+|t\.me\/\w+/gi;
  if (telegramPattern.test(text)) {
    return { prohibited: true, reason: 'يمنع نشر معرفات التليجرام' };
  }
  
  // كلمات محظورة تدل على منتجات خارجية
  const prohibitedWords = [
    'binance', 'bybit', 'okx', 'kucoin', 'huobi', 'gate.io',
    'whatsapp', 'واتساب', 'واتس اب', 'واتس',
    'telegram channel', 'قناة', 'قناتي', 'قناتنا',
    'انضم', 'اشترك معي', 'اشترك معنا',
    'خدمة خارجية', 'منصة أخرى', 'تطبيق آخر',
    'للتواصل', 'راسلني', 'كلمني',
    'vip', 'premium', 'بريميوم'
  ];
  
  for (const word of prohibitedWords) {
    if (lowerText.includes(word)) {
      return { 
        prohibited: true, 
        reason: `يمنع استخدام كلمات تشير لمنتجات خارجية: "${word}"` 
      };
    }
  }
  
  return { prohibited: false };
}

async function getAllUsersForAdmin() {
  return await db.collection('users')
    .find({})
    .sort({ created_at: -1 })
    .limit(100)
    .toArray();
}

async function getBannedUsers() {
  return await db.collection('users')
    .find({ is_banned: true })
    .sort({ banned_at: -1 })
    .toArray();
}

async function createAnalystRoomPost(analystId, userId, postData) {
  const post = {
    analyst_id: new ObjectId(analystId),
    user_id: userId,
    symbol: postData.symbol,
    type: postData.type,
    trading_type: postData.trading_type || 'spot',
    leverage: postData.leverage || null,
    entry_price: postData.entry_price,
    target_price: postData.target_price,
    stop_loss: postData.stop_loss,
    timeframe: postData.timeframe,
    market_type: postData.market_type,
    analysis: postData.analysis || '',
    created_at: new Date(),
    is_deleted: false
  };
  
  const result = await db.collection('analyst_room_posts').insertOne(post);
  
  // تحديث تاريخ آخر نشر للمحلل
  try {
    await updateAnalystLastPost(analystId);
  } catch (error) {
    console.error('خطأ في تحديث تاريخ آخر نشر للمحلل:', error);
  }
  
  return { ...post, _id: result.insertedId };
}

async function getAnalystRoomPosts(analystId, limit = 50) {
  return await db.collection('analyst_room_posts')
    .find({ 
      analyst_id: new ObjectId(analystId),
      is_deleted: false
    })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
}

async function deleteAnalystRoomPost(postId) {
  await db.collection('analyst_room_posts').updateOne(
    { _id: new ObjectId(postId) },
    { $set: { is_deleted: true, deleted_at: new Date() } }
  );
}

async function getSubscriberCount(analystId) {
  return await db.collection('analyst_subscriptions').countDocuments({
    analyst_id: new ObjectId(analystId),
    status: 'active',
    end_date: { $gt: new Date() }
  });
}

async function updateAnalystLastPost(analystId) {
  // إذا كان المحلل موقوفاً، قم بإعادة تفعيله تلقائياً
  const analyst = await db.collection('analysts').findOne({ _id: new ObjectId(analystId) });
  if (analyst && analyst.is_suspended) {
    await unsuspendAnalyst(analystId);
    console.log(`✅ تم إعادة تفعيل المحلل ${analyst.name} بعد نشر صفقة جديدة`);
  }
  
  await db.collection('analysts').updateOne(
    { _id: new ObjectId(analystId) },
    { $set: { last_post_date: new Date() } }
  );
}

async function moveEscrowToAvailable(analystId) {
  const analyst = await db.collection('analysts').findOne({ _id: new ObjectId(analystId) });
  if (!analyst) return null;
  
  const escrowAmount = analyst.escrow_balance || 0;
  
  await db.collection('analysts').updateOne(
    { _id: new ObjectId(analystId) },
    {
      $inc: { available_balance: escrowAmount },
      $set: { 
        escrow_balance: 0,
        current_month_start: new Date()
      }
    }
  );
  
  return {
    moved_amount: escrowAmount,
    new_available_balance: (analyst.available_balance || 0) + escrowAmount
  };
}

async function suspendAnalyst(analystId, reason) {
  await db.collection('analysts').updateOne(
    { _id: new ObjectId(analystId) },
    {
      $set: {
        is_suspended: true,
        suspension_reason: reason,
        suspended_at: new Date()
      }
    }
  );
}

async function unsuspendAnalyst(analystId) {
  await db.collection('analysts').updateOne(
    { _id: new ObjectId(analystId) },
    {
      $set: { is_suspended: false },
      $unset: { suspension_reason: "", suspended_at: "" }
    }
  );
}

async function addToAnalystEscrow(analystId, amount) {
  const result = await db.collection('analysts').findOneAndUpdate(
    { _id: new ObjectId(analystId) },
    { $inc: { escrow_balance: amount } },
    { returnDocument: 'after' }
  );
  return result.value;
}

async function processDailyEscrowRelease() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    const activeSubscriptions = await db.collection('analyst_subscriptions').find({
      status: 'active',
      start_date: { $lt: now },
      end_date: { $gte: oneDayAgo }
    }).toArray();

    const results = [];

    for (const subscription of activeSubscriptions) {
      const startDate = new Date(subscription.start_date);
      const endDate = new Date(subscription.end_date);
      
      const totalDuration = endDate - startDate;
      const elapsedDuration = now - startDate;
      
      if (elapsedDuration < (1000 * 60 * 60)) continue;
      
      const totalAmount = subscription.amount;
      const releasedAmount = subscription.released_amount || 0;
      
      let totalEarned;
      if (now >= endDate) {
        totalEarned = totalAmount;
      } else {
        const progressRatio = Math.min(elapsedDuration / totalDuration, 1);
        totalEarned = totalAmount * progressRatio;
      }
      
      const amountToRelease = totalEarned - releasedAmount;

      if (amountToRelease > 0.01) {
        await db.collection('analysts').updateOne(
          { _id: subscription.analyst_id },
          {
            $inc: {
              escrow_balance: -amountToRelease,
              available_balance: amountToRelease
            }
          }
        );

        await db.collection('analyst_subscriptions').updateOne(
          { _id: subscription._id },
          { $set: { released_amount: totalEarned } }
        );

        results.push({
          analyst_id: subscription.analyst_id,
          amount: amountToRelease,
          subscription_id: subscription._id
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error in processDailyEscrowRelease:', error);
    return [];
  }
}

async function getAnalystBalance(analystId) {
  const analyst = await db.collection('analysts').findOne({ _id: new ObjectId(analystId) });
  if (!analyst) return null;
  
  const escrowBalance = analyst.escrow_balance || 0;
  const availableBalance = analyst.available_balance || 0;
  
  return {
    escrow_balance: escrowBalance,
    available_balance: availableBalance,
    total_balance: escrowBalance + availableBalance
  };
}

async function deductFromAnalystAvailableBalance(analystId, amount) {
  const result = await db.collection('analysts').findOneAndUpdate(
    { _id: new ObjectId(analystId) },
    { $inc: { available_balance: -amount } },
    { returnDocument: 'after' }
  );
  return result.value;
}

async function getUsersSubscribedToAnalyst(analystId) {
  return await db.collection('analyst_subscriptions').aggregate([
    {
      $match: {
        analyst_id: new ObjectId(analystId),
        status: 'active',
        end_date: { $gt: new Date() }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: 'user_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 1,
        user_id: 1,
        analyst_id: 1,
        amount: 1,
        start_date: 1,
        end_date: 1,
        status: 1,
        created_at: 1,
        username: '$user.username',
        first_name: '$user.first_name'
      }
    },
    { $sort: { created_at: -1 } }
  ]).toArray();
}

async function cancelSubscription(subscriptionId) {
  await db.collection('analyst_subscriptions').updateOne(
    { _id: new ObjectId(subscriptionId) },
    {
      $set: {
        status: 'cancelled',
        cancelled_at: new Date()
      }
    }
  );
}

function getDB() {
  return db;
}

module.exports = {
  initDatabase,
  getDB,
  getUser,
  createUser,
  updateUser,
  updateUserBalance,
  getUserBalance,
  isSubscriptionActive,
  activateSubscription,
  createTransaction,
  getTransactionByTxId,
  createSubscription,
  createWithdrawalRequest,
  getPendingWithdrawals,
  approveWithdrawal,
  updateUserSettings,
  getUserSettings,
  getAllUsers,
  getUserTransactions,
  getAllTransactions,
  getTransactionStats,
  sanitizeInput,
  sanitizeAnalystName,
  isValidTronAddress,
  isValidTxId,
  createAnalyst,
  getAnalyst,
  getAnalystByUserId,
  getAnalystByName,
  getAllAnalysts,
  updateAnalyst,
  updateAnalystSubscriberCount,
  subscribeToAnalyst,
  getUserAnalystSubscription,
  getRecentAnalystSubscription,
  getAllUserAnalystSubscriptions,
  getAnalystSubscribers,
  getSubscriberCount,
  addReferralEarning,
  getReferralEarnings,
  getTotalReferralEarnings,
  getReferralStats,
  getUserLanguage,
  setUserLanguage,
  getReferralsByUserId,
  getActiveAnalystSubscriptions,
  recordAnalystTrade,
  closeAnalystTrade,
  updateAnalystStats,
  getTop100Analysts,
  getTop100AnalystsByMarket,
  getAnalystRank,
  getAnalystTrades,
  getAnalystStats,
  updateAllAnalystRankings,
  createAnalystSignal,
  getAnalystSignals,
  updateAnalystSignal,
  getActiveSignals,
  createAnalystReview,
  getAnalystReviews,
  getAnalystLikesByMarket,
  createAnalystRoomPost,
  getAnalystRoomPosts,
  deleteAnalystRoomPost,
  banUser,
  unbanUser,
  restrictUser,
  deleteUserAccount,
  checkUserBanStatus,
  containsProhibitedContent,
  getAllUsersForAdmin,
  getBannedUsers,
  updateAnalystLastPost,
  moveEscrowToAvailable,
  suspendAnalyst,
  unsuspendAnalyst,
  addToAnalystEscrow,
  processDailyEscrowRelease,
  getAnalystBalance,
  deductFromAnalystAvailableBalance,
  getUsersSubscribedToAnalyst,
  cancelSubscription
};
