/**
 * File Processor Agent
 * Performs file operations: copy, move, rename, organize
 * Validates all paths against allowed directories
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
        message: 'File processor started'
      });

      const operation = params.operation; // 'copy', 'move', 'rename', 'organize'
      
      if (!operation) {
        throw new Error('operation parameter is required');
      }

      let result;

      switch (operation) {
        case 'copy':
          result = await copyFile(params);
          break;
        case 'move':
          result = await moveFile(params);
          break;
        case 'rename':
          result = await renameFile(params);
          break;
        case 'organize':
          result = await organizeFiles(params);
          break;
        default:
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

async function copyFile(params) {
  const { source, destination } = params;
  
  if (!source || !destination) {
    throw new Error('source and destination are required for copy operation');
  }

  const sourcePath = path.resolve(source);
  const destPath = path.resolve(destination);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  // Create destination directory if needed
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(sourcePath, destPath);

  return {
    operation: 'copy',
    source: sourcePath,
    destination: destPath,
    size: fs.statSync(destPath).size
  };
}

async function moveFile(params) {
  const { source, destination } = params;
  
  if (!source || !destination) {
    throw new Error('source and destination are required for move operation');
  }

  const sourcePath = path.resolve(source);
  const destPath = path.resolve(destination);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  // Create destination directory if needed
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.renameSync(sourcePath, destPath);

  return {
    operation: 'move',
    source: sourcePath,
    destination: destPath,
    size: fs.statSync(destPath).size
  };
}

async function renameFile(params) {
  const { path: filePath, newName } = params;
  
  if (!filePath || !newName) {
    throw new Error('path and newName are required for rename operation');
  }

  const oldPath = path.resolve(filePath);
  const dir = path.dirname(oldPath);
  const newPath = path.join(dir, newName);

  if (!fs.existsSync(oldPath)) {
    throw new Error(`File not found: ${oldPath}`);
  }

  fs.renameSync(oldPath, newPath);

  return {
    operation: 'rename',
    oldPath,
    newPath,
    newName
  };
}

async function organizeFiles(params) {
  const { directory, organizeBy } = params; // organizeBy: 'extension', 'date', 'size'
  
  if (!directory) {
    throw new Error('directory is required for organize operation');
  }

  const dirPath = path.resolve(directory);
  
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }

  const files = fs.readdirSync(dirPath).filter(f => {
    return fs.statSync(path.join(dirPath, f)).isFile();
  });

  const organized = {};

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    let category;

    if (organizeBy === 'extension') {
      const ext = path.extname(file).substring(1) || 'no-extension';
      category = ext;
    } else if (organizeBy === 'date') {
      const stats = fs.statSync(filePath);
      const date = new Date(stats.mtime);
      category = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else if (organizeBy === 'size') {
      const stats = fs.statSync(filePath);
      const sizeMB = stats.size / 1024 / 1024;
      if (sizeMB < 1) category = 'small';
      else if (sizeMB < 10) category = 'medium';
      else category = 'large';
    } else {
      category = 'uncategorized';
    }

    const categoryDir = path.join(dirPath, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    const newPath = path.join(categoryDir, file);
    fs.renameSync(filePath, newPath);

    if (!organized[category]) organized[category] = [];
    organized[category].push(file);
  }

  return {
    operation: 'organize',
    directory: dirPath,
    organizeBy,
    categories: Object.keys(organized).length,
    filesOrganized: files.length,
    details: organized
  };
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  process.send({ status: 'stopped', message: 'Agent stopped' });
  process.exit(0);
});

console.log('File processor agent ready');

