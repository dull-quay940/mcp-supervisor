# MCP Supervisor - Quick Reference

## 🚀 Running the Supervisor

```bash
# Start (development mode with logs)
npm run dev

# Start in background
nohup npm run dev > /tmp/supervisor.log 2>&1 &

# Check if running
curl http://localhost:3001/health

# View logs
tail -f logs/actions.log
tail -f /tmp/supervisor.log  # if running in background
```

## 📡 Essential API Commands

### Health Check
```bash
curl http://localhost:3001/health
```

### List All Agents
```bash
curl http://localhost:3001/registry | jq .
```

### Run Example Agent
```bash
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{"agentId":"example-task","params":{"taskName":"test"}}'
```

### Check Agent Status
```bash
# Replace SESSION_ID with actual ID from run-agent response
curl http://localhost:3001/agents/SESSION_ID/status | jq .
```

### View Active Agents
```bash
curl http://localhost:3001/agents/active | jq .
```

### Stop an Agent
```bash
curl -X POST http://localhost:3001/agents/SESSION_ID/stop
```

### View Recent Logs
```bash
curl http://localhost:3001/logs/recent?lines=50
```

## 🤖 Pre-configured Agent Commands

### Health Checker (System Monitoring)
```bash
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "health-checker",
    "params": {
      "checks": ["cpu", "memory", "disk"]
    }
  }'
```

### Log Analyzer
```bash
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "log-analyzer",
    "params": {
      "logPath": "/root/Zpanel/agents/mcp-supervisor/logs/actions.log",
      "operation": "analyze"
    }
  }'
```

### API Caller (requires ALLOW_AUTONOMY=true)
```bash
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "api-caller",
    "params": {
      "url": "https://api.github.com/repos/nodejs/node",
      "method": "GET"
    }
  }'
```

## ⚙️ Configuration

### Enable Autonomy Mode
```bash
# Edit .env file
nano .env
# Change: ALLOW_AUTONOMY=true
# Restart supervisor
```

### Change Port
```bash
# Edit .env file
nano .env
# Change: SUPERVISOR_PORT=3002
# Restart supervisor
```

### Enable Docker
```bash
# Edit .env
nano .env
# Change: DOCKER_ENABLED=true

# Build Docker image
docker build -f Dockerfile.agent -t mcp-supervisor-agent:latest .

# Restart supervisor
```

## 🔍 Debugging

### Check Process
```bash
ps aux | grep "node.*index.js"
```

### Kill Process
```bash
pkill -f "node.*index.js"
```

### View Full Logs
```bash
cat logs/actions.log
# Or with colors
tail -f logs/actions.log
```

### Check Port Usage
```bash
lsof -i :3001
netstat -tlnp | grep 3001
```

## 📊 Monitoring

### Watch Active Agents
```bash
watch -n 2 'curl -s http://localhost:3001/agents/active | jq ".count"'
```

### Monitor System Health
```bash
# Run health check every 30 seconds
watch -n 30 'curl -s -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"health-checker\",\"params\":{\"checks\":[\"all\"]}}"'
```

## 🛡️ Security

### Current Settings
```bash
curl -s http://localhost:3001/manifest | jq '.currentSettings'
```

### View Blocked Commands
```bash
curl -s http://localhost:3001/manifest | jq '.blockedCommands'
```

### View Allowed Directories
```bash
curl -s http://localhost:3001/manifest | jq '.allowedDirectories'
```

## 🔄 Restart & Maintenance

### Graceful Restart
```bash
# Find PID
PID=$(ps aux | grep "node.*index.js" | grep -v grep | awk '{print $2}')

# Send SIGTERM (graceful shutdown)
kill -TERM $PID

# Wait and start
sleep 2
npm run dev
```

### Force Restart
```bash
pkill -9 -f "node.*index.js"
npm run dev
```

### Rotate Logs
```bash
# Manual rotation
mv logs/actions.log logs/actions.log.$(date +%Y%m%d_%H%M%S)
touch logs/actions.log
```

## 🎯 Testing Checklist

- [ ] Health endpoint responds
- [ ] Registry lists 8 agents
- [ ] Example agent completes successfully
- [ ] Health checker returns system info
- [ ] Log analyzer processes logs
- [ ] Safety controls block unauthorized actions
- [ ] Logs written to disk
- [ ] Active agents tracked

## 📝 Current Status

- **Running**: Yes
- **Port**: 3001
- **Docker**: Disabled (fork mode)
- **Autonomy**: Disabled (safe mode)
- **Agents**: 8 registered
- **Log File**: /root/Zpanel/agents/mcp-supervisor/logs/actions.log

## 🆘 Quick Fixes

### Port Already in Use
```bash
sudo lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Permission Denied
```bash
chmod +x index.js
chmod 755 logs workspace
```

### Module Not Found
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📚 Documentation

- Full docs: `cat README.md`
- Quick start: `cat QUICKSTART.md`
- Project info: `cat PROJECT_SUMMARY.md`
- This reference: `cat QUICK_REFERENCE.md`

---

**Last Updated**: $(date)
**Version**: 1.0.0
