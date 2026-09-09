module.exports = {
  apps: [{
    name: "ai-dost-backend",
    script: "server.js",
    instances: "max",
    exec_mode: "cluster",
    autorestart: true,
    max_restarts: 10,
    min_uptime: "5s",
    max_memory_restart: "512M",
    node_args: ["--max-old-space-size=512"],
    kill_timeout: 5000,
    out_file: "./logs/pm2-out.log",
    error_file: "./logs/pm2-err.log",
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    env: { NODE_ENV: "development", PORT: 5000 },
    env_production: { NODE_ENV: "production", PORT: 5000 },
    watch: false,
  }]
};
