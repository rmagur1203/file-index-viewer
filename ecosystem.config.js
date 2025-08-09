module.exports = {
  apps: [
    {
      name: 'file-index-viewer',
      script: 'bun',
      args: '--bun run next start',
      cwd: '/Users/user/Projects/file-index-viewer',
      instances: 1,
      exec_mode: 'fork',
      
      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        VIDEO_ROOT: '/usr/local/var/www'
      },
      
      // Development environment
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        VIDEO_ROOT: '/usr/local/var/www'
      },
      
      // Logging
      log_file: './logs/app.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto restart
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.next'],
      max_memory_restart: '500M',
      
      // Process management
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Performance
      kill_timeout: 5000,
      listen_timeout: 8000,
      
      // Build hook (runs before starting)
      pre_deploy_local: 'bun --bun run build'
    }
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'user',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:username/file-index-viewer.git',
      path: '/Users/user/Projects/file-index-viewer',
      'post-deploy': 'bun install && bun run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};
