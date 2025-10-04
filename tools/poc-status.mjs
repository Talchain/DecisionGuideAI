#!/usr/bin/env node
// tools/poc-status.mjs
// Check status of PoC services

import http from 'http';
import fs from 'fs';

const ENGINE_URL = 'http://127.0.0.1:4311/health';
const UI_PORTS = [5174, 5180, 5181];

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function checkEngine() {
  try {
    const response = await httpGet(ENGINE_URL);
    if (response.statusCode === 200) {
      try {
        const health = JSON.parse(response.data);
        const testRoutes = health.test_routes_enabled ? 'ON' : 'OFF';
        return `RUNNING test_routes=${testRoutes}`;
      } catch (e) {
        return 'RUNNING (health parse error)';
      }
    } else {
      return `DOWN (HTTP ${response.statusCode})`;
    }
  } catch (error) {
    return `DOWN (${error.message})`;
  }
}

async function checkUI() {
  // First try to read the resolved URL from .poc/ui.url
  try {
    if (fs.existsSync('.poc/ui.url')) {
      const resolvedUrl = fs.readFileSync('.poc/ui.url', 'utf8').trim();
      try {
        const response = await httpGet(resolvedUrl.replace('/#/sandbox', ''));
        if (response.statusCode === 200) {
          return `RUNNING url=${resolvedUrl}`;
        }
      } catch (error) {
        // Fall through to port scanning
      }
    }
  } catch (error) {
    // Fall through to port scanning
  }

  // Fallback: check common ports
  for (const port of UI_PORTS) {
    try {
      const response = await httpGet(`http://localhost:${port}`);
      if (response.statusCode === 200) {
        return `RUNNING url=http://localhost:${port}/#/sandbox`;
      }
    } catch (error) {
      // Try next port
    }
  }

  return 'DOWN';
}

async function main() {
  console.log('=== PoC Status ===');

  const [engineStatus, uiStatus] = await Promise.all([
    checkEngine(),
    checkUI()
  ]);

  console.log(`UI: ${uiStatus}`);
  console.log(`ENGINE: ${engineStatus}`);

  // Exit with error if either service is down
  const uiRunning = uiStatus.startsWith('RUNNING');
  const engineRunning = engineStatus.startsWith('RUNNING');

  if (!uiRunning || !engineRunning) {
    console.log('');
    console.log('❌ Some services are down');
    process.exit(1);
  }

  console.log('');
  console.log('✅ All services running');
}

main().catch((error) => {
  console.error('Error checking status:', error.message);
  process.exit(1);
});
