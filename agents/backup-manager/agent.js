/**
 * Backup Manager Agent
 * Creates and restores file/directory backups
 * Supports compression and incremental backups
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

process.on('message', async (message) => {
  const { cmd, params, sessionId, allowAutonomy } = message;

  if (cmd === 'run') {
    try {
      process.send({
        status: 'running',
        progress: 0,
        message: 'Backup manager started'
      });

      if (!allowAutonomy) {
        throw new Error('Backup operations require ALLOW_AUTONOMY=true');
      }

      const operation = params.operation; // 'create' or 'restore'
      
      let result;
      
      if (operation === 'create') {
        result = await createBackup(params);
      } else if (operation === 'restore') {
        result = await restoreBackup(params);
      } else if (operation === 'list') {
        result = await listBackups(params);
      } else {
        throw new Error(`Unknown operation: ${operation}`);
      }

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

async function createBackup(params) {
  const { sourcePath, backupDir, compress = true } = params;

  if (!sourcePath || !backupDir) {
    throw new Error('sourcePath and backupDir are required');
  }

  const source = path.resolve(sourcePath);
  const backupDirectory = path.resolve(backupDir);

  if (!fs.existsSync(source)) {
    throw new Error(`Source path not found: ${source}`);
  }

  // Create backup directory if it doesn't exist
  if (!fs.existsSync(backupDirectory)) {
    fs.mkdirSync(backupDirectory, { recursive: true });
  }

  // Generate backup filename with timestamp
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const sourceName = path.basename(source);
  const backupName = `${sourceName}_${timestamp}`;
  const backupPath = path.join(backupDirectory, backupName);

  process.send({
    status: 'running',
    progress: 30,
    message: 'Creating backup...'
  });

  // Check if source is file or directory
  const stats = fs.statSync(source);
  
  if (stats.isDirectory()) {
    if (compress) {
      // Create compressed tar archive
      const archivePath = `${backupPath}.tar.gz`;
      await execPromise(`tar -czf "${archivePath}" -C "${path.dirname(source)}" "${sourceName}"`);
      
      return {
        operation: 'create',
        type: 'directory',
        compressed: true,
        sourcePath: source,
        backupPath: archivePath,
        size: fs.statSync(archivePath).size,
        timestamp
      };
    } else {
      // Copy directory recursively
      await copyDirectory(source, backupPath);
      
      return {
        operation: 'create',
        type: 'directory',
        compressed: false,
        sourcePath: source,
        backupPath,
        timestamp
      };
    }
  } else {
    // Copy single file
    const backupFilePath = compress ? `${backupPath}.gz` : backupPath;
    
    if (compress) {
      await execPromise(`gzip -c "${source}" > "${backupFilePath}"`);
    } else {
      fs.copyFileSync(source, backupFilePath);
    }
    
    return {
      operation: 'create',
      type: 'file',
      compressed: compress,
      sourcePath: source,
      backupPath: backupFilePath,
      size: fs.statSync(backupFilePath).size,
      timestamp
    };
  }
}

async function restoreBackup(params) {
  const { backupPath, restorePath } = params;

  if (!backupPath || !restorePath) {
    throw new Error('backupPath and restorePath are required');
  }

  const backup = path.resolve(backupPath);
  const restore = path.resolve(restorePath);

  if (!fs.existsSync(backup)) {
    throw new Error(`Backup not found: ${backup}`);
  }

  process.send({
    status: 'running',
    progress: 50,
    message: 'Restoring backup...'
  });

  // Determine backup type
  if (backup.endsWith('.tar.gz')) {
    // Extract tar archive
    const restoreDir = path.dirname(restore);
    if (!fs.existsSync(restoreDir)) {
      fs.mkdirSync(restoreDir, { recursive: true });
    }
    await execPromise(`tar -xzf "${backup}" -C "${restoreDir}"`);
  } else if (backup.endsWith('.gz')) {
    // Decompress gzip file
    await execPromise(`gzip -dc "${backup}" > "${restore}"`);
  } else {
    // Direct copy
    if (fs.statSync(backup).isDirectory()) {
      await copyDirectory(backup, restore);
    } else {
      fs.copyFileSync(backup, restore);
    }
  }

  return {
    operation: 'restore',
    backupPath: backup,
    restorePath: restore,
    timestamp: new Date().toISOString()
  };
}

async function listBackups(params) {
  const { backupDir } = params;

  if (!backupDir) {
    throw new Error('backupDir is required');
  }

  const directory = path.resolve(backupDir);

  if (!fs.existsSync(directory)) {
    return {
      operation: 'list',
      backupDir: directory,
      backups: []
    };
  }

  const files = fs.readdirSync(directory);
  const backups = files.map(file => {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    
    return {
      name: file,
      path: filePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isDirectory: stats.isDirectory()
    };
  });

  return {
    operation: 'list',
    backupDir: directory,
    count: backups.length,
    backups
  };
}

// Helper function to copy directory recursively
async function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  process.send({ status: 'stopped', message: 'Agent stopped' });
  process.exit(0);
});

console.log('Backup manager agent ready');

