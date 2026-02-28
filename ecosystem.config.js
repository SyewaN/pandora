/**
 * PM2 ecosystem configuration.
 *
 * Two apps are managed:
 * 1) obruk-backend -> Node.js Express API
 * 2) obruk-ai -> Python Flask AI service
 */
module.exports = {
  apps: [
    {
      name: 'obruk-backend',
      script: 'backend/src/server.js',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
      merge_logs: true,
      out_file: 'logs/backend-out.log',
      error_file: 'logs/backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        AI_SERVICE_URL: 'http://127.0.0.1:5000'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        AI_SERVICE_URL: 'http://127.0.0.1:5000'
      }
    },
    {
      name: 'obruk-ai',
      script: 'ai/app.py',
      interpreter: 'python3',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '1G',
      autorestart: true,
      watch: false,
      merge_logs: true,
      out_file: 'logs/ai-out.log',
      error_file: 'logs/ai-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        FLASK_ENV: 'development',
        AI_HOST: '0.0.0.0',
        AI_PORT: 5000,
        AI_DEMO_MODE: 'true'
      },
      env_production: {
        FLASK_ENV: 'production',
        AI_HOST: '0.0.0.0',
        AI_PORT: 5000,
        AI_DEMO_MODE: 'false'
      }
    }
  ],
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'YOUR_AWS_HOST',
      ref: 'origin/main',
      repo: 'git@github.com:YOUR_ORG/YOUR_REPO.git',
      path: '/var/www/obruk-iot-platform',
      'post-deploy': 'npm install && ./scripts/setup.sh && pm2 reload ecosystem.config.js --env production'
    }
  }
};
