# MCP Supervisor - Quick Start Guide

Get started with MCP Supervisor in 5 minutes!

## 🚀 Installation

```bash
# Navigate to project directory
cd /root/Zpanel/agents/mcp-supervisor

# Run setup script
./setup.sh

# Or manually:
npm install
cp .env.example .env
mkdir -p logs workspace
```

## ⚡ Start the Supervisor

```bash
# Development mode (with logs)
npm run dev

# Production mode
npm start
```

The supervisor will start on **http://localhost:3001**

## 🧪 Test the API

### 1. Health Check

```bash
curl http://localhost:3001/health
```

### 2. List Available Agents

```bash
curl http://localhost:3001/registry
```

### 3. Run Your First Agent

```bash
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "example-task",
    "params": {
      "taskName": "hello-world",
      "duration": 2000
    }
  }'
```

You'll get a response with a `sessionId`:

```json
{
  "message": "Agent started successfully",
  "sessionId": "abc-123-def-456",
  "statusEndpoint": "/agents/abc-123-def-456/status"
}
```

### 4. Check Agent Status

```bash
curl http://localhost:3001/agents/abc-123-def-456/status
```

## 🎯 Try More Agents

### System Health Check

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

### Analyze Logs

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

### Image Optimization (Requires ALLOW_AUTONOMY=true)

First, enable autonomy in `.env`:

```bash
ALLOW_AUTONOMY=true
```

Restart the supervisor, then:

```bash
# Place an image in workspace first
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "image-optimize",
    "params": {
      "inputPath": "/root/Zpanel/agents/mcp-supervisor/workspace/photo.jpg",
      "quality": 80
    }
  }'
```

## 📊 Monitor Activity

### View Active Agents

```bash
curl http://localhost:3001/agents/active
```

### View Recent Logs

```bash
curl http://localhost:3001/logs/recent?lines=50
```

### Stop an Agent

```bash
curl -X POST http://localhost:3001/agents/abc-123-def-456/stop
```

## 🔧 Configuration

Edit `.env` file:

```bash
nano .env
```

Key settings:

- `ALLOW_AUTONOMY=false` - Safety mode (no destructive operations)
- `SUPERVISOR_PORT=3001` - API port
- `DOCKER_ENABLED=true` - Use Docker sandboxing
- `MAX_AGENT_RUNTIME_MS=300000` - 5 minute timeout

## 📚 Available Agents

| Agent | ID | Requires Autonomy | Description |
|-------|----|--------------------|-------------|
| Example Task | `example-task` | No | Demo agent |
| Image Optimize | `image-optimize` | Yes | Compress images |
| File Processor | `file-processor` | Yes | File operations |
| API Caller | `api-caller` | Yes | HTTP requests |
| Data Transformer | `data-transformer` | Yes | Format conversion |
| Backup Manager | `backup-manager` | Yes | Create backups |
| Log Analyzer | `log-analyzer` | No | Parse logs |
| Health Checker | `health-checker` | No | System health |

## 🛡️ Safety

**Default Mode** (ALLOW_AUTONOMY=false):
- ✅ Read operations
- ✅ Analysis
- ❌ File modifications
- ❌ Network requests

**Autonomous Mode** (ALLOW_AUTONOMY=true):
- ✅ All default operations
- ✅ File operations (in allowed dirs)
- ✅ Network requests
- ❌ System-level changes
- ❌ Password/key access

## 🐛 Troubleshooting

### Port in use?

```bash
# Change port in .env
SUPERVISOR_PORT=3002
```

### Docker not available?

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Or disable in .env
DOCKER_ENABLED=false
```

### Agent fails?

```bash
# Check logs
tail -f logs/actions.log

# Test with simple agent
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{"agentId": "example-task", "params": {}}'
```

## 📖 Full Documentation

See [README.md](./README.md) for complete documentation including:

- Ubuntu VPS deployment
- Creating custom agents
- ChatGPT integration
- Security best practices
- Advanced configuration

## 🎉 Next Steps

1. Try all 8 pre-built agents
2. Create your own custom agent
3. Set up systemd service for production
4. Integrate with ChatGPT
5. Configure Docker sandboxing

For help: Review README.md or check logs/actions.log

---

**Ready to automate!** 🚀

