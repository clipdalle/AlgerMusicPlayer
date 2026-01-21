#!/usr/bin/env bash
set -euo pipefail

# Install Node.js 20 LTS + npm (Ubuntu/Debian)
# Ref: https://github.com/nodesource/distributions

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

sudo apt-get install -y nodejs

node -v
npm -v

# Install project dependencies (run from repo root)
if [ -f package.json ]; then
  npm install --omit=dev
  if ! npm ls netease-cloud-music-api-alger >/dev/null 2>&1; then
    npm install netease-cloud-music-api-alger
  fi
  echo "Done. You can start the API with: npm run dev:api"
else
  echo "package.json not found. Please run this script from the repo root."
fi
