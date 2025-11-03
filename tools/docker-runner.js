/**
 * Docker Runner Module
 * Manages Docker-based agent execution for enhanced sandboxing
 * Provides isolation, resource limits, and secure execution environment
 */

import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DockerRunner {
  constructor(manifest) {
    this.manifest = manifest;
    this.docker = new Docker();
    this.activeContainers = new Map();
    this.checkDockerAvailability();
  }

  /**
   * Check if Docker is available and accessible
   */
  async checkDockerAvailability() {
    try {
      await this.docker.ping();
      logger.logSystem('Docker is available and accessible');
      this.dockerAvailable = true;
    } catch (error) {
      logger.error('SUPERVISOR', 'Docker is not available', { error: error.message });
      this.dockerAvailable = false;
    }
  }

  /**
   * Build the agent base image if it doesn't exist
   * @returns {Promise<boolean>} Success status
   */
  async buildAgentImage() {
    const imageName = 'mcp-supervisor-agent:latest';
    
    try {
      // Check if image already exists
      const images = await this.docker.listImages();
      const imageExists = images.some(img => 
        img.RepoTags && img.RepoTags.includes(imageName)
      );

      if (imageExists) {
        logger.logSystem('Agent Docker image already exists', { imageName });
        return true;
      }

      logger.logSystem('Building agent Docker image', { imageName });

      // Build from Dockerfile
      const dockerfilePath = path.resolve(__dirname, '../Dockerfile.agent');
      const stream = await this.docker.buildImage({
        context: path.dirname(dockerfilePath),
        src: ['Dockerfile.agent']
      }, {
        t: imageName
      });

      // Wait for build to complete
      await new Promise((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }, (event) => {
          if (event.stream) {
            logger.debug('DOCKER_BUILD', event.stream.trim());
          }
        });
      });

      logger.logSystem('Agent Docker image built successfully', { imageName });
      return true;
    } catch (error) {
      logger.error('SUPERVISOR', 'Failed to build Docker image', { error: error.message });
      return false;
    }
  }

  /**
   * Run an agent in a Docker container
   * @param {object} agentConfig - Agent configuration
   * @param {object} params - Execution parameters
   * @param {string} sessionId - Session ID
   * @returns {Promise<string>} Container ID
   */
  async runAgent(agentConfig, params, sessionId) {
    if (!this.dockerAvailable) {
      throw new Error('Docker is not available');
    }

    const agentId = `${agentConfig.id}-${sessionId.substring(0, 8)}`;
    const containerName = `mcp-agent-${agentId}`;

    logger.info(agentId, 'Creating Docker container', { name: containerName });

    try {
      // Prepare volume mounts for allowed directories
      const binds = this.manifest.allowedDirectories.map(dir => {
        const resolved = path.resolve(dir);
        // Create directory if it doesn't exist
        if (!fs.existsSync(resolved)) {
          fs.mkdirSync(resolved, { recursive: true });
        }
        return `${resolved}:${resolved}`;
      });

      // Add agent code directory as read-only
      const agentDir = path.dirname(path.resolve(agentConfig.path));
      binds.push(`${agentDir}:${agentDir}:ro`);

      // Container configuration
      const containerConfig = {
        Image: agentConfig.dockerImage || 'mcp-supervisor-agent:latest',
        name: containerName,
        Cmd: ['node', agentConfig.path],
        Env: [
          `AGENT_SESSION_ID=${sessionId}`,
          `ALLOW_AUTONOMY=${process.env.ALLOW_AUTONOMY || 'false'}`,
          `NODE_ENV=${process.env.NODE_ENV || 'development'}`
        ],
        HostConfig: {
          Binds: binds,
          Memory: this.parseMemoryLimit(this.manifest.docker.memoryLimit),
          NanoCpus: this.parseCpuLimit(this.manifest.docker.cpuLimit),
          NetworkMode: this.manifest.docker.networkMode || 'bridge',
          CapDrop: this.manifest.docker.capDrop || ['ALL'],
          CapAdd: this.manifest.docker.capAdd || [],
          SecurityOpt: this.manifest.docker.securityOpt || ['no-new-privileges'],
          ReadonlyRootfs: this.manifest.docker.readOnlyRootfs || false,
          AutoRemove: true // Clean up container after exit
        },
        AttachStdout: true,
        AttachStderr: true,
        Tty: false
      };

      // Create container
      const container = await this.docker.createContainer(containerConfig);
      const containerId = container.id;

      // Track container
      this.activeContainers.set(sessionId, {
        containerId,
        agentId,
        container,
        startTime: Date.now()
      });

      // Attach to container output
      const stream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true
      });

      // Demultiplex stdout and stderr
      container.modem.demuxStream(stream, 
        // stdout
        {
          write: (chunk) => {
            logger.debug(agentId, `docker stdout: ${chunk.toString().trim()}`);
          }
        },
        // stderr
        {
          write: (chunk) => {
            logger.warn(agentId, `docker stderr: ${chunk.toString().trim()}`);
          }
        }
      );

      // Start container
      await container.start();

      logger.logAgentLifecycle(agentId, 'docker_started', { containerId, containerName });

      // Monitor container status
      this.monitorContainer(sessionId, container, agentId);

      return containerId;
    } catch (error) {
      logger.error(agentId, 'Failed to run Docker container', { error: error.message });
      throw error;
    }
  }

  /**
   * Monitor a container for completion or errors
   * @param {string} sessionId - Session ID
   * @param {object} container - Docker container object
   * @param {string} agentId - Agent ID
   */
  async monitorContainer(sessionId, container, agentId) {
    try {
      // Wait for container to finish
      const data = await container.wait();
      
      logger.logAgentExit(agentId, data.StatusCode, null);

      // Clean up from tracking
      this.activeContainers.delete(sessionId);
    } catch (error) {
      logger.error(agentId, 'Container monitoring error', { error: error.message });
    }
  }

  /**
   * Stop a running container
   * @param {string} containerId - Container ID or session ID
   * @returns {Promise<boolean>} Success status
   */
  async stopContainer(containerId) {
    try {
      // Try to find by session ID first
      let containerInfo = this.activeContainers.get(containerId);
      
      if (!containerInfo) {
        // Try direct container ID
        const container = this.docker.getContainer(containerId);
        await container.stop({ t: 5 }); // 5 second grace period
        logger.info('DOCKER', 'Container stopped', { containerId });
        return true;
      }

      const { container, agentId } = containerInfo;
      
      logger.info(agentId, 'Stopping Docker container');
      
      // Try graceful stop first
      await container.stop({ t: 5 });
      
      // Container will auto-remove due to AutoRemove flag
      this.activeContainers.delete(containerId);
      
      logger.logAgentLifecycle(agentId, 'docker_stopped');
      return true;
    } catch (error) {
      logger.error('DOCKER', 'Failed to stop container', { containerId, error: error.message });
      return false;
    }
  }

  /**
   * Get container statistics
   * @param {string} containerId - Container ID
   * @returns {Promise<object>} Container stats
   */
  async getContainerStats(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });
      
      // Calculate CPU percentage
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                       stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - 
                          stats.precpu_stats.system_cpu_usage;
      const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

      // Calculate memory usage
      const memUsage = stats.memory_stats.usage;
      const memLimit = stats.memory_stats.limit;
      const memPercent = (memUsage / memLimit) * 100;

      return {
        cpu: cpuPercent.toFixed(2),
        memory: (memUsage / 1024 / 1024).toFixed(2), // MB
        memoryPercent: memPercent.toFixed(2)
      };
    } catch (error) {
      logger.debug('DOCKER', 'Failed to get container stats', { containerId, error: error.message });
      return null;
    }
  }

  /**
   * Parse memory limit string to bytes
   * @param {string} limit - Memory limit (e.g., "512m", "1g")
   * @returns {number} Bytes
   */
  parseMemoryLimit(limit) {
    const units = {
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024
    };
    
    const match = limit.toLowerCase().match(/^(\d+)([kmg])$/);
    if (match) {
      return parseInt(match[1]) * units[match[2]];
    }
    
    return 512 * 1024 * 1024; // Default 512MB
  }

  /**
   * Parse CPU limit to nano CPUs
   * @param {string} limit - CPU limit (e.g., "1.0", "0.5")
   * @returns {number} Nano CPUs
   */
  parseCpuLimit(limit) {
    const cpus = parseFloat(limit);
    return Math.floor(cpus * 1e9); // Convert to nano CPUs
  }

  /**
   * Clean up all containers
   */
  async cleanup() {
    logger.logSystem('Cleaning up Docker containers');
    
    const promises = [];
    for (const [sessionId, info] of this.activeContainers.entries()) {
      promises.push(this.stopContainer(sessionId));
    }
    
    await Promise.all(promises);
    logger.logSystem('Docker cleanup complete');
  }

  /**
   * List all MCP Supervisor containers
   * @returns {Promise<Array>} List of containers
   */
  async listAgentContainers() {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          name: ['mcp-agent-']
        }
      });
      
      return containers.map(c => ({
        id: c.Id,
        name: c.Names[0].replace('/', ''),
        state: c.State,
        status: c.Status,
        created: c.Created
      }));
    } catch (error) {
      logger.error('DOCKER', 'Failed to list containers', { error: error.message });
      return [];
    }
  }
}

export default DockerRunner;

