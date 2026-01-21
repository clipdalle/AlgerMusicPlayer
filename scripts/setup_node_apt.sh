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
