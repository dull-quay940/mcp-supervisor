#!/bin/bash

# MCP Supervisor Setup Script
# This script sets up the MCP Supervisor on Ubuntu 24.04

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           MCP Supervisor Setup Script                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js is installed: $(node --version)"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
else
    echo "✅ npm is installed: $(npm --version)"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create directories
echo ""
echo "📁 Creating required directories..."
mkdir -p logs workspace backups

# Copy .env.example to .env if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your configuration."
else
    echo "✅ .env file already exists"
fi

# Make index.js executable
chmod +x index.js

# Check if Docker is installed (optional)
echo ""
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed: $(docker --version)"
    echo "   Docker sandboxing is available"
else
    echo "⚠️  Docker is not installed"
    echo "   Agents will run in process mode (fork)"
    echo "   To install Docker, run: curl -fsSL https://get.docker.com | sudo sh"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                   Setup Complete! 🎉                           ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  Next steps:                                                   ║"
echo "║  1. Edit .env file:     nano .env                             ║"
echo "║  2. Start supervisor:   npm run dev                           ║"
echo "║  3. Test API:           curl http://localhost:3001/health     ║"
echo "║                                                                ║"
echo "║  Documentation:         cat README.md                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

