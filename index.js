#!/usr/bin/env node

/**
 * MCP Supervisor
 * Main entry point for the Model Context Protocol Supervisor
 * Manages and orchestrates autonomous agent workers
 */

import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './tools/logger.js';
import AgentMonitor from './tools/monitor.js';
import DockerRunner from './tools/docker-runner.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.SUPERVISOR_PORT || 3001;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Add request logging middleware
app.use((req, res, next) => {
  logger.info('HTTP', `${req.method} ${req.path}`, { 
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Load configuration files
let manifest, registry;

try {
  manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  registry = JSON.parse(fs.readFileSync(path.join(__dirname, 'registry.json'), 'utf8'));
  logger.logSystem('Configuration loaded successfully');
} catch (error) {
  logger.critical('SUPERVISOR', 'Failed to load configuration', { error: error.message });
  process.exit(1);
}

// Initialize Docker runner if enabled
let dockerRunner = null;
if (process.env.DOCKER_ENABLED === 'true') {
  dockerRunner = new DockerRunner(manifest);
  logger.logSystem('Docker runner initialized');
}

// Initialize Agent Monitor
const monitor = new AgentMonitor(path.join(__dirname, 'manifest.json'), dockerRunner);

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * GET /
 * API information and status
 */
app.get('/', (req, res) => {
  res.json({
    name: 'MCP Supervisor',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      'GET /': 'API information',
      'GET /health': 'Health check',
      'GET /registry': 'List all registered agents',
      'GET /manifest': 'Get safety policy',
      'GET /agents/active': 'List active agents',
      'GET /agents/:sessionId/status': 'Get agent status',
      'POST /run-agent': 'Start an agent',
      'POST /agents/:sessionId/stop': 'Stop an agent'
    },
    documentation: 'See README.md for full documentation'
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    activeAgents: monitor.getActiveAgents().length,
    allowAutonomy: process.env.ALLOW_AUTONOMY === 'true',
    dockerEnabled: process.env.DOCKER_ENABLED === 'true'
  });
});

/**
 * GET /registry
 * List all registered agents
 */
app.get('/registry', (req, res) => {
  const agents = registry.agents.filter(agent => agent.enabled);
  
  res.json({
    version: registry.version,
    totalAgents: agents.length,
    categories: registry.categories,
    agents: agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
      requiresAutonomy: agent.requiresAutonomy,
      defaultTimeout: agent.defaultTimeout,
      category: agent.category
    })),
    howToAddAgent: registry.howToAddAgent
  });
});

/**
 * GET /manifest
 * Get safety policy and security rules
 */
app.get('/manifest', (req, res) => {
  res.json({
    version: manifest.version,
    description: manifest.description,
    allowedDirectories: manifest.allowedDirectories,
    blockedCommands: manifest.blockedCommands.slice(0, 10), // Show sample
    blockedPaths: manifest.blockedPaths,
    whitelistedApps: manifest.whitelistedApps,
    requiresAutonomy: manifest.requiresAutonomy,
    resourceLimits: manifest.resourceLimits,
    currentSettings: {
      allowAutonomy: process.env.ALLOW_AUTONOMY === 'true',
      maxRuntime: process.env.MAX_AGENT_RUNTIME_MS,
      maxRetries: process.env.MAX_AGENT_RETRIES,
      dockerEnabled: process.env.DOCKER_ENABLED === 'true'
    }
  });
});

/**
 * GET /agents/active
 * List all currently active agents
 */
app.get('/agents/active', (req, res) => {
  const activeAgents = monitor.getActiveAgents();
  
  res.json({
    count: activeAgents.length,
    agents: activeAgents
  });
});

/**
 * GET /agents/:sessionId/status
 * Get status of a specific agent session
 */
app.get('/agents/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;
  const status = monitor.getAgentStatus(sessionId);
  
  if (!status) {
    return res.status(404).json({
      error: 'Agent session not found',
      sessionId
    });
  }
  
  res.json(status);
});

/**
 * POST /run-agent
 * Start a new agent
 * 
 * Body:
 * {
 *   "agentId": "example-task",
 *   "params": { ... }
 * }
 */
app.post('/run-agent', async (req, res) => {
  try {
    const { agentId, params = {} } = req.body;
    
    if (!agentId) {
      return res.status(400).json({
        error: 'agentId is required',
        example: {
          agentId: 'example-task',
          params: { taskName: 'my-task' }
        }
      });
    }
    
    // Find agent in registry
    const agentConfig = registry.agents.find(a => a.id === agentId && a.enabled);
    
    if (!agentConfig) {
      return res.status(404).json({
        error: 'Agent not found or not enabled',
        agentId,
        availableAgents: registry.agents.filter(a => a.enabled).map(a => a.id)
      });
    }
    
    logger.info('HTTP', `Starting agent: ${agentId}`, { params });
    
    // Spawn agent
    const session = await monitor.spawnAgent(agentConfig, params);
    
    res.status(202).json({
      message: 'Agent started successfully',
      sessionId: session.sessionId,
      agentId: session.agentId,
      agentType: agentConfig.id,
      status: session.state,
      statusEndpoint: `/agents/${session.sessionId}/status`
    });
    
  } catch (error) {
    logger.error('HTTP', 'Failed to start agent', { error: error.message });
    
    res.status(500).json({
      error: 'Failed to start agent',
      message: error.message
    });
  }
});

/**
 * POST /agents/:sessionId/stop
 * Stop a running agent
 */
app.post('/agents/:sessionId/stop', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const success = await monitor.stopAgent(sessionId);
    
    if (!success) {
      return res.status(404).json({
        error: 'Agent session not found',
        sessionId
      });
    }
    
    logger.info('HTTP', `Agent stopped: ${sessionId}`);
    
    res.json({
      message: 'Agent stopped successfully',
      sessionId
    });
    
  } catch (error) {
    logger.error('HTTP', 'Failed to stop agent', { error: error.message });
    
    res.status(500).json({
      error: 'Failed to stop agent',
      message: error.message
    });
  }
});

/**
 * GET /logs/recent
 * Get recent log entries
 */
app.get('/logs/recent', (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 100;
    const recentLogs = logger.readRecentLogs(lines);
    
    res.type('text/plain').send(recentLogs);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to read logs',
      message: error.message
    });
  }
});

/**
 * GET /agent-config/:agentId
 * Get detailed configuration for a specific agent
 */
app.get('/agent-config/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const agentConfig = registry.agents.find(a => a.id === agentId);
    
    if (!agentConfig) {
      return res.status(404).json({
        error: 'Agent not found',
        agentId
      });
    }
    
    // Try to read the config.json file
    try {
      const configPath = path.join(__dirname, agentConfig.configPath);
      const detailedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      res.json({
        ...agentConfig,
        detailedConfig
      });
    } catch (error) {
      // Config file not found, return basic info
      res.json(agentConfig);
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get agent config',
      message: error.message
    });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /registry',
      'GET /manifest',
      'GET /agents/active',
      'GET /agents/:sessionId/status',
      'POST /run-agent',
      'POST /agents/:sessionId/stop',
      'GET /logs/recent',
      'GET /agent-config/:agentId'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('HTTP', 'Unhandled error', { 
    error: err.message,
    stack: err.stack,
    path: req.path
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================================================
// SERVER STARTUP & SHUTDOWN
// ============================================================================

// Start server
const server = app.listen(PORT, () => {
  logger.logSystem(`MCP Supervisor started on port ${PORT}`, {
    port: PORT,
    allowAutonomy: process.env.ALLOW_AUTONOMY === 'true',
    dockerEnabled: process.env.DOCKER_ENABLED === 'true',
    nodeVersion: process.version,
    platform: process.platform
  });
  
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    MCP SUPERVISOR v1.0.0                      ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:        RUNNING                                        ║
║  Port:          ${PORT}                                        ║
║  Autonomy:      ${process.env.ALLOW_AUTONOMY === 'true' ? 'ENABLED ⚠️ ' : 'DISABLED ✓'}                                   ║
║  Docker:        ${process.env.DOCKER_ENABLED === 'true' ? 'ENABLED ✓' : 'DISABLED  '}                                    ║
║  Agents:        ${registry.agents.filter(a => a.enabled).length} registered                                        ║
╠═══════════════════════════════════════════════════════════════╣
║  API Endpoints:                                                ║
║    GET  http://localhost:${PORT}/                              ║
║    GET  http://localhost:${PORT}/registry                      ║
║    POST http://localhost:${PORT}/run-agent                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Logs: ${process.env.LOG_PATH || './logs/actions.log'}                          ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
const shutdown = async (signal) => {
  logger.logSystem(`Received ${signal}, shutting down gracefully...`);
  
  // Stop accepting new requests
  server.close(async () => {
    logger.logSystem('HTTP server closed');
    
    // Shutdown all active agents
    await monitor.shutdown();
    
    // Cleanup Docker containers if enabled
    if (dockerRunner) {
      await dockerRunner.cleanup();
    }
    
    logger.logSystem('Shutdown complete');
    process.exit(0);
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('SUPERVISOR', 'Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.critical('SUPERVISOR', 'Uncaught exception', { 
    error: error.message,
    stack: error.stack
  });
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.critical('SUPERVISOR', 'Unhandled promise rejection', { 
    reason: reason?.message || reason,
    promise: promise.toString()
  });
});

export default app;

