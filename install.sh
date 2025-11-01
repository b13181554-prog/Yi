#!/bin/bash

# ==============================================
# OBENTCHI Bot - AWS Installation Script
# ==============================================
# This script automates the installation of OBENTCHI Bot on AWS EC2
# Ubuntu 22.04 LTS

set -e  # Exit on error

echo "======================================"
echo "OBENTCHI Bot - AWS Installer"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please do not run this script as root${NC}"
   echo "Run as ubuntu user: ./install.sh"
   exit 1
fi

echo -e "${YELLOW}Step 1:${NC} Updating system packages..."
sudo apt update && sudo apt upgrade -y

echo ""
echo -e "${YELLOW}Step 2:${NC} Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    echo -e "${GREEN}✓${NC} Node.js installed: $(node --version)"
else
    echo -e "${GREEN}✓${NC} Node.js already installed: $(node --version)"
fi

echo ""
echo -e "${YELLOW}Step 3:${NC} Installing Redis..."
if ! command -v redis-server &> /dev/null; then
    sudo apt install -y redis-server
    
    # Configure Redis to start on boot
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
    
    echo -e "${GREEN}✓${NC} Redis installed and running"
else
    echo -e "${GREEN}✓${NC} Redis already installed"
    sudo systemctl start redis-server
fi

# Test Redis
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Redis is responding"
else
    echo -e "${RED}✗${NC} Redis is not responding!"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 4:${NC} Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo -e "${GREEN}✓${NC} PM2 installed"
else
    echo -e "${GREEN}✓${NC} PM2 already installed"
fi

echo ""
echo -e "${YELLOW}Step 5:${NC} Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    echo -e "${GREEN}✓${NC} Nginx installed and running"
else
    echo -e "${GREEN}✓${NC} Nginx already installed"
fi

echo ""
echo -e "${YELLOW}Step 6:${NC} Installing project dependencies..."
if [ -f "package.json" ]; then
    npm install --production
    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${RED}✗${NC} package.json not found! Are you in the project directory?"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 7:${NC} Setting up environment variables..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}!${NC} .env file created from .env.example"
        echo -e "${YELLOW}!${NC} Please edit .env file with your configuration:"
        echo "   nano .env"
    else
        echo -e "${RED}✗${NC} .env.example not found!"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} .env file already exists"
fi

echo ""
echo -e "${YELLOW}Step 8:${NC} Creating logs directory..."
mkdir -p logs
echo -e "${GREEN}✓${NC} Logs directory created"

echo ""
echo -e "${YELLOW}Step 9:${NC} Setting up PM2 startup..."
pm2 startup | grep "sudo" | bash
echo -e "${GREEN}✓${NC} PM2 configured to start on boot"

echo ""
echo "======================================"
echo -e "${GREEN}Installation Complete!${NC}"
echo "======================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure your .env file:"
echo "   nano .env"
echo ""
echo "2. Setup Nginx configuration:"
echo "   sudo cp deployment/nginx.conf /etc/nginx/sites-available/obentchi-bot"
echo "   sudo ln -s /etc/nginx/sites-available/obentchi-bot /etc/nginx/sites-enabled/"
echo "   sudo nginx -t"
echo "   sudo systemctl restart nginx"
echo ""
echo "3. Start the bot:"
echo "   pm2 start ecosystem.config.js --env production"
echo "   pm2 save"
echo ""
echo "4. Monitor the bot:"
echo "   pm2 logs obentchi-bot"
echo "   pm2 status"
echo ""
echo -e "For detailed instructions, see: ${YELLOW}AWS_DEPLOYMENT.md${NC}"
echo ""
