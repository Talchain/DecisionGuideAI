#!/usr/bin/env node

/**
 * devstack-down.mjs
 * Stops the local development stack
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const COMPOSE_FILE = path.join(projectRoot, 'pilot-deploy', 'docker-compose.poc.yml');

console.log('🛑 Stopping Development Stack');
console.log(`📁 Project root: ${projectRoot}`);
console.log(`🐳 Docker Compose file: ${COMPOSE_FILE}`);

// Check if docker-compose file exists
if (!fs.existsSync(COMPOSE_FILE)) {
  console.error(`❌ Docker Compose file not found: ${COMPOSE_FILE}`);
  process.exit(1);
}

// Environment for docker-compose
const env = {
  ...process.env,
  COMPOSE_PROJECT_NAME: 'pilot'
};

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n📋 Running: ${command} ${args.join(' ')}`);

    const proc = spawn(command, args, {
      stdio: 'inherit',
      cwd: options.cwd || projectRoot,
      env: options.env || env
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  try {
    console.log('\n🛑 Stopping and removing containers...');
    await runCommand('docker', ['compose', '-f', COMPOSE_FILE, 'down', '-v'], { env });

    console.log('\n✅ Development stack stopped successfully!');
    console.log('\nℹ️  Volumes have been removed to ensure clean state.');
    console.log('💡 To start again: npm run devstack:up');

  } catch (error) {
    console.error('\n❌ Failed to stop development stack:', error.message);
    process.exit(1);
  }
}

main();