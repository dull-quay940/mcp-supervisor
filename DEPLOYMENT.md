# MCP Supervisor - Deployment Guide

## 🚀 Quick Deploy on Fresh VPS

### Prerequisites
- Ubuntu 24.04 (or compatible Linux)
- Root or sudo access
- Internet connection

### One-Command Installation

```bash
git clone https://github.com/freqkflag/mcp-supervisor.git
cd mcp-supervisor
./INSTALL.sh
```

That's it! The installer will:
- ✅ Install Node.js 20
- ✅ Install dependencies
- ✅ Create required directories
- ✅ Set up configuration
- ✅ Configure firewall (optional)
- ✅ Install Docker (optional)

## 📋 Manual Installation

### Step 1: Install Node.js

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**CentOS/RHEL:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

### Step 2: Clone Repository

```bash
git clone https://github.com/freqkflag/mcp-supervisor.git
cd mcp-supervisor
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Configure Environment

```bash
cp .env.example .env
nano .env
```

Edit these settings:
- `ALLOW_AUTONOMY` - Set to `true` for full features
- `SUPERVISOR_PORT` - Default 3001
- `DOCKER_ENABLED` - Enable Docker sandboxing

### Step 5: Create Directories

```bash
mkdir -p logs workspace backups
```

### Step 6: Start Supervisor

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🐳 Docker Deployment

### Build and Run with Docker Compose

```bash
docker-compose up -d
```

This will:
- Build the supervisor container
- Build the agent base image
- Start services with proper networking
- Set up volumes for logs and workspace

### Individual Container

```bash
# Build
docker build -f Dockerfile.supervisor -t mcp-supervisor:latest .

# Run
docker run -d \
  --name mcp-supervisor \
  -p 3001:3001 \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/workspace:/app/workspace \
  -v /var/run/docker.sock:/var/run/docker.sock \
  mcp-supervisor:latest
```

## 🔧 Systemd Service Setup

### Install Service

```bash
sudo cp systemd/mcp-supervisor.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### Configure Service

Edit service file:
```bash
sudo nano /etc/systemd/system/mcp-supervisor.service
```

Update paths and environment variables as needed.

### Enable and Start

```bash
sudo systemctl enable mcp-supervisor
sudo systemctl start mcp-supervisor
```

### Check Status

```bash
sudo systemctl status mcp-supervisor
sudo journalctl -u mcp-supervisor -f
```

## 🔒 Security Hardening

### Firewall Configuration

**UFW (Ubuntu):**
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3001/tcp  # MCP Supervisor
sudo ufw enable
```

**Firewalld (CentOS):**
```bash
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

### SSL/TLS with Nginx

```bash
# Install Nginx
sudo apt install nginx certbot python3-certbot-nginx

# Configure reverse proxy
sudo nano /etc/nginx/sites-available/mcp-supervisor
```

Add configuration:
```nginx
server {
    listen 80;
    server_name mcp.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and get SSL:
```bash
sudo ln -s /etc/nginx/sites-available/mcp-supervisor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d mcp.yourdomain.com
```

### Authentication (Optional)

Add basic auth to Nginx:
```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd admin
```

Update Nginx config:
```nginx
location / {
    auth_basic "MCP Supervisor";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://localhost:3001;
}
```

## 📊 Monitoring Setup

### Log Rotation

Create `/etc/logrotate.d/mcp-supervisor`:
```
/root/Zpanel/agents/mcp-supervisor/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}

/var/log/mcp-supervisor*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

### Health Check Monitoring

Add to crontab:
```bash
crontab -e
```

Add line:
```cron
*/5 * * * * curl -f http://localhost:3001/health || systemctl restart mcp-supervisor
```

## 🔄 Update Deployment

### Pull Updates

```bash
cd /root/Zpanel/agents/mcp-supervisor
git pull origin main
npm install
```

### Restart Service

**Systemd:**
```bash
sudo systemctl restart mcp-supervisor
```

**Manual:**
```bash
pkill -f "node.*index.js"
npm run dev
```

**Docker:**
```bash
docker-compose down
docker-compose up -d --build
```

## 🧪 Post-Deployment Testing

### Test API

```bash
# Health check
curl http://localhost:3001/health

# List agents
curl http://localhost:3001/registry

# Run test agent
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{"agentId":"example-task","params":{"taskName":"test"}}'
```

### Test Agents

```bash
# System health
./mcp-helper.sh health-check

# Log analysis
./mcp-helper.sh analyze-logs

# API call
./mcp-helper.sh api-call https://api.github.com/zen
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
sudo lsof -i :3001
sudo kill -9 <PID>
```

### Node.js Not Found

```bash
which node
node --version
npm --version
```

If not installed, run installation step again.

### Permission Denied

```bash
chmod +x index.js
chmod +x *.sh
chmod 755 logs workspace
```

### Docker Not Working

```bash
sudo systemctl status docker
sudo systemctl start docker
sudo usermod -aG docker $USER
newgrp docker
```

### Check Logs

```bash
# Application logs
tail -f logs/actions.log

# System logs (if using systemd)
sudo journalctl -u mcp-supervisor -f

# Docker logs
docker logs mcp-supervisor -f
```

## 📱 Environment-Specific Deployments

### Development

```bash
export NODE_ENV=development
export ALLOW_AUTONOMY=false
npm run dev
```

### Staging

```bash
export NODE_ENV=staging
export ALLOW_AUTONOMY=true
export SUPERVISOR_PORT=3001
npm start
```

### Production

```bash
export NODE_ENV=production
export ALLOW_AUTONOMY=true
export DOCKER_ENABLED=true
npm start
```

Or use systemd service.

## 🔐 Backup and Recovery

### Backup Configuration

```bash
tar -czf mcp-supervisor-backup-$(date +%Y%m%d).tar.gz \
  .env \
  logs/ \
  workspace/ \
  manifest.json \
  registry.json
```

### Restore

```bash
tar -xzf mcp-supervisor-backup-20250103.tar.gz
npm install
npm start
```

## 📞 Support

- **Issues**: https://github.com/freqkflag/mcp-supervisor/issues
- **Docs**: See README.md and other markdown files
- **Logs**: Check `logs/actions.log`

---

**Version**: 1.0.0  
**Last Updated**: November 2025

