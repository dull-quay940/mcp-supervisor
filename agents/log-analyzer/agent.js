/**
 * Log Analyzer Agent
 * Parses and analyzes log files
 * Extracts errors, warnings, and statistics
 */

import fs from 'fs';
import path from 'path';

process.on('message', async (message) => {
  const { cmd, params, sessionId, allowAutonomy } = message;

  if (cmd === 'run') {
    try {
      process.send({
        status: 'running',
        progress: 0,
        message: 'Log analyzer started'
      });

      const { logPath, operation = 'analyze', filters = {} } = params;

      if (!logPath) {
        throw new Error('logPath parameter is required');
      }

      const logFile = path.resolve(logPath);

      if (!fs.existsSync(logFile)) {
        throw new Error(`Log file not found: ${logFile}`);
      }

      process.send({
        status: 'running',
        progress: 30,
        message: 'Reading log file...'
      });

      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      process.send({
        status: 'running',
        progress: 60,
        message: 'Analyzing logs...'
      });

      let result;

      switch (operation) {
        case 'analyze':
          result = analyzeLogs(lines, filters);
          break;
        case 'errors':
          result = extractErrors(lines);
          break;
        case 'warnings':
          result = extractWarnings(lines);
          break;
        case 'stats':
          result = getStatistics(lines);
          break;
        case 'search':
          result = searchLogs(lines, filters.pattern);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      result.logPath = logFile;
      result.totalLines = lines.length;

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

function analyzeLogs(lines, filters) {
  const errors = [];
  const warnings = [];
  const info = [];
  const levelCounts = {
    ERROR: 0,
    WARN: 0,
    INFO: 0,
    DEBUG: 0,
    CRITICAL: 0
  };

  const timestampPattern = /\[(.*?)\]/;
  const levelPattern = /\[(ERROR|WARN|INFO|DEBUG|CRITICAL)\]/i;

  lines.forEach((line, index) => {
    const levelMatch = line.match(levelPattern);
    
    if (levelMatch) {
      const level = levelMatch[1].toUpperCase();
      levelCounts[level] = (levelCounts[level] || 0) + 1;

      const entry = {
        lineNumber: index + 1,
        level,
        content: line
      };

      if (level === 'ERROR' || level === 'CRITICAL') {
        errors.push(entry);
      } else if (level === 'WARN') {
        warnings.push(entry);
      } else if (level === 'INFO') {
        info.push(entry);
      }
    }
  });

  // Apply filters
  let filteredErrors = errors;
  let filteredWarnings = warnings;

  if (filters.since) {
    const sinceDate = new Date(filters.since);
    filteredErrors = errors.filter(e => extractTimestamp(e.content) >= sinceDate);
    filteredWarnings = warnings.filter(w => extractTimestamp(w.content) >= sinceDate);
  }

  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase();
    filteredErrors = filteredErrors.filter(e => e.content.toLowerCase().includes(keyword));
    filteredWarnings = filteredWarnings.filter(w => w.content.toLowerCase().includes(keyword));
  }

  return {
    operation: 'analyze',
    summary: {
      totalLines: lines.length,
      errors: filteredErrors.length,
      warnings: filteredWarnings.length,
      info: info.length
    },
    levelCounts,
    errors: filteredErrors.slice(0, 50), // Limit to 50 most recent
    warnings: filteredWarnings.slice(0, 50)
  };
}

function extractErrors(lines) {
  const errors = lines.filter(line => 
    /\[(ERROR|CRITICAL)\]/i.test(line)
  ).map((line, index) => ({
    lineNumber: index + 1,
    content: line,
    timestamp: extractTimestamp(line)
  }));

  return {
    operation: 'errors',
    count: errors.length,
    errors: errors.slice(-100) // Last 100 errors
  };
}

function extractWarnings(lines) {
  const warnings = lines.filter(line => 
    /\[WARN\]/i.test(line)
  ).map((line, index) => ({
    lineNumber: index + 1,
    content: line,
    timestamp: extractTimestamp(line)
  }));

  return {
    operation: 'warnings',
    count: warnings.length,
    warnings: warnings.slice(-100) // Last 100 warnings
  };
}

function getStatistics(lines) {
  const stats = {
    totalLines: lines.length,
    byLevel: {
      ERROR: 0,
      WARN: 0,
      INFO: 0,
      DEBUG: 0,
      CRITICAL: 0
    },
    byHour: {},
    topAgents: {},
    averageLineLength: 0
  };

  let totalLength = 0;

  lines.forEach(line => {
    totalLength += line.length;

    // Count by level
    const levelMatch = line.match(/\[(ERROR|WARN|INFO|DEBUG|CRITICAL)\]/i);
    if (levelMatch) {
      const level = levelMatch[1].toUpperCase();
      stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
    }

    // Count by hour
    const timestamp = extractTimestamp(line);
    if (timestamp) {
      const hour = timestamp.getHours();
      stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
    }

    // Count by agent
    const agentMatch = line.match(/\[([^\]]+)\].*?\[([^\]]+)\]/);
    if (agentMatch && agentMatch[2]) {
      const agent = agentMatch[2];
      stats.topAgents[agent] = (stats.topAgents[agent] || 0) + 1;
    }
  });

  stats.averageLineLength = Math.round(totalLength / lines.length);

  // Sort top agents
  stats.topAgents = Object.entries(stats.topAgents)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});

  return {
    operation: 'stats',
    statistics: stats
  };
}

function searchLogs(lines, pattern) {
  if (!pattern) {
    throw new Error('Search pattern is required');
  }

  const regex = new RegExp(pattern, 'i');
  const matches = lines
    .map((line, index) => ({ lineNumber: index + 1, line }))
    .filter(({ line }) => regex.test(line));

  return {
    operation: 'search',
    pattern,
    matches: matches.slice(0, 100) // Limit to 100 matches
  };
}

function extractTimestamp(line) {
  const match = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  return match ? new Date(match[1]) : null;
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  process.send({ status: 'stopped', message: 'Agent stopped' });
  process.exit(0);
});

console.log('Log analyzer agent ready');

