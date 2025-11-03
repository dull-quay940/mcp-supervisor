# MCP Supervisor

![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Tests](https://github.com/freqkflag/mcp-supervisor/actions/workflows/test.yml/badge.svg)
![GitHub release](https://img.shields.io/github/v/release/freqkflag/mcp-supervisor)

A secure, self-hosted Model Context Protocol (MCP) Supervisor that manages, orchestrates, and monitors reusable autonomous agent workers on Ubuntu 24.04.

## 🌟 Features

- **🔒 Security First**: Sandboxed agent execution with strict safety controls
- **🐳 Docker Support**: Optional containerized execution for enhanced isolation
- **📊 Real-time Monitoring**: Track CPU, memory, and runtime metrics for each agent
- **🔄 Process Management**: Automatic retry, timeout enforcement, and graceful shutdown
- **📝 Comprehensive Logging**: All actions logged to `logs/actions.log`
- **🚀 8 Pre-built Agents**: Ready-to-use agents for common tasks
- **🔌 HTTP API**: RESTful API for integration with ChatGPT and other MCP clients
- **⚡ Concurrent Execution**: Run multiple agents simultaneously
- **🛡️ Safety Manifest**: Explicit control over allowed directories, commands, and resources

## 📋 Table of Contents

- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [API Endpoints](#-api-endpoints)
- [Available Agents](#-available-agents)
- [Safety Controls](#-safety-controls)
- [Creating Custom Agents](#-creating-custom-agents)
- [Ubuntu VPS Deployment](#-ubuntu-vps-deployment)
- [Integration with ChatGPT](#-integration-with-chatgpt)
- [Troubleshooting](#-troubleshooting)

## 🚀 Installation

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** or **yarn**
- **Docker** (optional, for containerized execution)
- **Ubuntu 24.04** (recommended) or compatible Linux distribution

### Step 1: Install Node.js

```bash
# On Ubuntu 24.04
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Should be v20.x or higher
```

### Step 2: Clone or Navigate to Project

```bash
cd /root/Zpanel/agents/mcp-supervisor
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Configure Environment

```bash
cp .env.example .env
nano .env  # Edit configuration as needed
```

### Step 5: Create Required Directories

```bash
mkdir -p logs workspace
```

## ⚡ Quick Start

### Start the Supervisor (Development Mode)

```bash
npm run dev
```

### Start the Supervisor (Production Mode)

```bash
npm start
```

The supervisor will start on port `3001` (configurable via `SUPERVISOR_PORT`).

### Test the API

```bash
# Check health
curl http://localhost:3001/health

# List available agents
curl http://localhost:3001/registry

# Run an example agent
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "example-task",
    "params": {
      "taskName": "test-task",
      "duration": 3000
    }
  }'
```

## ⚙️ Configuration

### Environment Variables (`.env`)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ALLOW_AUTONOMY` | Enable destructive/autonomous actions | `false` | No |
| `SUPERVISOR_PORT` | HTTP API port | `3001` | No |
| `LOG_PATH` | Path to log file | `./logs/actions.log` | No |
| `MAX_AGENT_RUNTIME_MS` | Maximum agent runtime (ms) | `300000` (5 min) | No |
| `MAX_AGENT_RETRIES` | Retry attempts for failed agents | `2` | No |
| `DOCKER_ENABLED` | Enable Docker sandboxing | `true` | No |
| `SERVER_IP` | VPS IP address | `62.72.26.113` | No |
| `NODE_ENV` | Environment mode | `development` | No |

### Safety Configuration (`manifest.json`)

The `manifest.json` file defines security boundaries:

- **allowedDirectories**: Whitelist of accessible directories
- **blockedCommands**: Blacklist of dangerous commands (sudo, rm -rf /, etc.)
- **blockedPaths**: Protected system paths (/etc/passwd, ~/.ssh, etc.)
- **whitelistedApps**: Approved executables
- **resourceLimits**: CPU, memory, and concurrency limits

**⚠️ WARNING**: Never run with `ALLOW_AUTONOMY=true` in production unless you fully understand the implications!

## 🔌 API Endpoints

### General

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API information and status |
| GET | `/health` | Health check |
| GET | `/registry` | List all registered agents |
| GET | `/manifest` | Get safety policy |

### Agent Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/run-agent` | Start a new agent |
| GET | `/agents/active` | List active agents |
| GET | `/agents/:sessionId/status` | Get agent status |
| POST | `/agents/:sessionId/stop` | Stop a running agent |
| GET | `/agent-config/:agentId` | Get agent configuration |

### Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/logs/recent?lines=100` | Get recent log entries |

### Example: Running an Agent

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

Response:

```json
{
  "message": "Agent started successfully",
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "agentId": "health-checker-a1b2c3d4",
  "agentType": "health-checker",
  "status": "running",
  "statusEndpoint": "/agents/a1b2c3d4-e5f6-7890-abcd-ef1234567890/status"
}
```

## 🤖 Available Agents

### 1. Example Task Agent (`example-task`)

**Category**: Demo  
**Requires Autonomy**: No

A simple demonstration agent showing the basic IPC protocol structure. Perfect template for creating new agents.

```bash
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "example-task",
    "params": {
      "taskName": "my-task",
      "duration": 2000
    }
  }'
```

### 2. Image Optimization Agent (`image-optimize`)

**Category**: Media  
**Requires Autonomy**: Yes

Compresses images (JPEG, PNG, WebP) while maintaining quality.

```bash
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "image-optimize",
    "params": {
      "inputPath": "/root/Zpanel/agents/mcp-supervisor/workspace/photo.jpg",
      "quality": 80,
      "format": "webp"
    }
  }'
```

### 3. File Processor Agent (`file-processor`)

**Category**: Filesystem  
**Requires Autonomy**: Yes

Performs file operations: copy, move, rename, organize by extension/date/size.

```bash
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "file-processor",
    "params": {
      "operation": "organize",
      "directory": "/root/Zpanel/agents/mcp-supervisor/workspace",
      "organizeBy": "extension"
    }
  }'
```

### 4. API Caller Agent (`api-caller`)

**Category**: Network  
**Requires Autonomy**: Yes

Makes HTTP/HTTPS requests to external APIs with custom headers and body.

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

### 5. Data Transformer Agent (`data-transformer`)

**Category**: Data  
**Requires Autonomy**: Yes

Converts data between JSON, CSV, and XML formats.

```bash
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "data-transformer",
    "params": {
      "inputPath": "/root/Zpanel/agents/mcp-supervisor/workspace/data.json",
      "outputPath": "/root/Zpanel/agents/mcp-supervisor/workspace/data.csv",
      "inputFormat": "json",
      "outputFormat": "csv"
    }
  }'
```

### 6. Backup Manager Agent (`backup-manager`)

**Category**: Filesystem  
**Requires Autonomy**: Yes

Creates, restores, and lists backups with optional compression.

```bash
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "backup-manager",
    "params": {
      "operation": "create",
      "sourcePath": "/root/Zpanel/agents/mcp-supervisor/workspace",
      "backupDir": "/root/Zpanel/agents/mcp-supervisor/backups",
      "compress": true
    }
  }'
```

### 7. Log Analyzer Agent (`log-analyzer`)

**Category**: Monitoring  
**Requires Autonomy**: No

Parses log files to extract errors, warnings, and statistics.

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

### 8. Health Checker Agent (`health-checker`)

**Category**: Monitoring  
**Requires Autonomy**: No

Monitors system health: CPU, memory, disk, and process status.

```bash
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "health-checker",
    "params": {
      "checks": ["all"]
    }
  }'
```

## 🛡️ Safety Controls

### Safety Levels

The MCP Supervisor implements a defense-in-depth security model:

#### 1. **Default Mode (ALLOW_AUTONOMY=false)**

- ✅ Read-only operations
- ✅ Non-destructive analysis
- ✅ System monitoring
- ❌ File modifications
- ❌ Network requests
- ❌ Destructive operations

**Safe Agents**: `example-task`, `log-analyzer`, `health-checker`

#### 2. **Autonomous Mode (ALLOW_AUTONOMY=true)**

- ✅ All default mode operations
- ✅ File create/modify/delete (within allowed directories)
- ✅ Network requests
- ✅ System commands (whitelisted only)
- ❌ System-level changes
- ❌ Access to passwords/keys
- ❌ Dangerous commands (sudo, rm -rf /, etc.)

**Requires Autonomy**: `image-optimize`, `file-processor`, `api-caller`, `data-transformer`, `backup-manager`

### Directory Restrictions

All file operations are restricted to:

```
/tmp
/root/Zpanel/agents/mcp-supervisor/workspace
/root/Zpanel/agents/mcp-supervisor/logs
/root/Zpanel/agents/mcp-supervisor/agents
```

### Blocked Commands

The following commands are permanently blocked:

- `sudo`, `su`
- `rm -rf /`, `rm -rf /*`
- `dd`, `mkfs`, `fdisk`, `parted`
- `passwd`, `useradd`, `userdel`
- `reboot`, `shutdown`, `halt`
- Fork bombs and other malicious patterns

### Resource Limits

- **Max Concurrent Agents**: 10
- **Max Memory per Agent**: 512MB
- **Max CPU per Agent**: 1.0 core
- **Max Runtime**: 5 minutes (configurable)
- **Max Retries**: 2 attempts

## 🔧 Creating Custom Agents

### Step 1: Create Agent Directory

```bash
mkdir -p agents/my-agent
```

### Step 2: Create `agent.js`

```javascript
// agents/my-agent/agent.js

process.on('message', async (message) => {
  const { cmd, params, sessionId, allowAutonomy } = message;

  if (cmd === 'run') {
    try {
      // Send initial status
      process.send({
        status: 'running',
        progress: 0,
        message: 'Agent started'
      });

      // Do your work here
      const result = await performWork(params);

      // Send completion
      process.send({
        status: 'complete',
        progress: 100,
        result
      });

      process.exit(0);
    } catch (error) {
      process.send({
        status: 'error',
        error: error.message
      });
      process.exit(1);
    }
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  process.send({ status: 'stopped' });
  process.exit(0);
});

async function performWork(params) {
  // Your agent logic here
  return { success: true };
}
```

### Step 3: Create `config.json`

```json
{
  "id": "my-agent",
  "name": "My Custom Agent",
  "version": "1.0.0",
  "description": "Description of what this agent does",
  "capabilities": ["capability1", "capability2"],
  "requiresAutonomy": false,
  "defaultTimeout": 60000,
  "parameters": {
    "param1": {
      "type": "string",
      "description": "Parameter description",
      "required": true
    }
  }
}
```

### Step 4: Register in `registry.json`

Add your agent to the `agents` array:

```json
{
  "id": "my-agent",
  "name": "My Custom Agent",
  "version": "1.0.0",
  "description": "Description",
  "path": "./agents/my-agent/agent.js",
  "configPath": "./agents/my-agent/config.json",
  "capabilities": ["capability1"],
  "requiresAutonomy": false,
  "defaultTimeout": 60000,
  "dockerImage": null,
  "enabled": true,
  "category": "custom"
}
```

### Step 5: Test Your Agent

```bash
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "my-agent",
    "params": {
      "param1": "value"
    }
  }'
```

## 🚀 Ubuntu VPS Deployment

### Deployment on 62.72.26.113

#### 1. Install Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker (optional but recommended)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Install build tools
sudo apt-get install -y build-essential
```

#### 2. Configure Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow Supervisor API
sudo ufw allow 3001/tcp

# Enable firewall
sudo ufw enable
```

#### 3. Set Up Systemd Service

Create `/etc/systemd/system/mcp-supervisor.service`:

```ini
[Unit]
Description=MCP Supervisor
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/Zpanel/agents/mcp-supervisor
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=ALLOW_AUTONOMY=false
Environment=SUPERVISOR_PORT=3001

# Logging
StandardOutput=append:/var/log/mcp-supervisor.log
StandardError=append:/var/log/mcp-supervisor-error.log

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mcp-supervisor
sudo systemctl start mcp-supervisor
sudo systemctl status mcp-supervisor
```

#### 4. Configure Log Rotation

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

#### 5. Security Hardening

```bash
# Limit supervisor to localhost if using reverse proxy
# Edit .env:
# SUPERVISOR_HOST=127.0.0.1

# Or use nginx as reverse proxy with SSL
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d mcp.yourdomain.com
```

#### 6. Monitoring Commands

```bash
# Check status
sudo systemctl status mcp-supervisor

# View logs
sudo journalctl -u mcp-supervisor -f

# View application logs
tail -f /root/Zpanel/agents/mcp-supervisor/logs/actions.log

# Restart service
sudo systemctl restart mcp-supervisor
```

## 🔗 Integration with ChatGPT

### Model Context Protocol (MCP) Integration

The MCP Supervisor exposes an HTTP API that can be integrated with ChatGPT's custom actions or MCP clients.

#### Example ChatGPT Action Schema

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "MCP Supervisor",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "http://62.72.26.113:3001"
    }
  ],
  "paths": {
    "/run-agent": {
      "post": {
        "operationId": "runAgent",
        "summary": "Execute an autonomous agent",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "agentId": {
                    "type": "string",
                    "description": "ID of the agent to run"
                  },
                  "params": {
                    "type": "object",
                    "description": "Parameters for the agent"
                  }
                },
                "required": ["agentId"]
              }
            }
          }
        }
      }
    }
  }
}
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Agent Fails to Start

**Symptoms**: POST `/run-agent` returns 500 error

**Solutions**:
- Check if agent file exists and has correct permissions
- Verify agent is registered in `registry.json`
- Check logs: `tail -f logs/actions.log`
- Ensure required parameters are provided

#### 2. Docker Not Available

**Symptoms**: Warning "Docker is not available" in logs

**Solutions**:
```bash
# Check Docker status
sudo systemctl status docker

# Start Docker
sudo systemctl start docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### 3. Permission Denied Errors

**Symptoms**: Agent fails with "EACCES" or "Permission denied"

**Solutions**:
- Ensure paths are in `allowedDirectories` in `manifest.json`
- Check file/directory permissions
- Create workspace directory: `mkdir -p workspace`

#### 4. Agents Timeout

**Symptoms**: Agents stop with "timeout exceeded"

**Solutions**:
- Increase `MAX_AGENT_RUNTIME_MS` in `.env`
- Optimize agent code for better performance
- Check system resources (CPU/memory)

#### 5. Port Already in Use

**Symptoms**: "Error: listen EADDRINUSE: address already in use :::3001"

**Solutions**:
```bash
# Find process using port 3001
sudo lsof -i :3001

# Kill the process
sudo kill -9 <PID>

# Or change port in .env
SUPERVISOR_PORT=3002
```

### Debug Mode

Enable verbose logging:

```bash
NODE_ENV=development npm run dev
```

### Check System Health

```bash
# Test health endpoint
curl http://localhost:3001/health

# View active agents
curl http://localhost:3001/agents/active

# Check recent logs
curl http://localhost:3001/logs/recent?lines=50
```

## 📚 Additional Resources

- **Project Structure**: See file tree in this README
- **Agent Examples**: Check `agents/*/agent.js` for implementation patterns
- **API Reference**: Use `GET /` endpoint for available routes
- **Safety Guide**: Review `manifest.json` for security boundaries

## 🤝 Contributing

To add new agents or features:

1. Follow the agent template in `agents/example-task/`
2. Add comprehensive error handling
3. Document parameters in `config.json`
4. Register in `registry.json`
5. Test with various parameter combinations
6. Update this README

## 📄 License

MIT License - See LICENSE file for details

## ⚠️ Security Notice

**IMPORTANT**: This system provides powerful automation capabilities. Always:

- Keep `ALLOW_AUTONOMY=false` in production unless absolutely necessary
- Review all custom agents before deployment
- Monitor `logs/actions.log` regularly
- Use Docker sandboxing for untrusted agents
- Regularly update dependencies
- Never expose the API publicly without authentication

## 📞 Support

For issues, questions, or contributions:

- Check logs: `logs/actions.log`
- Review troubleshooting section
- Test with `health-checker` agent to verify system health

---

**MCP Supervisor v1.0.0** - Secure Autonomous Agent Orchestration for Ubuntu 24.04

