// src/boot/reactApp.tsx
// The ONLY file that imports React, Zustand, ReactFlow, etc.
// This file is lazy-loaded ONLY when NOT in forceSafe mode.

/**
 * Boot the React application by delegating to main.tsx.
 * Called only when forceSafe !== 1.
 */
export async function bootReactApp(): Promise<void> {
  // Import main.tsx which handles all React/routing logic
  await import('../main.tsx')
  
  // main.tsx will call window.__APP_MOUNTED__() when ready
  // No need to duplicate that logic here
}
