const fs = require('fs');
const path = require('path');

function loadConfig() {
  const envPath = path.resolve(__dirname, '../.env.development');
  try {
    if (!fs.existsSync(envPath)) return {};

    const content = fs.readFileSync(envPath, 'utf-8');
    const config = {};
    content.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const [key, ...rest] = line.split('=');
      if (key) {
        config[key.trim()] = rest.join('=').trim();
      }
    });
    return config;
  } catch (e) {
    console.warn('Failed to load .env.development', e);
    return {};
  }
}

const config = loadConfig();
const API_BASE = config.VITE_API || 'http://127.0.0.1:30488';

module.exports = {
  API_BASE
};
