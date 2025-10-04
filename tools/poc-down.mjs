#!/usr/bin/env node
// tools/poc-down.mjs
// Cross-platform process killer for PoC services with PID file support

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';

const ports = [4311, 5174, 5180, 5181];

// Function to read PID from file if it exists
function readPidFile(pidFile) {
  try {
    if (fs.existsSync(pidFile)) {
      const pid = fs.readFileSync(pidFile, 'utf8').trim();
      if (pid && !isNaN(parseInt(pid))) {
        return parseInt(pid);
      }
    }
  } catch (error) {
    // Ignore errors reading PID files
  }
  return null;
}

function killProcess(pid, name) {
  if (!pid) return;

  try {
    if (os.platform() === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
    }
    console.log(`✅ Killed ${name} (PID: ${pid})`);
  } catch (error) {
    // Process might already be dead
  }
}

function killProcessesOnPorts() {
  const platform = os.platform();

  for (const port of ports) {
    try {
      let pids = [];

      if (platform === 'darwin' || platform === 'linux') {
        // Use lsof on macOS/Linux
        try {
          const output = execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
          pids = output.trim().split('\n').filter(Boolean).map(Number);
        } catch (error) {
          // No processes found
        }
      } else if (platform === 'win32') {
        // Use netstat + taskkill on Windows
        try {
          const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
          const lines = output.split('\n').filter(line => line.includes(`:${port}`));

          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5) {
              pids.push(parseInt(parts[parts.length - 1]));
            }
          }
        } catch (error) {
          // No processes found
        }
      }

      // Kill found processes
      for (const pid of pids) {
        killProcess(pid, `process on port ${port}`);
      }
    } catch (error) {
      // Ignore errors for missing processes or unavailable commands
    }
  }
}

console.log('=== PoC Down (Enhanced) ===');

// Kill processes by PID files first
const uiDir = process.cwd();
const enginePid = readPidFile(`${uiDir}/.poc/engine.pid`);
const uiPid = readPidFile(`${uiDir}/.poc/ui.pid`);

if (enginePid) {
  killProcess(enginePid, 'Engine');
}
if (uiPid) {
  killProcess(uiPid, 'UI');
}

// Then kill any remaining processes on our ports
killProcessesOnPorts();

console.log('✅ Cleanup complete');
