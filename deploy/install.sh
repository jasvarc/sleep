#!/bin/bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Tento skript spusti s sudo: sudo bash deploy/install.sh"
  exit 1
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "Adresar appky: $APP_DIR"

git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js nie je najdeny v PATH. Najprv ho nainstaluj (pozri README-DEPLOY.md) a skript spusti znova."
  exit 1
fi
echo "Node.js verzia: $(node -v)"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "Vytváram .env z .env.example (treba doplnit ICAL_URL - pozri README-DEPLOY.md)..."
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
fi

echo "Nastavujem vlastnika suborov na www-data..."
chown -R www-data:www-data "$APP_DIR"

echo "Instalujem systemd sluzbu..."
sed "s|__APP_DIR__|$APP_DIR|g" "$APP_DIR/deploy/sleep.service" > /etc/systemd/system/sleep.service
systemctl daemon-reload
systemctl enable --now sleep

sleep 1
systemctl --no-pager status sleep || true

echo ""
echo "Dalsie kroky:"
echo "1. Doplň ICAL_URL v $APP_DIR/.env (secret adresa kalendara Sleep as Android) a: sudo systemctl restart sleep"
echo "2. Pridaj do svojho Apache vhostu riadky z $APP_DIR/deploy/apache-sleep.conf a restartuj apache: sudo systemctl restart apache2"
echo "3. Otvor http://tvoj-server/sleep/ v prehliadaci."
