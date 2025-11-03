/**
 * Monitor Module
 * Manages agent lifecycle: spawning, monitoring, terminating
 * Handles both process-based (fork) and Docker-based execution
 */

import { fork } from 'child_process';
import pidusage from 'pidusage';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Agent states
export const AGENT_STATE = {
  PENDING: 'pending',
  STARTING: 'starting',
  RUNNING: 'running',
  COMPLETING: 'completing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  STOPPED: 'stopped'
};

class AgentMonitor {
  constructor(manifestPath, dockerRunner = null) {
    this.manifest = this.loadManifest(manifestPath);
    this.dockerRunner = dockerRunner;
    
    // Active agents map: sessionId -> agent info
    this.activeAgents = new Map();
    
    // Configuration from environment
    this.maxRuntime = parseInt(process.env.MAX_AGENT_RUNTIME_MS) || 300000;
    this.maxRetries = parseInt(process.env.MAX_AGENT_RETRIES) || 2;
    this.allowAutonomy = process.env.ALLOW_AUTONOMY === 'true';
    this.dockerEnabled = process.env.DOCKER_ENABLED === 'true';
    
    // Start monitoring loop
    this.startMonitoring();
    
    logger.logSystem('Agent Monitor initialized', {
      maxRuntime: this.maxRuntime,
      maxRetries: this.maxRetries,
      allowAutonomy: this.allowAutonomy,
      dockerEnabled: this.dockerEnabled
    });
  }

  /**
   * Load and parse manifest.json
   */
  loadManifest(manifestPath) {
    try {
      const manifestFile = path.resolve(manifestPath);
      const content = fs.readFileSync(manifestFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      logger.error('SUPERVISOR', 'Failed to load manifest', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate agent execution against safety rules
   * @param {object} agentConfig - Agent configuration
   * @param {object} params - Execution parameters
   * @returns {object} Validation result { valid: boolean, reason: string }
   */
  validateAgentExecution(agentConfig, params) {
    // Check if agent requires autonomy
    if (agentConfig.requiresAutonomy && !this.allowAutonomy) {
      return {
        valid: false,
        reason: 'Agent requires ALLOW_AUTONOMY=true but it is disabled'
      };
    }

    // Check concurrent agent limit
    if (this.activeAgents.size >= this.manifest.resourceLimits.maxConcurrentAgents) {
      return {
        valid: false,
        reason: `Maximum concurrent agents limit (${this.manifest.resourceLimits.maxConcurrentAgents}) reached`
      };
    }

    // Validate paths if provided in params
    if (params.path || params.inputPath || params.outputPath) {
      const paths = [params.path, params.inputPath, params.outputPath].filter(Boolean);
      for (const p of paths) {
        if (!this.isPathAllowed(p)) {
          return {
            valid: false,
            reason: `Path '${p}' is not in allowed directories`
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Check if a path is in allowed directories
   * @param {string} targetPath - Path to check
   * @returns {boolean}
   */
  isPathAllowed(targetPath) {
    const resolved = path.resolve(targetPath);
    
    // Check blocked paths first
    for (const blocked of this.manifest.blockedPaths) {
      if (resolved.includes(blocked.replace('~', process.env.HOME))) {
        return false;
      }
    }
    
    // Check if in allowed directories
    return this.manifest.allowedDirectories.some(allowed => {
      const allowedResolved = path.resolve(allowed);
      return resolved.startsWith(allowedResolved);
    });
  }

  /**
   * Spawn a new agent
   * @param {object} agentConfig - Agent configuration from registry
   * @param {object} params - Execution parameters
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<object>} Session info with sessionId and promise
   */
  async spawnAgent(agentConfig, params, retryCount = 0) {
    const sessionId = uuidv4();
    const agentId = `${agentConfig.id}-${sessionId.substring(0, 8)}`;

    logger.logAgentLifecycle(agentId, 'spawn_requested', {
      agentType: agentConfig.id,
      params,
      retryCount
    });

    // Validate execution
    const validation = this.validateAgentExecution(agentConfig, params);
    if (!validation.valid) {
      logger.logSafetyViolation(agentId, validation.reason);
      throw new Error(validation.reason);
    }

    // Create agent session info
    const session = {
      sessionId,
      agentId,
      agentType: agentConfig.id,
      agentConfig,
      params,
      state: AGENT_STATE.STARTING,
      startTime: Date.now(),
      retryCount,
      process: null,
      containerId: null,
      monitoring: {
        cpu: 0,
        memory: 0,
        runtime: 0
      },
      result: null,
      error: null
    };

    this.activeAgents.set(sessionId, session);

    // Spawn using Docker or fork based on configuration
    if (this.dockerEnabled && this.dockerRunner) {
      await this.spawnDockerAgent(session);
    } else {
      await this.spawnForkAgent(session);
    }

    return session;
  }

  /**
   * Spawn agent using child_process.fork()
   * @param {object} session - Agent session
   */
  async spawnForkAgent(session) {
    const { agentId, agentConfig, params, sessionId } = session;
    
    logger.info(agentId, 'Spawning agent via fork', { path: agentConfig.path });

    try {
      const agentPath = path.resolve(agentConfig.path);
      
      // Fork the agent process
      const child = fork(agentPath, [], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: {
          ...process.env,
          AGENT_SESSION_ID: sessionId,
          ALLOW_AUTONOMY: this.allowAutonomy.toString()
        }
      });

      session.process = child;
      session.state = AGENT_STATE.RUNNING;

      // Set up IPC message handler
      child.on('message', (message) => {
        this.handleAgentMessage(sessionId, message);
      });

      // Set up stdout/stderr capture
      child.stdout?.on('data', (data) => {
        logger.debug(agentId, `stdout: ${data.toString().trim()}`);
      });

      child.stderr?.on('data', (data) => {
        logger.warn(agentId, `stderr: ${data.toString().trim()}`);
      });

      // Set up exit handler
      child.on('exit', (code, signal) => {
        this.handleAgentExit(sessionId, code, signal);
      });

      // Send initial run command
      const runCommand = {
        cmd: 'run',
        params,
        sessionId,
        allowAutonomy: this.allowAutonomy
      };
      
      child.send(runCommand);
      logger.logIPC(agentId, 'send', runCommand);

      logger.logAgentLifecycle(agentId, 'started', { pid: child.pid });
    } catch (error) {
      logger.error(agentId, 'Failed to spawn agent', { error: error.message });
      session.state = AGENT_STATE.FAILED;
      session.error = error.message;
      throw error;
    }
  }

  /**
   * Spawn agent using Docker
   * @param {object} session - Agent session
   */
  async spawnDockerAgent(session) {
    const { agentId, agentConfig, params, sessionId } = session;
    
    logger.info(agentId, 'Spawning agent via Docker', { image: agentConfig.dockerImage });

    try {
      const containerId = await this.dockerRunner.runAgent(agentConfig, params, sessionId);
      session.containerId = containerId;
      session.state = AGENT_STATE.RUNNING;
      
      logger.logAgentLifecycle(agentId, 'started_docker', { containerId });
    } catch (error) {
      logger.error(agentId, 'Failed to spawn Docker agent', { error: error.message });
      session.state = AGENT_STATE.FAILED;
      session.error = error.message;
      throw error;
    }
  }

  /**
   * Handle IPC message from agent
   * @param {string} sessionId - Session ID
   * @param {object} message - Message from agent
   */
  handleAgentMessage(sessionId, message) {
    const session = this.activeAgents.get(sessionId);
    if (!session) return;

    logger.logIPC(session.agentId, 'receive', message);

    // Update session based on message
    if (message.status) {
      session.state = message.status;
    }

    if (message.progress !== undefined) {
      session.monitoring.progress = message.progress;
    }

    if (message.result) {
      session.result = message.result;
    }

    if (message.error) {
      session.error = message.error;
    }

    // If agent completed, mark as completing
    if (message.status === 'complete') {
      session.state = AGENT_STATE.COMPLETING;
    }
  }

  /**
   * Handle agent exit
   * @param {string} sessionId - Session ID
   * @param {number} code - Exit code
   * @param {string} signal - Exit signal
   */
  async handleAgentExit(sessionId, code, signal) {
    const session = this.activeAgents.get(sessionId);
    if (!session) return;

    logger.logAgentExit(session.agentId, code, signal);

    // Determine final state
    if (code === 0) {
      session.state = AGENT_STATE.COMPLETED;
    } else {
      session.state = AGENT_STATE.FAILED;
      
      // Retry if under retry limit
      if (session.retryCount < this.maxRetries) {
        logger.info(session.agentId, `Retrying agent (attempt ${session.retryCount + 1}/${this.maxRetries})`);
        
        // Remove current session
        this.activeAgents.delete(sessionId);
        
        // Retry with incremented count
        try {
          await this.spawnAgent(session.agentConfig, session.params, session.retryCount + 1);
        } catch (error) {
          logger.error(session.agentId, 'Retry failed', { error: error.message });
        }
        return;
      }
    }

    session.endTime = Date.now();
    session.monitoring.runtime = session.endTime - session.startTime;

    logger.logAgentLifecycle(session.agentId, 'completed', {
      state: session.state,
      runtime: session.monitoring.runtime,
      exitCode: code
    });
  }

  /**
   * Stop a running agent
   * @param {string} sessionId - Session ID
   * @returns {boolean} Success
   */
  async stopAgent(sessionId) {
    const session = this.activeAgents.get(sessionId);
    if (!session) {
      return false;
    }

    logger.info(session.agentId, 'Stopping agent');

    if (session.process) {
      // Try graceful shutdown first
      session.process.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (session.process && !session.process.killed) {
          logger.warn(session.agentId, 'Force killing agent (SIGKILL)');
          session.process.kill('SIGKILL');
        }
      }, 5000);
    } else if (session.containerId && this.dockerRunner) {
      await this.dockerRunner.stopContainer(session.containerId);
    }

    session.state = AGENT_STATE.STOPPED;
    return true;
  }

  /**
   * Get agent status
   * @param {string} sessionId - Session ID
   * @returns {object|null} Agent status
   */
  getAgentStatus(sessionId) {
    const session = this.activeAgents.get(sessionId);
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      agentId: session.agentId,
      agentType: session.agentType,
      state: session.state,
      runtime: Date.now() - session.startTime,
      monitoring: session.monitoring,
      result: session.result,
      error: session.error
    };
  }

  /**
   * Get all active agents
   * @returns {Array} List of active agents
   */
  getActiveAgents() {
    return Array.from(this.activeAgents.values()).map(session => ({
      sessionId: session.sessionId,
      agentId: session.agentId,
      agentType: session.agentType,
      state: session.state,
      runtime: Date.now() - session.startTime,
      monitoring: session.monitoring
    }));
  }

  /**
   * Monitor active agents for CPU/memory/timeout
   */
  async monitorAgents() {
    for (const [sessionId, session] of this.activeAgents.entries()) {
      if (session.state !== AGENT_STATE.RUNNING) continue;

      const runtime = Date.now() - session.startTime;

      // Check timeout
      if (runtime > this.maxRuntime) {
        logger.warn(session.agentId, 'Agent timeout exceeded', { runtime, maxRuntime: this.maxRuntime });
        session.state = AGENT_STATE.TIMEOUT;
        await this.stopAgent(sessionId);
        continue;
      }

      // Monitor CPU/memory for forked processes
      if (session.process && session.process.pid) {
        try {
          const stats = await pidusage(session.process.pid);
          session.monitoring.cpu = stats.cpu.toFixed(2);
          session.monitoring.memory = (stats.memory / 1024 / 1024).toFixed(2); // MB
          session.monitoring.runtime = runtime;

          // Log high resource usage
          if (stats.cpu > 80) {
            logger.warn(session.agentId, 'High CPU usage detected', { cpu: stats.cpu });
          }
        } catch (error) {
          // Process might have exited
        }
      }
    }

    // Clean up completed/failed agents after 5 minutes
    const now = Date.now();
    for (const [sessionId, session] of this.activeAgents.entries()) {
      if ([AGENT_STATE.COMPLETED, AGENT_STATE.FAILED, AGENT_STATE.STOPPED, AGENT_STATE.TIMEOUT].includes(session.state)) {
        if (session.endTime && (now - session.endTime) > 300000) {
          this.activeAgents.delete(sessionId);
          logger.debug(session.agentId, 'Session cleaned up');
        }
      }
    }
  }

  /**
   * Start the monitoring loop
   */
  startMonitoring() {
    setInterval(() => {
      this.monitorAgents().catch(error => {
        logger.error('SUPERVISOR', 'Monitoring error', { error: error.message });
      });
    }, 5000); // Monitor every 5 seconds

    logger.logSystem('Monitoring loop started');
  }

  /**
   * Shutdown all agents gracefully
   */
  async shutdown() {
    logger.logSystem('Shutting down all agents');
    
    const stopPromises = [];
    for (const sessionId of this.activeAgents.keys()) {
      stopPromises.push(this.stopAgent(sessionId));
    }
    
    await Promise.all(stopPromises);
    logger.logSystem('All agents stopped');
  }
}

export default AgentMonitor;

