// Export components
export * from './components';
export * from './Sandbox';

// Export routes
export * from './routes';

// Export state management
export * from './state/boardState';

// Export hooks
export * from './hooks';

// Export types
export * from './types';

// Import config helpers
import { isSandboxEnabled, isVotingEnabled } from '../lib/config';
import { Sandbox } from './Sandbox';

export { isSandboxEnabled, isVotingEnabled, Sandbox };

/**
 * Initialize the sandbox feature
 * This should be called when the app starts
 */
export function initializeSandbox() {
  if (!isSandboxEnabled) {
    console.log('Sandbox feature is disabled');
    return;
  }
  
  console.log('Initializing Sandbox feature...');
  // Any initialization code can go here
}

/**
 * Cleanup function to be called when the app unmounts
 */
export function cleanupSandbox() {
  if (!isSandboxEnabled) return;
  // Any cleanup code can go here
}

// Export types
export * from './state/boardState';
export * from './types/sandbox';
