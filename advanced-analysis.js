class AdvancedAnalysis {
  constructor(candles) {
    this.candles = candles;
    this.closes = candles.map(c => parseFloat(c.close));
    this.highs = candles.map(c => parseFloat(c.high));
    this.lows = candles.map(c => parseFloat(c.low));
    this.opens = candles.map(c => parseFloat(c.open));
  }

  calculateFibonacci() {
    const lookbackPeriod = Math.min(this.candles.length, 100);
    const recentCandles = this.candles.slice(-lookbackPeriod);
    
    const highs = recentCandles.map(c => parseFloat(c.high));
    const lows = recentCandles.map(c => parseFloat(c.low));
    
    const high = Math.max(...highs);
    const low = Math.min(...lows);
    const diff = high - low;
    
    const levels = {
      '0%': low,
      '23.6%': low + (diff * 0.236),
      '38.2%': low + (diff * 0.382),
      '50%': low + (diff * 0.5),
      '61.8%': low + (diff * 0.618),
      '78.6%': low + (diff * 0.786),
      '100%': high
    };
    
    const currentPrice = this.closes[this.closes.length - 1];
    let signal = 'محايد';
    let emoji = '🔵';
    let recommendation = '';
    
    if (currentPrice <= levels['23.6%']) {
      signal = 'منطقة دعم قوية';
      emoji = '🟢';
      recommendation = 'فرصة شراء قوية - السعر عند مستوى فيبوناتشي 23.6%';
    } else if (currentPrice >= levels['78.6%']) {
      signal = 'منطقة مقاومة قوية';
      emoji = '🔴';
      recommendation = 'فرصة بيع قوية - السعر عند مستوى فيبوناتشي 78.6%';
    } else if (currentPrice >= levels['50%'] && currentPrice <= levels['61.8%']) {
      signal = 'منطقة محايدة';
      emoji = '🟡';
      recommendation = 'السعر في المنتصف - انتظر إشارة واضحة';
    } else if (currentPrice < levels['50%']) {
      signal = 'اتجاه هبوطي';
      emoji = '📉';
      recommendation = 'السعر تحت المستوى 50%';
    } else {
      signal = 'اتجاه صعودي';
      emoji = '📈';
      recommendation = 'السعر فوق المستوى 50%';
    }
    
    return {
      name: 'Fibonacci',
      levels,
      currentPrice,
      signal,
      emoji,
      recommendation
    };
  }

  detectCandlePatterns() {
    const patterns = [];
    const len = this.candles.length;
    
    if (len < 3) {
      return {
        name: 'أنماط الشموع',
        patterns: [],
        signal: 'غير متاح',
        emoji: '⚫',
        recommendation: 'بيانات غير كافية'
      };
    }
    
    const current = this.candles[len - 1];
    const prev = this.candles[len - 2];
    const prev2 = this.candles[len - 3];
    
    const currentClose = parseFloat(current.close);
    const currentOpen = parseFloat(current.open);
    const prevClose = parseFloat(prev.close);
    const prevOpen = parseFloat(prev.open);
    
    if (this.isDoji(current)) {
      patterns.push({ name: 'Doji', signal: 'تردد', strength: 'متوسط' });
    }
    
    if (this.isHammer(current)) {
      patterns.push({ name: 'Hammer', signal: 'انعكاس صعودي', strength: 'قوي' });
    }
    
    if (this.isShootingStar(current)) {
      patterns.push({ name: 'Shooting Star', signal: 'انعكاس هبوطي', strength: 'قوي' });
    }
    
    if (this.isEngulfing(prev, current)) {
      const bullish = currentClose > currentOpen && prevClose < prevOpen;
      patterns.push({
        name: bullish ? 'Bullish Engulfing' : 'Bearish Engulfing',
        signal: bullish ? 'صعودي قوي' : 'هبوطي قوي',
        strength: 'قوي جداً'
      });
    }
    
    if (this.isMorningStar(prev2, prev, current)) {
      patterns.push({ name: 'Morning Star', signal: 'انعكاس صعودي', strength: 'قوي جداً' });
    }
    
    if (this.isEveningStar(prev2, prev, current)) {
      patterns.push({ name: 'Evening Star', signal: 'انعكاس هبوطي', strength: 'قوي جداً' });
    }
    
    let overallSignal = 'محايد';
    let emoji = '🔵';
    let recommendation = '';
    
    if (patterns.length > 0) {
      const bullishCount = patterns.filter(p => p.signal.includes('صعودي')).length;
      const bearishCount = patterns.filter(p => p.signal.includes('هبوطي')).length;
      
      if (bullishCount > bearishCount) {
        overallSignal = 'صعودي';
        emoji = '🟢';
        recommendation = `تم اكتشاف ${bullishCount} نمط صعودي`;
      } else if (bearishCount > bullishCount) {
        overallSignal = 'هبوطي';
        emoji = '🔴';
        recommendation = `تم اكتشاف ${bearishCount} نمط هبوطي`;
      } else {
        overallSignal = 'محايد';
        emoji = '🟡';
        recommendation = 'إشارات متضاربة';
      }
    }
    
    return {
      name: 'أنماط الشموع',
      patterns,
      signal: overallSignal,
      emoji,
      recommendation
    };
  }

  isDoji(candle) {
    const open = parseFloat(candle.open);
    const close = parseFloat(candle.close);
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);
    
    const bodySize = Math.abs(close - open);
    const totalRange = high - low;
    
    return bodySize / totalRange < 0.1;
  }

  isHammer(candle) {
    const open = parseFloat(candle.open);
    const close = parseFloat(candle.close);
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);
    
    const bodySize = Math.abs(close - open);
    const lowerShadow = Math.min(open, close) - low;
    const upperShadow = high - Math.max(open, close);
    
    return lowerShadow > bodySize * 2 && upperShadow < bodySize;
  }

  isShootingStar(candle) {
    const open = parseFloat(candle.open);
    const close = parseFloat(candle.close);
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);
    
    const bodySize = Math.abs(close - open);
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;
    
    return upperShadow > bodySize * 2 && lowerShadow < bodySize;
  }

  isEngulfing(prev, current) {
    const prevOpen = parseFloat(prev.open);
    const prevClose = parseFloat(prev.close);
    const currentOpen = parseFloat(current.open);
    const currentClose = parseFloat(current.close);
    
    const prevBullish = prevClose > prevOpen;
    const currentBullish = currentClose > currentOpen;
    
    if (prevBullish === currentBullish) return false;
    
    if (currentBullish) {
      return currentOpen < prevClose && currentClose > prevOpen;
    } else {
      return currentOpen > prevClose && currentClose < prevOpen;
    }
  }

  isMorningStar(first, second, third) {
    const f = { o: parseFloat(first.open), c: parseFloat(first.close) };
    const s = { o: parseFloat(second.open), c: parseFloat(second.close), h: parseFloat(second.high), l: parseFloat(second.low) };
    const t = { o: parseFloat(third.open), c: parseFloat(third.close) };
    
    const firstBearish = f.c < f.o;
    const secondSmall = Math.abs(s.c - s.o) / (s.h - s.l) < 0.3;
    const thirdBullish = t.c > t.o;
    
    return firstBearish && secondSmall && thirdBullish && t.c > (f.o + f.c) / 2;
  }

  isEveningStar(first, second, third) {
    const f = { o: parseFloat(first.open), c: parseFloat(first.close) };
    const s = { o: parseFloat(second.open), c: parseFloat(second.close), h: parseFloat(second.high), l: parseFloat(second.low) };
    const t = { o: parseFloat(third.open), c: parseFloat(third.close) };
    
    const firstBullish = f.c > f.o;
    const secondSmall = Math.abs(s.c - s.o) / (s.h - s.l) < 0.3;
    const thirdBearish = t.c < t.o;
    
    return firstBullish && secondSmall && thirdBearish && t.c < (f.o + f.c) / 2;
  }

  detectHeadAndShoulders() {
    if (this.candles.length < 20) {
      return {
        name: 'Head & Shoulders',
        detected: false,
        signal: 'غير متاح',
        emoji: '⚫',
        recommendation: 'بيانات غير كافية'
      };
    }
    
    const peaks = this.findPeaks();
    const valleys = this.findValleys();
    
    if (peaks.length >= 3) {
      const [left, head, right] = peaks.slice(-3);
      
      if (head.value > left.value && head.value > right.value &&
          Math.abs(left.value - right.value) / left.value < 0.05) {
        
        return {
          name: 'Head & Shoulders',
          detected: true,
          type: 'bearish',
          signal: 'هبوطي',
          emoji: '🔴',
          recommendation: 'نموذج Head & Shoulders - توقع انعكاس هبوطي',
          neckline: Math.min(left.value, right.value)
        };
      }
    }
    
    if (valleys.length >= 3) {
      const [left, head, right] = valleys.slice(-3);
      
      if (head.value < left.value && head.value < right.value &&
          Math.abs(left.value - right.value) / left.value < 0.05) {
        
        return {
          name: 'Inverse Head & Shoulders',
          detected: true,
          type: 'bullish',
          signal: 'صعودي',
          emoji: '🟢',
          recommendation: 'نموذج Inverse H&S - توقع انعكاس صعودي',
          neckline: Math.max(left.value, right.value)
        };
      }
    }
    
    return {
      name: 'Head & Shoulders',
      detected: false,
      signal: 'محايد',
      emoji: '🔵',
      recommendation: 'لم يتم اكتشاف النموذج'
    };
  }

  findPeaks() {
    const peaks = [];
    for (let i = 1; i < this.highs.length - 1; i++) {
      if (this.highs[i] > this.highs[i - 1] && this.highs[i] > this.highs[i + 1]) {
        peaks.push({ index: i, value: this.highs[i] });
      }
    }
    return peaks;
  }

  findValleys() {
    const valleys = [];
    for (let i = 1; i < this.lows.length - 1; i++) {
      if (this.lows[i] < this.lows[i - 1] && this.lows[i] < this.lows[i + 1]) {
        valleys.push({ index: i, value: this.lows[i] });
      }
    }
    return valleys;
  }

  calculateSupportResistance() {
    const recentCandles = this.candles.slice(-50);
    const prices = recentCandles.flatMap(c => [parseFloat(c.high), parseFloat(c.low)]);
    
    const sorted = prices.sort((a, b) => a - b);
    const clusters = this.findPriceClusters(sorted);
    
    const currentPrice = this.closes[this.closes.length - 1];
    const support = clusters.filter(c => c < currentPrice).pop() || sorted[0];
    const resistance = clusters.find(c => c > currentPrice) || sorted[sorted.length - 1];
    
    let signal = 'محايد';
    let emoji = '🔵';
    let recommendation = '';
    
    const distanceToSupport = ((currentPrice - support) / currentPrice) * 100;
    const distanceToResistance = ((resistance - currentPrice) / currentPrice) * 100;
    
    if (distanceToSupport < 1) {
      signal = 'قرب الدعم';
      emoji = '🟢';
      recommendation = 'السعر قريب من مستوى الدعم - فرصة شراء';
    } else if (distanceToResistance < 1) {
      signal = 'قرب المقاومة';
      emoji = '🔴';
      recommendation = 'السعر قريب من مستوى المقاومة - فرصة بيع';
    } else {
      signal = 'في المنتصف';
      emoji = '🟡';
      recommendation = 'السعر بين الدعم والمقاومة';
    }
    
    return {
      name: 'الدعم والمقاومة',
      support: support.toFixed(2),
      resistance: resistance.toFixed(2),
      currentPrice: currentPrice.toFixed(2),
      signal,
      emoji,
      recommendation
    };
  }

  findPriceClusters(sorted) {
    const clusters = [];
    const threshold = 0.02;
    
    let currentCluster = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const diff = (sorted[i] - currentCluster[0]) / currentCluster[0];
      
      if (diff < threshold) {
        currentCluster.push(sorted[i]);
      } else {
        if (currentCluster.length >= 3) {
          const avg = currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length;
          clusters.push(avg);
        }
        currentCluster = [sorted[i]];
      }
    }
    
    if (currentCluster.length >= 3) {
      const avg = currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length;
      clusters.push(avg);
    }
    
    return clusters;
  }
}

module.exports = AdvancedAnalysis;
