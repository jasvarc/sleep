#!/bin/bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "Adresar appky: $APP_DIR"

echo "Stahujem najnovsiu verziu z git..."
sudo git pull

echo "Obnovujem vlastnika suborov (www-data)..."
sudo chown -R www-data:www-data "$APP_DIR"

echo "Restartujem appku..."
sudo systemctl restart sleep

sleep 1
echo ""
echo "Stav appky:"
sudo systemctl --no-pager status sleep || true
