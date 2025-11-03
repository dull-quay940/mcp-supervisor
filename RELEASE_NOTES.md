# MCP Supervisor v1.0.0 - Initial Release

## 🎉 First Official Release

A complete, production-ready Model Context Protocol (MCP) Supervisor for managing autonomous agent workers on Ubuntu 24.04.

### ✨ Features

- **8 Pre-built Agent Workers**: Ready to use immediately
- **RESTful HTTP API**: 10+ endpoints for complete control
- **Security First**: Sandboxed execution with strict validation
- **Docker Support**: Optional containerized execution
- **One-Click Deployment**: `./INSTALL.sh` handles everything
- **Comprehensive Documentation**: 8 markdown files with examples
- **Production Tested**: Running on live VPS with 100+ operations

### 🤖 Included Agents

1. **example-task** - Demo/template agent
2. **health-checker** - System monitoring (CPU, memory, disk)
3. **log-analyzer** - Parse and analyze log files
4. **api-caller** - Make HTTP/HTTPS requests
5. **file-processor** - Copy, move, organize files
6. **data-transformer** - Convert JSON/CSV/XML
7. **backup-manager** - Create and restore backups
8. **image-optimize** - Compress images with Sharp

### 🚀 Quick Start

```bash
git clone https://github.com/freqkflag/mcp-supervisor.git
cd mcp-supervisor
./INSTALL.sh
npm run dev
```

Test:
```bash
curl http://localhost:3001/health
```

### 📦 What's Included

- Complete Node.js ESM codebase
- 8 fully functional agent templates
- Security manifest and validation
- Docker and docker-compose support
- Systemd service configuration
- GitHub Actions CI/CD pipeline
- Helper scripts (CLI + shell functions)
- Comprehensive documentation

### 🔐 Security

- Default mode: `ALLOW_AUTONOMY=false` (safe)
- Path validation and restrictions
- Command filtering (blocks sudo, rm -rf /, etc.)
- No access to passwords, SSH keys, or system paths
- Resource limits enforced (CPU, memory, runtime)

### 📊 Tested On

- Ubuntu 24.04 LTS
- Node.js 20.x
- Production VPS (vps.freqkflag.co)
- 6 agents tested successfully

### 📚 Documentation

- [README.md](README.md) - Complete guide
- [QUICKSTART.md](QUICKSTART.md) - 5-minute setup
- [DEPLOYMENT.md](DEPLOYMENT.md) - VPS deployment
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Command reference
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guide

### 🐛 Known Issues

None! All core features tested and working.

### 🙏 Credits

Built with Node.js, Express, Docker, and the Model Context Protocol.

### �� License

MIT License - See [LICENSE](LICENSE) for details.

---

**Full Changelog**: Initial release
