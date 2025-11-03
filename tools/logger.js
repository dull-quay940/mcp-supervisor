/**
 * Logger Module
 * Provides centralized logging functionality for the MCP Supervisor
 * All agent actions, IPC messages, errors, and system events are logged here
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log levels
export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

class Logger {
  constructor(logPath = './logs/actions.log') {
    this.logPath = path.resolve(logPath);
    this.ensureLogDirectory();
  }

  /**
   * Ensure the log directory exists
   */
  ensureLogDirectory() {
    const logDir = path.dirname(this.logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Format a log entry
   * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR, CRITICAL)
   * @param {string} agentId - Agent ID or 'SUPERVISOR' for system messages
   * @param {string} message - Log message
   * @param {object} metadata - Additional metadata to log
   * @returns {string} Formatted log entry
   */
  formatLogEntry(level, agentId, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(metadata).length > 0 
      ? ` | ${JSON.stringify(metadata)}` 
      : '';
    return `[${timestamp}] [${level}] [${agentId}] ${message}${metaStr}\n`;
  }

  /**
   * Write a log entry to the log file
   * @param {string} level - Log level
   * @param {string} agentId - Agent ID
   * @param {string} message - Log message
   * @param {object} metadata - Additional metadata
   */
  log(level, agentId, message, metadata = {}) {
    const entry = this.formatLogEntry(level, agentId, message, metadata);
    
    // Write to file (append mode)
    fs.appendFileSync(this.logPath, entry, 'utf8');
    
    // Also output to console for real-time monitoring
    const colorCode = this.getColorCode(level);
    console.log(`${colorCode}${entry.trim()}\x1b[0m`);
  }

  /**
   * Get ANSI color code for log level
   * @param {string} level - Log level
   * @returns {string} ANSI color code
   */
  getColorCode(level) {
    const colors = {
      DEBUG: '\x1b[36m',    // Cyan
      INFO: '\x1b[32m',     // Green
      WARN: '\x1b[33m',     // Yellow
      ERROR: '\x1b[31m',    // Red
      CRITICAL: '\x1b[35m'  // Magenta
    };
    return colors[level] || '\x1b[0m';
  }

  /**
   * Log debug message
   */
  debug(agentId, message, metadata = {}) {
    this.log(LOG_LEVELS.DEBUG, agentId, message, metadata);
  }

  /**
   * Log info message
   */
  info(agentId, message, metadata = {}) {
    this.log(LOG_LEVELS.INFO, agentId, message, metadata);
  }

  /**
   * Log warning message
   */
  warn(agentId, message, metadata = {}) {
    this.log(LOG_LEVELS.WARN, agentId, message, metadata);
  }

  /**
   * Log error message
   */
  error(agentId, message, metadata = {}) {
    this.log(LOG_LEVELS.ERROR, agentId, message, metadata);
  }

  /**
   * Log critical error message
   */
  critical(agentId, message, metadata = {}) {
    this.log(LOG_LEVELS.CRITICAL, agentId, message, metadata);
  }

  /**
   * Log agent lifecycle event
   */
  logAgentLifecycle(agentId, event, details = {}) {
    this.info(agentId, `Agent lifecycle: ${event}`, details);
  }

  /**
   * Log IPC message
   */
  logIPC(agentId, direction, message) {
    const arrow = direction === 'send' ? '→' : '←';
    this.debug(agentId, `IPC ${arrow} ${JSON.stringify(message)}`);
  }

  /**
   * Log agent exit
   */
  logAgentExit(agentId, code, signal) {
    const metadata = { exitCode: code, signal };
    if (code === 0) {
      this.info(agentId, 'Agent exited successfully', metadata);
    } else {
      this.error(agentId, 'Agent exited with error', metadata);
    }
  }

  /**
   * Log system event
   */
  logSystem(message, metadata = {}) {
    this.info('SUPERVISOR', message, metadata);
  }

  /**
   * Log safety violation
   */
  logSafetyViolation(agentId, violation, details = {}) {
    this.warn(agentId, `Safety violation: ${violation}`, details);
  }

  /**
   * Rotate log file if it exceeds size limit
   * @param {number} maxSizeBytes - Maximum log file size in bytes (default: 10MB)
   */
  rotateIfNeeded(maxSizeBytes = 10 * 1024 * 1024) {
    try {
      const stats = fs.statSync(this.logPath);
      if (stats.size > maxSizeBytes) {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const rotatedPath = `${this.logPath}.${timestamp}`;
        fs.renameSync(this.logPath, rotatedPath);
        this.info('SUPERVISOR', `Log file rotated to ${rotatedPath}`);
      }
    } catch (error) {
      // Log file doesn't exist yet, that's okay
    }
  }

  /**
   * Read recent log entries
   * @param {number} lines - Number of lines to read from end of file
   * @returns {string} Recent log entries
   */
  readRecentLogs(lines = 100) {
    try {
      const content = fs.readFileSync(this.logPath, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      return allLines.slice(-lines).join('\n');
    } catch (error) {
      return 'No logs available';
    }
  }
}

// Export singleton instance
const logPath = process.env.LOG_PATH || './logs/actions.log';
export const logger = new Logger(logPath);
export default logger;

