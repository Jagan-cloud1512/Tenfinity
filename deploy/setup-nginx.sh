#!/bin/bash
set -euo pipefail

echo "=== Setting up Nginx + Frontend on EC2 ==="

# Install nginx and Node.js
echo "[1/4] Installing nginx and Node.js..."
sudo apt-get update -qq
sudo apt-get install -y -qq nginx > /dev/null
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
sudo apt-get install -y -qq nodejs > /dev/null

# Build frontend
echo "[2/4] Building frontend..."
cd /home/ubuntu/Tenfinity/frontend
npm ci --silent
VITE_SUPABASE_URL="${VITE_SUPABASE_URL}" \
VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY}" \
npm run build

# Configure nginx
echo "[3/4] Configuring nginx..."
sudo cp /home/ubuntu/Tenfinity/deploy/nginx.conf /etc/nginx/sites-available/adaptq
sudo ln -sf /etc/nginx/sites-available/adaptq /etc/nginx/sites-enabled/adaptq
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t

# Start nginx
echo "[4/4] Starting nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "=== Done! ==="
echo "Frontend + API running on http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo ""
