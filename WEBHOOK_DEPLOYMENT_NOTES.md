# Webhook Deployment Notes

## Secret Token Behavior

### Replit (Development)
- **Secret Token**: DISABLED
- **Reason**: HTTPS already provides sufficient security in Replit environment
- **Behavior**: Webhook requests are accepted without secret token verification

### AWS/Production
- **Secret Token**: REQUIRED
- **Environment Variable**: `WEBHOOK_SECRET`
- **Behavior**: All webhook requests MUST include valid `x-telegram-bot-api-secret-token` header

## Configuration

### For Replit:
```bash
# No WEBHOOK_SECRET needed
# System auto-detects Replit environment via:
# - REPLIT_DB_URL
# - REPLIT_DOMAINS  
# - REPL_ID
```

### For AWS/Production:
```bash
# Required environment variable
WEBHOOK_SECRET=your_random_secret_token_here

# Make sure it's strong and random:
# openssl rand -hex 32
```

## Security Implications

1. **Replit**: Protected by HTTPS and Replit's infrastructure
2. **AWS/Production**: Protected by HTTPS + secret token verification (defense in depth)

## Troubleshooting

### Problem: "Unauthorized webhook request - invalid secret token"
**Solution**: 
- Replit: This should NOT happen. Check environment detection logic.
- AWS: Verify WEBHOOK_SECRET matches what was sent to Telegram via setWebhook()

### Problem: Webhook receiving requests but no bot responses
**Solution**:
- Check logs for "Processing update" messages
- Verify bot handlers are registered in bot.js
- Check database connectivity

### Problem: Telegram shows "pending_update_count" > 0
**Solution**:
- Webhook endpoint not reachable
- Webhook returning errors (check logs)
- Delete webhook and set again: `curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"`
