#!/bin/bash
# Manual deploy script — run from EC2 if you need to deploy without GitHub Actions
set -euo pipefail

cd /home/ubuntu/Tenfinity

echo "--- Pulling latest code ---"
git fetch origin main
git reset --hard origin/main

echo "--- Updating Python deps ---"
cd backend
source .venv/bin/activate
pip install -q -r requirements.txt

echo "--- Updating Judge0 stack ---"
cd /home/ubuntu/Tenfinity/deploy
docker compose -f docker-compose.judge0.yml pull --quiet
docker compose -f docker-compose.judge0.yml up -d

echo "--- Restarting backend ---"
sudo systemctl restart adaptq

echo "--- Health check ---"
sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/)
if [ "$HTTP_CODE" = "200" ]; then
    echo "Deploy successful — backend healthy (HTTP $HTTP_CODE)"
else
    echo "FAILED: Backend returned HTTP $HTTP_CODE"
    sudo journalctl -u adaptq --no-pager -n 20
    exit 1
fi
