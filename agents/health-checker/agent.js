/**
 * Health Checker Agent
 * Monitors system health: CPU, memory, disk usage
 * Can check process status and network connectivity
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';

const execPromise = promisify(exec);

process.on('message', async (message) => {
  const { cmd, params, sessionId, allowAutonomy } = message;

  if (cmd === 'run') {
    try {
      process.send({
        status: 'running',
        progress: 0,
        message: 'Health checker started'
      });

      const checks = params.checks || ['all'];
      const results = {};

      process.send({
        status: 'running',
        progress: 20,
        message: 'Running health checks...'
      });

      // Perform requested checks
      if (checks.includes('all') || checks.includes('cpu')) {
        results.cpu = await checkCPU();
      }

      process.send({
        status: 'running',
        progress: 40,
        message: 'Checking memory...'
      });

      if (checks.includes('all') || checks.includes('memory')) {
        results.memory = await checkMemory();
      }

      process.send({
        status: 'running',
        progress: 60,
        message: 'Checking disk...'
      });

      if (checks.includes('all') || checks.includes('disk')) {
        results.disk = await checkDisk();
      }

      process.send({
        status: 'running',
        progress: 80,
        message: 'Checking system...'
      });

      if (checks.includes('all') || checks.includes('system')) {
        results.system = await checkSystem();
      }

      if (checks.includes('process') && params.processName) {
        results.process = await checkProcess(params.processName);
      }

      // Determine overall health status
      const status = determineHealthStatus(results);

      const result = {
        timestamp: new Date().toISOString(),
        status,
        checks: results,
        hostname: os.hostname(),
        platform: os.platform(),
        uptime: os.uptime()
      };

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

async function checkCPU() {
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // Calculate CPU usage
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - ~~(100 * idle / total);

  return {
    cores: cpus.length,
    model: cpus[0].model,
    speed: cpus[0].speed,
    loadAverage: {
      '1min': loadAvg[0].toFixed(2),
      '5min': loadAvg[1].toFixed(2),
      '15min': loadAvg[2].toFixed(2)
    },
    usagePercent: usage,
    status: usage > 90 ? 'critical' : usage > 70 ? 'warning' : 'healthy'
  };
}

async function checkMemory() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const usagePercent = (usedMem / totalMem * 100).toFixed(2);

  return {
    total: formatBytes(totalMem),
    used: formatBytes(usedMem),
    free: formatBytes(freeMem),
    usagePercent: parseFloat(usagePercent),
    status: usagePercent > 90 ? 'critical' : usagePercent > 80 ? 'warning' : 'healthy'
  };
}

async function checkDisk() {
  try {
    const { stdout } = await execPromise('df -h /');
    const lines = stdout.trim().split('\n');
    const data = lines[1].split(/\s+/);

    const usagePercent = parseInt(data[4]);

    return {
      filesystem: data[0],
      size: data[1],
      used: data[2],
      available: data[3],
      usagePercent,
      mountPoint: data[5],
      status: usagePercent > 90 ? 'critical' : usagePercent > 80 ? 'warning' : 'healthy'
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

async function checkSystem() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    uptime: formatUptime(os.uptime()),
    uptimeSeconds: os.uptime(),
    nodeVersion: process.version,
    status: 'healthy'
  };
}

async function checkProcess(processName) {
  try {
    const { stdout } = await execPromise(`pgrep -f "${processName}"`);
    const pids = stdout.trim().split('\n').filter(p => p);

    if (pids.length > 0) {
      return {
        name: processName,
        running: true,
        count: pids.length,
        pids,
        status: 'healthy'
      };
    } else {
      return {
        name: processName,
        running: false,
        status: 'critical'
      };
    }
  } catch (error) {
    return {
      name: processName,
      running: false,
      status: 'critical',
      error: 'Process not found'
    };
  }
}

function determineHealthStatus(results) {
  const statuses = Object.values(results)
    .map(check => check.status)
    .filter(s => s);

  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('warning')) return 'warning';
  if (statuses.includes('error')) return 'degraded';
  return 'healthy';
}

function formatBytes(bytes) {
  const gb = (bytes / 1024 / 1024 / 1024).toFixed(2);
  return `${gb} GB`;
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  return `${days}d ${hours}h ${minutes}m`;
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  process.send({ status: 'stopped', message: 'Agent stopped' });
  process.exit(0);
});

console.log('Health checker agent ready');

