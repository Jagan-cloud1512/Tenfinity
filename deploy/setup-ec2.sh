#!/bin/bash
set -e

echo "============================================"
echo "  AdaptQ Backend — EC2 Setup Script"
echo "============================================"

# --- System packages ---
echo "[1/6] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq python3.11 python3.11-venv python3-pip gcc g++ git > /dev/null

# --- Clone repo ---
echo "[2/6] Cloning repository..."
cd /home/ubuntu
if [ -d "Tenfinity" ]; then
    cd Tenfinity && git pull origin main
else
    git clone https://github.com/Jagan-cloud1512/Tenfinity.git
    cd Tenfinity
fi

# --- Python venv + deps ---
echo "[3/6] Setting up Python environment..."
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

# --- Environment file ---
echo "[4/6] Setting up environment variables..."
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

# Server
HOST=0.0.0.0
PORT=8000
DEBUG=false
FRONTEND_URL=REPLACE_ME
ENVEOF
    echo ""
    echo ">>> IMPORTANT: Edit /home/ubuntu/Tenfinity/backend/.env with your actual keys!"
    echo ">>>   nano /home/ubuntu/Tenfinity/backend/.env"
    echo ""
fi

# --- Systemd service ---
echo "[5/6] Creating systemd service..."
sudo tee /etc/systemd/system/adaptq.service > /dev/null << 'SVCEOF'
[Unit]
Description=AdaptQ Backend API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/Tenfinity/backend
Environment=PATH=/home/ubuntu/Tenfinity/backend/.venv/bin:/usr/bin
ExecStart=/home/ubuntu/Tenfinity/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl enable adaptq

# --- Start ---
echo "[6/6] Starting backend..."
sudo systemctl restart adaptq

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "  Backend running on port 8000"
echo "  Public URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8000"
echo ""
echo "  Commands:"
echo "    Check status:  sudo systemctl status adaptq"
echo "    View logs:     sudo journalctl -u adaptq -f"
echo "    Edit env:      nano /home/ubuntu/Tenfinity/backend/.env"
echo "    Restart:       sudo systemctl restart adaptq"
echo ""
echo "  Next: Edit .env with your API keys, then restart"
echo "============================================"
