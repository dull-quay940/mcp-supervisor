/**
 * Example Task Agent
 * A simple demo agent that showcases the basic IPC protocol and agent structure
 * This is a template for building new agents
 */

// Agent must listen for messages from supervisor
process.on('message', async (message) => {
  // Extract command and parameters
  const { cmd, params, sessionId, allowAutonomy } = message;

  if (cmd === 'run') {
    try {
      // Send initial status update
      process.send({
        status: 'running',
        progress: 0,
        message: 'Example task started'
      });

      // Simulate some work
      const taskName = params.taskName || 'default task';
      const duration = params.duration || 2000;

      await sleep(duration / 2);

      // Send progress update
      process.send({
        status: 'running',
        progress: 50,
        message: `Processing ${taskName}...`
      });

      await sleep(duration / 2);

      // Complete with result
      const result = {
        taskName,
        completedAt: new Date().toISOString(),
        message: `Successfully completed ${taskName}`,
        sessionId
      };

      process.send({
        status: 'complete',
        progress: 100,
        result
      });

      // Exit successfully
      process.exit(0);
    } catch (error) {
      // Send error status
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
  process.send({
    status: 'stopped',
    message: 'Agent received SIGTERM, shutting down'
  });
  process.exit(0);
});

process.on('SIGINT', () => {
  process.send({
    status: 'stopped',
    message: 'Agent received SIGINT, shutting down'
  });
  process.exit(0);
});

// Utility function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Indicate agent is ready
console.log('Example task agent ready');

