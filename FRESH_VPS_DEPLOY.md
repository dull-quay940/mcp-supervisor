# Fresh VPS Deployment Guide

## 🎯 Deploy MCP Supervisor on Brand New VPS in 5 Minutes

This guide is for deploying the MCP Supervisor on a completely fresh Ubuntu 24.04 VPS.

---

## ✅ Prerequisites

- Fresh Ubuntu 24.04 VPS
- Root or sudo access
- Internet connection
- SSH access

---

## 🚀 One-Command Deployment

### Step 1: SSH into Your VPS

\`\`\`bash
ssh root@YOUR_VPS_IP
\`\`\`

### Step 2: Clone and Install

\`\`\`bash
git clone https://github.com/freqkflag/mcp-supervisor.git
cd mcp-supervisor
./INSTALL.sh
\`\`\`

The installer will:
- ✅ Install Node.js 20
- ✅ Install npm dependencies
- ✅ Create required directories (logs, workspace, backups)
- ✅ Set up .env configuration
- ✅ Offer to install Docker (optional)
- ✅ Offer to configure firewall (optional)

### Step 3: Start the Supervisor

\`\`\`bash
npm run dev
\`\`\`

### Step 4: Test (Open New SSH Session)

\`\`\`bash
curl http://localhost:3001/health
\`\`\`

Expected response:
\`\`\`json
{
  "status": "healthy",
  "uptime": 5.123,
  "activeAgents": 0,
  "allowAutonomy": false,
  "dockerEnabled": false
}
\`\`\`

---

## 🔧 Post-Installation Configuration

### Configure Environment

\`\`\`bash
nano .env
\`\`\`

Key settings to adjust:

\`\`\`env
# Enable full features (with caution)
ALLOW_AUTONOMY=true

# Change port if needed
SUPERVISOR_PORT=3001

# Enable Docker sandboxing
DOCKER_ENABLED=true
\`\`\`

### Set Up Systemd Service (Recommended for Production)

\`\`\`bash
# Copy service file
sudo cp systemd/mcp-supervisor.service /etc/systemd/system/

# Edit paths if needed
sudo nano /etc/systemd/system/mcp-supervisor.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable mcp-supervisor
sudo systemctl start mcp-supervisor

# Check status
sudo systemctl status mcp-supervisor
\`\`\`

### Configure Firewall

\`\`\`bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow Supervisor API
sudo ufw allow 3001/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
\`\`\`

---

## 🧪 Testing the Deployment

### Test All Endpoints

\`\`\`bash
# Health check
curl http://localhost:3001/health

# List agents
curl http://localhost:3001/registry | jq .

# View manifest
curl http://localhost:3001/manifest | jq .currentSettings
\`\`\`

### Run Test Agents

\`\`\`bash
# Example task
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{"agentId":"example-task","params":{"taskName":"test"}}'

# Health checker
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{"agentId":"health-checker","params":{"checks":["all"]}}'

# Check status (replace SESSION_ID)
curl http://localhost:3001/agents/SESSION_ID/status | jq .
\`\`\`

### Use Helper Scripts

\`\`\`bash
# CLI tool
./mcp-helper.sh health-check
./mcp-helper.sh list

# Shell functions
source mcp-functions.sh
mcp_check_system
mcp_health
\`\`\`

---

## 📊 Verify Installation

### Checklist

- [ ] Node.js 20+ installed (\`node --version\`)
- [ ] Dependencies installed (\`ls node_modules\`)
- [ ] Directories created (\`ls logs workspace\`)
- [ ] .env file exists (\`ls -la .env\`)
- [ ] Supervisor starts without errors
- [ ] Health endpoint responds
- [ ] Registry lists 8 agents
- [ ] Example agent runs successfully

### Quick Verification

\`\`\`bash
# All-in-one test
cd /root/Zpanel/agents/mcp-supervisor
node --version && \
npm list express pidusage uuid && \
curl -s http://localhost:3001/health | jq . && \
echo "✅ Installation verified!"
\`\`\`

---

## 🐛 Troubleshooting Fresh Install

### Issue: Git not installed

\`\`\`bash
sudo apt update
sudo apt install git
\`\`\`

### Issue: npm install fails

\`\`\`bash
# Update npm
sudo npm install -g npm@latest

# Clear cache
npm cache clean --force

# Retry
npm install
\`\`\`

### Issue: Port 3001 blocked

\`\`\`bash
# Check firewall
sudo ufw status

# Allow port
sudo ufw allow 3001/tcp
\`\`\`

### Issue: Permission denied

\`\`\`bash
# Fix permissions
chmod +x index.js *.sh
chmod 755 logs workspace
\`\`\`

---

## 🔒 Security Checklist for Fresh VPS

\`\`\`bash
# Update system
sudo apt update && sudo apt upgrade -y

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 3001/tcp
sudo ufw enable

# Create non-root user (optional but recommended)
sudo adduser mcp-supervisor
sudo usermod -aG sudo mcp-supervisor

# Set up SSH keys (disable password auth)
# ... (follow standard SSH hardening guides)

# Keep ALLOW_AUTONOMY=false initially
grep ALLOW_AUTONOMY .env  # Should be false

# Review security manifest
cat manifest.json | jq .blockedCommands
\`\`\`

---

## 📝 Environment-Specific Configurations

### Development (Testing)

\`\`\`env
NODE_ENV=development
ALLOW_AUTONOMY=false
DOCKER_ENABLED=false
SUPERVISOR_PORT=3001
\`\`\`

### Staging (Pre-Production)

\`\`\`env
NODE_ENV=staging
ALLOW_AUTONOMY=true
DOCKER_ENABLED=true
SUPERVISOR_PORT=3001
MAX_AGENT_RUNTIME_MS=180000
\`\`\`

### Production (Live)

\`\`\`env
NODE_ENV=production
ALLOW_AUTONOMY=true
DOCKER_ENABLED=true
SUPERVISOR_PORT=3001
MAX_AGENT_RUNTIME_MS=300000
MAX_AGENT_RETRIES=2
\`\`\`

---

## 🔄 Maintenance Tasks

### Keep System Updated

\`\`\`bash
# Update repository
git pull origin main
npm install

# Restart supervisor
sudo systemctl restart mcp-supervisor
\`\`\`

### Monitor Logs

\`\`\`bash
# Application logs
tail -f logs/actions.log

# System logs (if using systemd)
sudo journalctl -u mcp-supervisor -f

# Check for errors
grep ERROR logs/actions.log
\`\`\`

### Backup Configuration

\`\`\`bash
# Backup important files
tar -czf mcp-supervisor-backup-\$(date +%Y%m%d).tar.gz \
  .env logs/ workspace/ manifest.json registry.json

# Store safely
mv mcp-supervisor-backup-*.tar.gz /backups/
\`\`\`

---

## ⏱️ Expected Timeline

| Step | Time | Task |
|------|------|------|
| 1 | 1 min | SSH into VPS |
| 2 | 30 sec | Clone repository |
| 3 | 2 min | Run INSTALL.sh (installs Node.js) |
| 4 | 1 min | Configure .env (optional) |
| 5 | 30 sec | Start supervisor |
| 6 | 30 sec | Test API |

**Total: ~5 minutes** from fresh VPS to running supervisor!

---

## ✅ Success Criteria

Your deployment is successful when:

✅ `npm run dev` starts without errors  
✅ `curl http://localhost:3001/health` returns healthy status  
✅ `curl http://localhost:3001/registry` lists 8 agents  
✅ Test agent completes successfully  
✅ Logs are being written to `logs/actions.log`  
✅ No error messages in console  

---

## 📞 Getting Help

If you encounter issues:

1. Check logs: `tail -f logs/actions.log`
2. Review troubleshooting: [README.md](README.md#troubleshooting)
3. Test with health-checker agent
4. Open issue: https://github.com/freqkflag/mcp-supervisor/issues

---

## 🎉 You're Done!

Your MCP Supervisor is now running on a fresh VPS and ready to manage autonomous agents!

Next steps:
- Try all 8 pre-built agents
- Create custom agents
- Integrate with ChatGPT
- Set up monitoring

---

**Repository**: https://github.com/freqkflag/mcp-supervisor  
**Quick Reference**: See QUICK_REFERENCE.md  
**Full Docs**: See README.md
