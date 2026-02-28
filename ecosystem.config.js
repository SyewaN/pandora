module.exports = {
  apps: [
    {
      name: 'obruk-backend',
      script: 'backend/src/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/home/admin/pandora/logs/backend-error.log',
      out_file: '/home/admin/pandora/logs/backend-out.log',
      time: true
    },
    {
      name: 'obruk-ai',
      script: 'ai/venv/bin/python',
      args: 'ai/app.py',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        FLASK_ENV: 'production',
        PORT: 5000
      },
      error_file: '/home/admin/pandora/logs/ai-error.log',
      out_file: '/home/admin/pandora/logs/ai-out.log',
      time: true
    }
  ]
};
