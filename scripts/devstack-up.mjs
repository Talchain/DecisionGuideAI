#!/usr/bin/env node

/**
 * devstack-up.mjs
 * Builds and starts the local development stack
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const USE_LOCAL_IMAGES = process.env.USE_LOCAL_IMAGES === '1';
const COMPOSE_FILE = path.join(projectRoot, 'pilot-deploy', 'docker-compose.poc.yml');

console.log('🚀 Starting Development Stack');
console.log(`📁 Project root: ${projectRoot}`);
console.log(`🐳 Docker Compose file: ${COMPOSE_FILE}`);
console.log(`🏗️  Local images: ${USE_LOCAL_IMAGES ? 'ENABLED' : 'DISABLED'}`);

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
    // Stop any existing containers
    console.log('\n🛑 Stopping existing containers...');
    try {
      await runCommand('docker', ['compose', '-f', COMPOSE_FILE, 'down'], { env });
    } catch (error) {
      console.log('ℹ️  No existing containers to stop');
    }

    if (USE_LOCAL_IMAGES) {
      console.log('\n🏗️  Building local images...');
      await runCommand('docker', ['compose', '-f', COMPOSE_FILE, 'build'], { env });
    }

    console.log('\n🚀 Starting services...');
    await runCommand('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d'], { env });

    console.log('\n✅ Development stack started successfully!');
    console.log('\n📊 Service URLs:');
    console.log('   Gateway:    http://localhost:3001');
    console.log('   Engine:     http://localhost:3002');
    console.log('   Jobs:       http://localhost:3003');
    console.log('   Prometheus: http://localhost:9090 (if observability profile enabled)');
    console.log('   Grafana:    http://localhost:3000 (if observability profile enabled)');

    console.log('\n📋 Useful commands:');
    console.log('   View logs:   docker compose -f pilot-deploy/docker-compose.poc.yml logs -f');
    console.log('   Stop stack:  npm run devstack:down');
    console.log('   Check status: docker compose -f pilot-deploy/docker-compose.poc.yml ps');

  } catch (error) {
    console.error('\n❌ Failed to start development stack:', error.message);
    process.exit(1);
  }
}

main();