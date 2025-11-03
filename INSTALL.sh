#!/bin/bash
set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         MCP Supervisor - One-Click Installation               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo -e "${YELLOW}Note: Some operations may require sudo${NC}"
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    echo -e "${RED}Cannot detect OS${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Detected: $OS $VER"

# Function to install Node.js
install_nodejs() {
    echo ""
    echo "Installing Node.js 20..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}✓${NC} Node.js already installed: $NODE_VERSION"
        
        # Check if version is acceptable (18+)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
        if [ "$MAJOR_VERSION" -ge 18 ]; then
            echo -e "${GREEN}✓${NC} Node.js version is acceptable"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} Node.js version too old, upgrading..."
        fi
    fi
    
    # Install Node.js 20
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    else
        echo -e "${RED}✗${NC} Unsupported OS for automatic Node.js installation"
        echo "Please install Node.js 18+ manually from https://nodejs.org/"
        exit 1
    fi
    
    echo -e "${GREEN}✓${NC} Node.js installed: $(node --version)"
}

# Function to install Docker (optional)
install_docker() {
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✓${NC} Docker already installed: $(docker --version)"
        return 0
    fi
    
    read -p "Install Docker for enhanced sandboxing? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Installing Docker..."
        curl -fsSL https://get.docker.com | sudo sh
        sudo usermod -aG docker $USER
        echo -e "${GREEN}✓${NC} Docker installed"
        echo -e "${YELLOW}Note: You may need to log out and back in for Docker permissions${NC}"
    else
        echo "Skipping Docker installation (will use fork mode)"
    fi
}

# Function to setup firewall
setup_firewall() {
    if command -v ufw &> /dev/null; then
        read -p "Configure firewall to allow port 3001? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo ufw allow 3001/tcp
            echo -e "${GREEN}✓${NC} Firewall configured"
        fi
    fi
}

# Main installation
echo ""
echo "Starting installation..."
echo ""

# Install Node.js
install_nodejs

# Install Docker (optional)
install_docker

# Install dependencies
echo ""
echo "Installing npm dependencies..."
npm install
echo -e "${GREEN}✓${NC} Dependencies installed"

# Create directories
echo ""
echo "Creating required directories..."
mkdir -p logs workspace backups
echo -e "${GREEN}✓${NC} Directories created"

# Setup environment
echo ""
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo -e "${GREEN}✓${NC} Environment file created"
    echo -e "${YELLOW}⚠${NC} Please review and edit .env file for your configuration"
else
    echo -e "${GREEN}✓${NC} .env file already exists"
fi

# Setup firewall
setup_firewall

# Make scripts executable
echo ""
echo "Setting up helper scripts..."
chmod +x index.js mcp-helper.sh mcp-functions.sh setup.sh 2>/dev/null || true
echo -e "${GREEN}✓${NC} Scripts configured"

# Test installation
echo ""
echo "Testing installation..."
if npm run dev -- --version &> /dev/null; then
    echo -e "${GREEN}✓${NC} Installation test passed"
else
    echo -e "${YELLOW}⚠${NC} Could not verify installation"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              Installation Complete! ✓                         ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  Next Steps:                                                  ║"
echo "║  1. Review configuration: nano .env                          ║"
echo "║  2. Start supervisor:     npm run dev                        ║"
echo "║  3. Test API:             curl http://localhost:3001/health  ║"
echo "║                                                               ║"
echo "║  Documentation:           cat README.md                      ║"
echo "║  Quick Reference:         cat QUICK_REFERENCE.md             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
