/**
 * API Caller Agent
 * Makes HTTP/HTTPS requests to external APIs
 * Supports GET, POST, PUT, DELETE methods with headers and body
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

process.on('message', async (message) => {
  const { cmd, params, sessionId, allowAutonomy } = message;

  if (cmd === 'run') {
    try {
      process.send({
        status: 'running',
        progress: 0,
        message: 'API caller started'
      });

      // Check if network access is allowed
      if (!allowAutonomy) {
        throw new Error('API calls require ALLOW_AUTONOMY=true');
      }

      const { url, method = 'GET', headers = {}, body, timeout = 30000 } = params;

      if (!url) {
        throw new Error('url parameter is required');
      }

      process.send({
        status: 'running',
        progress: 30,
        message: `Making ${method} request to ${url}...`
      });

      const result = await makeRequest(url, method, headers, body, timeout);

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

function makeRequest(urlString, method, headers, body, timeout) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlString);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers: {
        'User-Agent': 'MCP-Supervisor-Agent/1.0',
        ...headers
      },
      timeout
    };

    // Add Content-Type and Content-Length for POST/PUT
    if (body && (method === 'POST' || method === 'PUT')) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const startTime = Date.now();

    const req = lib.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        
        let parsedData = data;
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          // Not JSON, keep as string
        }

        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: parsedData,
          duration,
          url: urlString,
          method
        });
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });

    // Send body if present
    if (body && (method === 'POST' || method === 'PUT')) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(bodyStr);
    }

    req.end();
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  process.send({ status: 'stopped', message: 'Agent stopped' });
  process.exit(0);
});

console.log('API caller agent ready');

