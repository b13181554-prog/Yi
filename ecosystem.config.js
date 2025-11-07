module.exports = {
  apps: [
    {
      name: 'obentchi-webhook-server',
      script: 'services/unified-webhook-server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      env: {
        NODE_ENV: 'production',
        MODE: 'webhook'
      },
      
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      
      min_uptime: '10s',
      max_restarts: 10,
      
      kill_timeout: 5000,
      listen_timeout: 10000,
      
      wait_ready: false,
      
      cron_restart: '0 4 * * *',
      
      merge_logs: true,
      
      exp_backoff_restart_delay: 100
    }
  ],
  
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'YOUR_EC2_IP_HERE',
      ref: 'origin/main',
      repo: 'YOUR_GITHUB_REPO_URL_HERE',
      path: '/home/ubuntu/obentchi-bot',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'sudo apt-get update && sudo apt-get install -y git nodejs npm redis-server'
    }
  }
};
