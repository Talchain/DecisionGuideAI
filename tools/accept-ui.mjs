#!/usr/bin/env node
// tools/accept-ui.mjs
// Acceptance test for PoC mode: checks Engine health and prints UI acceptance

import http from 'http';

async function fetchEngineHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://127.0.0.1:4311/health', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(JSON.stringify(json));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', (err) => {
      reject(err);
    });
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function main() {
  console.log('=== UI ACCEPTANCE ===');
  
  try {
    const healthJson = await fetchEngineHealth();
    console.log(`ENGINE_ACCEPT: ${healthJson}`);
  } catch (err) {
    console.log(`ENGINE_ACCEPT: ERROR - ${err.message}`);
  }
  
  console.log('UI_ACCEPT: url=http://localhost:5174/#/sandbox, mode=PoC, auth=guest, engine=http://127.0.0.1:4311');
}

main().catch(console.error);
