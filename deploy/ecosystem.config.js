module.exports = {
  apps: [
    {
      name: 'podcast-v2',
      script: 'npm',
      args: 'run dev',
      cwd: '/root/podcast-v2',
      instances: 'max',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      error_file: '/root/.pm2/logs/podcast-v2-error.log',
      out_file: '/root/.pm2/logs/podcast-v2-out.log',
      log_file: '/root/.pm2/logs/podcast-v2-combined.log',
      time: true
    }
  ]
};
