module.exports = {
  apps: [{
    name: 'beta-tester-automation',
    script: 'server.js',
    cwd: '/var/www/servicetextpro/beta-tester-automation',
    env: {
      NODE_ENV: 'production',
      HOME: '/home/snapfix',
      PLAYWRIGHT_BROWSERS_PATH: '/var/www/servicetextpro/beta-tester-automation/pw-browsers',
    },
    max_memory_restart: '512M',
    restart_delay: 5000,
    max_restarts: 10,
  }]
};
