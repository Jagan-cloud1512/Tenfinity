#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  AdaptQ Backend — EC2 Setup (DevSecOps)"
echo "============================================"

# --- Swap (required for t2.micro 1GB RAM + Judge0) ---
echo "[1/8] Configuring 2GB swap..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
fi

# --- System packages ---
echo "[2/8] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
    python3 python3-venv python3-pip gcc g++ git \
    ca-certificates curl gnupg unattended-upgrades fail2ban ufw > /dev/null

# --- Enable automatic security updates ---
echo "[3/8] Enabling automatic security updates..."
sudo dpkg-reconfigure -plow unattended-upgrades 2>/dev/null || true

# --- Firewall (UFW) ---
echo "[4/8] Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable

# --- Docker (for Judge0) ---
echo "[5/8] Installing Docker..."
if ! command -v docker &> /dev/null; then
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin > /dev/null
    sudo usermod -aG docker ubuntu
fi

# --- Clone repo ---
echo "[6/8] Cloning repository..."
cd /home/ubuntu
if [ -d "Tenfinity" ]; then
    cd Tenfinity && git pull origin main
else
    git clone https://github.com/Jagan-cloud1512/Tenfinity.git
    cd Tenfinity
fi

# --- Python venv + deps ---
echo "[7/8] Setting up Python environment..."
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

# --- Environment file ---
if [ ! -f .env ]; then
    cat > .env << 'ENVEOF'
# LLM Providers
GROQ_API_KEY=REPLACE_ME
GROQ_MODEL=qwen/qwen3.8-27b
OPENROUTER_API_KEY=REPLACE_ME
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
DEFAULT_MODE=auto
PROVIDER_PRIORITY=groq,openrouter,ollama

# Search
SEARCH_BACKEND=duckduckgo

# Supabase
SUPABASE_URL=REPLACE_ME
SUPABASE_ANON_KEY=REPLACE_ME
SUPABASE_SERVICE_ROLE_KEY=REPLACE_ME

# Code Execution — "judge0" for Docker-based, "piston" for subprocess
CODE_EXECUTOR=judge0
JUDGE0_URL=http://localhost:2358

# Server
HOST=0.0.0.0
PORT=8000
DEBUG=false
FRONTEND_URL=REPLACE_ME
ENVEOF
    chmod 600 .env
    echo ""
    echo ">>> IMPORTANT: Edit /home/ubuntu/Tenfinity/backend/.env with your actual keys!"
    echo ">>>   nano /home/ubuntu/Tenfinity/backend/.env"
    echo ""
fi

# --- Systemd service for backend ---
echo "[8/8] Creating systemd services..."
sudo tee /etc/systemd/system/adaptq.service > /dev/null << 'SVCEOF'
[Unit]
Description=AdaptQ Backend API
After=network.target docker.service
Wants=judge0.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/Tenfinity/backend
Environment=PATH=/home/ubuntu/Tenfinity/backend/.venv/bin:/usr/bin
ExecStart=/home/ubuntu/Tenfinity/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/home/ubuntu/Tenfinity/backend /tmp
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SVCEOF

# --- Systemd service for Judge0 (Docker Compose) ---
sudo tee /etc/systemd/system/judge0.service > /dev/null << 'J0EOF'
[Unit]
Description=Judge0 Code Execution Engine
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=ubuntu
WorkingDirectory=/home/ubuntu/Tenfinity/deploy
ExecStart=/usr/bin/docker compose -f docker-compose.judge0.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.judge0.yml down

[Install]
WantedBy=multi-user.target
J0EOF

sudo systemctl daemon-reload
sudo systemctl enable judge0 adaptq

# --- Start Judge0 first, then backend ---
echo ""
echo "Starting Judge0..."
sudo systemctl start judge0
echo "Waiting for Judge0 to be ready..."
sleep 15
echo "Starting backend..."
sudo systemctl restart adaptq

PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "UNKNOWN")

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "  Backend:   http://${PUBLIC_IP}:8000"
echo "  Judge0:    http://localhost:2358 (internal only)"
echo "  Frontend:  Set FRONTEND_URL in .env"
echo ""
echo "  Commands:"
echo "    Check backend:  sudo systemctl status adaptq"
echo "    Check judge0:   sudo systemctl status judge0"
echo "    Backend logs:   sudo journalctl -u adaptq -f"
echo "    Judge0 logs:    cd ~/Tenfinity/deploy && docker compose -f docker-compose.judge0.yml logs -f"
echo "    Edit env:       nano ~/Tenfinity/backend/.env"
echo "    Restart all:    sudo systemctl restart judge0 && sudo systemctl restart adaptq"
echo ""
echo "  Security:"
echo "    - Firewall active (ports 22, 80, 443 only)"
echo "    - fail2ban enabled for SSH brute force protection"
echo "    - Judge0 bound to localhost only (not exposed to internet)"
echo "    - Automatic security updates enabled"
echo "    - .env file permissions set to 600 (owner-only read)"
echo ""
echo "  NEXT STEPS:"
echo "    1. Edit .env with your API keys:  nano ~/Tenfinity/backend/.env"
echo "    2. Restart:  sudo systemctl restart adaptq"
echo "    3. Update Vercel frontend with your EC2 public IP"
echo "============================================"
