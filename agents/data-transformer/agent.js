/**
 * Data Transformer Agent
 * Converts data between formats: JSON, CSV, XML
 * Can also perform data filtering and mapping operations
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
        message: 'Data transformer started'
      });

      const { inputPath, outputPath, inputFormat, outputFormat } = params;

      if (!inputPath || !outputPath) {
        throw new Error('inputPath and outputPath are required');
      }

      if (!inputFormat || !outputFormat) {
        throw new Error('inputFormat and outputFormat are required');
      }

      process.send({
        status: 'running',
        progress: 30,
        message: `Reading ${inputFormat} data...`
      });

      // Read input file
      const inputData = fs.readFileSync(path.resolve(inputPath), 'utf8');

      // Parse input
      let data;
      switch (inputFormat.toLowerCase()) {
        case 'json':
          data = JSON.parse(inputData);
          break;
        case 'csv':
          data = parseCSV(inputData);
          break;
        case 'xml':
          data = parseSimpleXML(inputData);
          break;
        default:
          throw new Error(`Unsupported input format: ${inputFormat}`);
      }

      process.send({
        status: 'running',
        progress: 60,
        message: `Converting to ${outputFormat}...`
      });

      // Convert to output format
      let output;
      switch (outputFormat.toLowerCase()) {
        case 'json':
          output = JSON.stringify(data, null, 2);
          break;
        case 'csv':
          output = toCSV(data);
          break;
        case 'xml':
          output = toSimpleXML(data);
          break;
        default:
          throw new Error(`Unsupported output format: ${outputFormat}`);
      }

      // Write output file
      fs.writeFileSync(path.resolve(outputPath), output, 'utf8');

      const result = {
        inputPath: path.resolve(inputPath),
        outputPath: path.resolve(outputPath),
        inputFormat,
        outputFormat,
        recordCount: Array.isArray(data) ? data.length : 1,
        outputSize: Buffer.byteLength(output)
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

// Simple CSV parser
function parseCSV(csvString) {
  const lines = csvString.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
}

// Convert array of objects to CSV
function toCSV(data) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Data must be a non-empty array for CSV output');
  }

  const headers = Object.keys(data[0]);
  const csvLines = [headers.join(',')];

  data.forEach(obj => {
    const values = headers.map(header => {
      const value = obj[header] || '';
      // Escape commas and quotes
      return String(value).includes(',') ? `"${value}"` : value;
    });
    csvLines.push(values.join(','));
  });

  return csvLines.join('\n');
}

// Simple XML parser (basic implementation)
function parseSimpleXML(xmlString) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlString)) !== null) {
    const itemContent = match[1];
    const obj = {};
    
    const tagRegex = /<(\w+)>(.*?)<\/\1>/g;
    let tagMatch;
    
    while ((tagMatch = tagRegex.exec(itemContent)) !== null) {
      obj[tagMatch[1]] = tagMatch[2];
    }
    
    items.push(obj);
  }

  return items.length > 0 ? items : { data: xmlString };
}

// Convert to simple XML
function toSimpleXML(data) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';

  if (Array.isArray(data)) {
    data.forEach(item => {
      xml += '  <item>\n';
      Object.entries(item).forEach(([key, value]) => {
        xml += `    <${key}>${escapeXML(String(value))}</${key}>\n`;
      });
      xml += '  </item>\n';
    });
  } else {
    Object.entries(data).forEach(([key, value]) => {
      xml += `  <${key}>${escapeXML(String(value))}</${key}>\n`;
    });
  }

  xml += '</root>';
  return xml;
}

function escapeXML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  process.send({ status: 'stopped', message: 'Agent stopped' });
  process.exit(0);
});

console.log('Data transformer agent ready');

