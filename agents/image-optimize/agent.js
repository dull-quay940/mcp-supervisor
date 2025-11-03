/**
 * Image Optimization Agent
 * Compresses and optimizes images using the Sharp library
 * Supports multiple formats: JPEG, PNG, WebP
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

process.on('message', async (message) => {
  const { cmd, params, sessionId, allowAutonomy } = message;

  if (cmd === 'run') {
    try {
      process.send({
        status: 'running',
        progress: 0,
        message: 'Image optimization started'
      });

      // Validate required parameters
      if (!params.inputPath) {
        throw new Error('inputPath parameter is required');
      }

      const inputPath = path.resolve(params.inputPath);
      const outputPath = params.outputPath 
        ? path.resolve(params.outputPath)
        : inputPath.replace(/\.(jpg|jpeg|png|webp)$/i, '_optimized.$1');

      const quality = params.quality || 80;
      const format = params.format || 'same'; // 'same', 'jpeg', 'png', 'webp'

      // Check if input file exists
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      process.send({
        status: 'running',
        progress: 30,
        message: 'Loading image...'
      });

      // Load image
      let image = sharp(inputPath);
      const metadata = await image.metadata();

      process.send({
        status: 'running',
        progress: 50,
        message: `Optimizing ${metadata.format} image...`
      });

      // Apply optimization based on format
      if (format === 'webp') {
        image = image.webp({ quality });
      } else if (format === 'jpeg' || (format === 'same' && metadata.format === 'jpeg')) {
        image = image.jpeg({ quality, mozjpeg: true });
      } else if (format === 'png' || (format === 'same' && metadata.format === 'png')) {
        image = image.png({ quality, compressionLevel: 9 });
      }

      // Save optimized image
      await image.toFile(outputPath);

      // Get file sizes
      const originalSize = fs.statSync(inputPath).size;
      const optimizedSize = fs.statSync(outputPath).size;
      const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);

      const result = {
        inputPath,
        outputPath,
        originalSize,
        optimizedSize,
        savings: `${savings}%`,
        format: metadata.format,
        dimensions: {
          width: metadata.width,
          height: metadata.height
        }
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

// Handle graceful shutdown
process.on('SIGTERM', () => {
  process.send({ status: 'stopped', message: 'Agent stopped' });
  process.exit(0);
});

console.log('Image optimization agent ready');

