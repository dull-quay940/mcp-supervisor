# Contributing to MCP Supervisor

Thank you for considering contributing to MCP Supervisor! This document provides guidelines for contributing to the project.

## 🤝 How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/freqkflag/mcp-supervisor/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Relevant logs from `logs/actions.log`

### Suggesting Enhancements

1. Check existing issues for similar suggestions
2. Create a new issue with:
   - Clear use case
   - Proposed solution
   - Benefits and potential drawbacks

### Creating New Agents

The best way to contribute is by creating new agent templates!

#### Agent Template Structure

```
agents/your-agent-name/
├── agent.js       # Main agent code
└── config.json    # Agent metadata
```

#### Example Agent (`agent.js`)

```javascript
process.on('message', async (message) => {
  const { cmd, params, sessionId, allowAutonomy } = message;

  if (cmd === 'run') {
    try {
      // Send initial status
      process.send({
        status: 'running',
        progress: 0,
        message: 'Agent started'
      });

      // Your agent logic here
      const result = await yourFunction(params);

      // Send completion
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
  process.send({ status: 'stopped' });
  process.exit(0);
});

console.log('Your agent ready');
```

#### Agent Config (`config.json`)

```json
{
  "id": "your-agent-name",
  "name": "Your Agent Name",
  "version": "1.0.0",
  "description": "What your agent does",
  "capabilities": ["capability1", "capability2"],
  "requiresAutonomy": false,
  "defaultTimeout": 60000,
  "parameters": {
    "param1": {
      "type": "string",
      "description": "Parameter description",
      "required": true
    }
  },
  "examples": [
    {
      "description": "Example usage",
      "params": {
        "param1": "value"
      }
    }
  ]
}
```

#### Register Your Agent

Add to `registry.json`:

```json
{
  "id": "your-agent-name",
  "name": "Your Agent Name",
  "version": "1.0.0",
  "description": "What your agent does",
  "path": "./agents/your-agent-name/agent.js",
  "configPath": "./agents/your-agent-name/config.json",
  "capabilities": ["capability1"],
  "requiresAutonomy": false,
  "defaultTimeout": 60000,
  "dockerImage": null,
  "enabled": true,
  "category": "your-category"
}
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-agent`
3. Make your changes
4. Test thoroughly:
   ```bash
   npm install
   npm run dev
   # Test your agent
   curl -X POST http://localhost:3001/run-agent \
     -H "Content-Type: application/json" \
     -d '{"agentId":"your-agent-name","params":{...}}'
   ```
5. Commit with clear messages:
   ```bash
   git commit -m "Add: New agent for X functionality"
   ```
6. Push to your fork:
   ```bash
   git push origin feature/amazing-agent
   ```
7. Open a Pull Request with:
   - Clear description of changes
   - Test results
   - Documentation updates

## 📝 Code Style

### JavaScript/Node.js

- Use ESM (import/export)
- Use async/await over callbacks
- Add JSDoc comments for functions
- Handle errors gracefully
- Use meaningful variable names

```javascript
/**
 * Process data with specified parameters
 * @param {object} params - Processing parameters
 * @returns {Promise<object>} Processed result
 */
async function processData(params) {
  try {
    // Implementation
  } catch (error) {
    throw new Error(`Processing failed: ${error.message}`);
  }
}
```

### Error Handling

Always provide clear error messages:

```javascript
if (!params.required) {
  throw new Error('Parameter "required" is missing');
}
```

### Logging

Use IPC messages for progress updates:

```javascript
process.send({
  status: 'running',
  progress: 50,
  message: 'Processing halfway done'
});
```

## 🧪 Testing

### Manual Testing

Test your agent before submitting:

```bash
# Start supervisor
npm run dev

# Test your agent
curl -X POST http://localhost:3001/run-agent \
  -H "Content-Type: application/json" \
  -d '{"agentId":"your-agent","params":{...}}'

# Check logs
tail -f logs/actions.log
```

### Test Checklist

- [ ] Agent starts successfully
- [ ] Parameters are validated
- [ ] Progress updates are sent
- [ ] Results are returned correctly
- [ ] Errors are handled gracefully
- [ ] Agent responds to SIGTERM
- [ ] No security violations
- [ ] Within allowed directories
- [ ] Documentation is complete

## 📚 Documentation

### Required Documentation

When adding new features:

1. Update README.md if needed
2. Add examples to config.json
3. Update QUICK_REFERENCE.md with new commands
4. Add inline code comments
5. Update API documentation if adding endpoints

### Documentation Style

- Use clear, concise language
- Provide examples
- Explain the "why" not just the "what"
- Include error scenarios

## 🔒 Security Guidelines

### Agent Security

- Never access files outside allowed directories
- Validate all input parameters
- Don't execute arbitrary commands
- Check `allowAutonomy` flag for destructive operations
- Log all significant actions

### Blocked Operations

Never implement agents that:
- Access passwords or keys
- Execute `sudo` or gain root access
- Access `/etc/passwd`, `/etc/shadow`
- Access SSH keys (`~/.ssh`)
- Run dangerous commands (rm -rf /, dd, etc.)

## 🎯 Areas for Contribution

### High Priority

- [ ] New agent templates (database, networking, etc.)
- [ ] Docker sandboxing improvements
- [ ] Authentication middleware
- [ ] Agent timeout handling improvements
- [ ] Better error recovery

### Medium Priority

- [ ] Web UI for agent management
- [ ] Agent scheduling system
- [ ] Webhook integrations
- [ ] Monitoring dashboard
- [ ] Agent dependency management

### Low Priority

- [ ] Agent marketplace
- [ ] Remote agent execution
- [ ] Agent versioning system
- [ ] Performance optimizations

## 📞 Questions?

- Open an issue with the `question` label
- Check existing documentation
- Review closed issues for similar questions

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to MCP Supervisor! 🎉

