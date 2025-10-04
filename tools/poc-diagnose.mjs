#!/usr/bin/env node
// tools/poc-diagnose.mjs
// Diagnose PoC UI service - find where Vite is actually listening

import http from 'http';
import fs from 'fs';

const CANDIDATE_URLS = [
  'http://localhost:5174/',
  'http://127.0.0.1:5174/',
  'http://localhost:5180/',
  'http://127.0.0.1:5180/',
  'http://localhost:5181/',
  'http://127.0.0.1:5181/'
];

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

async function probeUrl(url) {
  try {
    const response = await httpGet(url);
    if (response.statusCode === 200) {
      console.log(`UI_PROBE: url=${url} status=200`);
      return url;
    } else {
      console.log(`UI_PROBE: url=${url} status=${response.statusCode}`);
    }
  } catch (error) {
    console.log(`UI_PROBE: url=${url} status=FAIL (${error.message})`);
  }
  return null;
}

async function checkResolvedUrl() {
  // First check if .poc/ui.url exists and is valid
  try {
    if (fs.existsSync('.poc/ui.url')) {
      const resolvedUrl = fs.readFileSync('.poc/ui.url', 'utf8').trim();
      const baseUrl = resolvedUrl.replace('/#/sandbox', '');

      console.log(`Checking resolved URL: ${baseUrl}`);
      const workingUrl = await probeUrl(baseUrl);

      if (workingUrl) {
        console.log(`✅ Found working UI at: ${resolvedUrl}`);
        return resolvedUrl;
      }
    }
  } catch (error) {
    console.log(`❌ Error reading resolved URL: ${error.message}`);
  }

  return null;
}

async function probeCandidates() {
  console.log('Probing candidate URLs...');

  // Try resolved URL first
  const resolvedWorking = await checkResolvedUrl();
  if (resolvedWorking) {
    return resolvedWorking;
  }

  // Then probe all candidates
  for (const url of CANDIDATE_URLS) {
    const workingUrl = await probeUrl(url);
    if (workingUrl) {
      const fullUrl = `${workingUrl}#/sandbox`;
      console.log(`✅ Found working UI at: ${fullUrl}`);
      return fullUrl;
    }
  }

  return null;
}

async function showErrorLogs() {
  console.log('');
  console.log('=== TROUBLESHOOTING ===');

  // Show UI log if available
  try {
    if (fs.existsSync('.poc/ui.log')) {
      console.log('UI_LOG_TAIL: |');
      const lines = fs.readFileSync('.poc/ui.log', 'utf8').split('\n');
      const lastLines = lines.slice(-80).join('\n');
      console.log(lastLines);
    } else {
      console.log('No .poc/ui.log found');
    }
  } catch (error) {
    console.log(`Error reading UI log: ${error.message}`);
  }

  // Show Engine log if available
  try {
    if (fs.existsSync('.poc/engine.log')) {
      console.log('');
      console.log('ENGINE_LOG_TAIL: |');
      const lines = fs.readFileSync('.poc/engine.log', 'utf8').split('\n');
      const lastLines = lines.slice(-20).join('\n');
      console.log(lastLines);
    }
  } catch (error) {
    console.log(`Error reading Engine log: ${error.message}`);
  }
}

async function main() {
  console.log('=== PoC UI Diagnosis ===');

  const workingUrl = await probeCandidates();

  if (workingUrl) {
    console.log('');
    console.log(`🎯 UI_FOUND: url=${workingUrl}`);
    console.log('');
    console.log('✅ UI is ready and accessible!');
  } else {
    console.log('');
    console.log('❌ No working UI found');
    await showErrorLogs();
    process.exit(1);
  }

  console.log('');
  console.log('=== DIAGNOSIS COMPLETE ===');
}

// Run the diagnosis
main().catch((error) => {
  console.error('Diagnosis failed:', error.message);
  process.exit(1);
});
