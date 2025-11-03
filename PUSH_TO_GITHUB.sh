#!/bin/bash
# Quick script to push to GitHub
# Usage: ./PUSH_TO_GITHUB.sh YOUR_GITHUB_USERNAME

if [ -z "$1" ]; then
    echo "Usage: ./PUSH_TO_GITHUB.sh YOUR_GITHUB_USERNAME"
    echo "Example: ./PUSH_TO_GITHUB.sh johndoe"
    exit 1
fi

USERNAME=$1
REPO_NAME="mcp-supervisor"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         Pushing MCP Supervisor to GitHub                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Username: $USERNAME"
echo "Repository: $REPO_NAME"
echo ""
echo "Make sure you've created the repository on GitHub first:"
echo "https://github.com/new"
echo ""
read -p "Have you created the GitHub repository? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please create the repository first, then run this script again."
    exit 1
fi

# Check if remote already exists
if git remote get-url origin &> /dev/null; then
    echo "Remote 'origin' already exists. Removing..."
    git remote remove origin
fi

# Add remote
echo "Adding remote..."
git remote add origin "https://github.com/$USERNAME/$REPO_NAME.git"

# Push
echo "Pushing to GitHub..."
git push -u origin main

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                  Push Complete! ✓                             ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  Your repository is now live at:                             ║"
echo "║  https://github.com/$USERNAME/$REPO_NAME    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Add repository topics on GitHub"
echo "2. Enable GitHub Actions"
echo "3. Share with the community!"
echo ""
