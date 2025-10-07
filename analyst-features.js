
// نظام تقييم المحللين (👍 أو 👎)
async function rateAnalyst(analystId, isLike, comment) {
    try {
        const response = await fetch('/api/rate-analyst', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                analyst_id: analystId,
                rating: isLike ? 1 : 0,
                comment: comment,
                user_id: tg.initDataUnsafe.user.id,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error rating analyst:', error);
        return { success: false, error: error.message };
    }
}

// عرض تفاصيل محلل
function showAnalystDetails(analyst) {
    const detailsHtml = `
        <div class="analyst-details-card">
            <div class="analyst-header">
                <h2>${analyst.name}</h2>
                <div class="analyst-rating">
                    <span style="font-size: 24px;">👍</span>
                    <span>${analyst.rating || 0}%</span>
                </div>
            </div>
            
            <div class="analyst-stats-grid">
                <div class="stat-item">
                    <div class="stat-icon">👥</div>
                    <div class="stat-value">${analyst.total_subscribers}</div>
                    <div class="stat-label">مشترك</div>
                </div>
                <div class="stat-item">
                    <div class="stat-icon">✅</div>
                    <div class="stat-value">${analyst.success_rate || 0}%</div>
                    <div class="stat-label">نسبة النجاح</div>
                </div>
                <div class="stat-item">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${analyst.total_signals || 0}</div>
                    <div class="stat-label">إشارة</div>
                </div>
            </div>
            
            <div class="analyst-description">
                <h3>📝 الوصف</h3>
                <p>${analyst.description}</p>
            </div>
            
            <div class="analyst-price">
                <span class="price-label">السعر الشهري:</span>
                <span class="price-value">${analyst.monthly_price} USDT</span>
            </div>
            
            <div class="analyst-actions">
                <button class="subscribe-btn" onclick="subscribeToAnalyst(${analyst.id})">
                    ✅ اشترك الآن
                </button>
                <button class="view-signals-btn" onclick="viewAnalystSignals(${analyst.id})">
                    📊 عرض الإشارات
                </button>
            </div>
            
            <div class="analyst-reviews">
                <h3>💬 آراء المشتركين</h3>
                <div id="reviews-container-${analyst.id}">
                    <p class="loading">جاري التحميل...</p>
                </div>
            </div>
        </div>
    `;
    
    return detailsHtml;
}

// عرض إشارات محلل
async function viewAnalystSignals(analystId) {
    try {
        const response = await fetch('/api/analyst-signals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                analyst_id: analystId,
                user_id: tg.initDataUnsafe.user.id,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayAnalystSignals(data.signals);
        } else {
            tg.showAlert('حدث خطأ في جلب الإشارات');
        }
    } catch (error) {
        console.error('Error fetching analyst signals:', error);
        tg.showAlert('فشل في جلب الإشارات');
    }
}

// عرض الإشارات
function displayAnalystSignals(signals) {
    let html = '<div class="signals-list">';
    
    signals.forEach(signal => {
        const statusColor = signal.status === 'success' ? '#4ade80' : 
                          signal.status === 'failed' ? '#f87171' : '#fbbf24';
        
        html += `
            <div class="signal-card">
                <div class="signal-header">
                    <span class="signal-symbol">${signal.symbol}</span>
                    <span class="signal-type ${signal.type}">${signal.type === 'buy' ? '🟢 شراء' : '🔴 بيع'}</span>
                </div>
                <div class="signal-body">
                    <div class="signal-info">
                        <span>💵 سعر الدخول: ${signal.entry_price}</span>
                        <span>🎯 الهدف: ${signal.target_price}</span>
                        <span>🛑 الإيقاف: ${signal.stop_loss}</span>
                    </div>
                    <div class="signal-status" style="color: ${statusColor}">
                        ${signal.status === 'success' ? '✅ نجحت' : 
                          signal.status === 'failed' ? '❌ فشلت' : '⏳ نشطة'}
                    </div>
                    <div class="signal-date">
                        📅 ${new Date(signal.created_at).toLocaleDateString('ar')}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    document.getElementById('analysts-container').innerHTML = html;
}

// نظام الإشعارات للمحللين
function registerAnalystNotifications(analystId) {
    // يمكن استخدام WebSocket أو Polling للإشعارات الفورية
    console.log('Registered for analyst notifications:', analystId);
}
