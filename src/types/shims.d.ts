// Ambient shims to quiet IDE unresolved-module noise for alias imports on main.
// Config-only: does not change runtime; used purely for typing.

// Explicit ambient shims for alias imports that may not exist on this branch
declare module '@/whiteboard/tldraw' { const mod: any; export = mod; export default mod }
declare module '@/whiteboard/persistence' { const mod: any; export = mod; export default mod }
declare module '@/whiteboard/seed' { const mod: any; export = mod; export default mod }
declare module '@/whiteboard/projection' { const mod: any; export = mod; export default mod }
declare module '@/lib/useTelemetry' { const mod: any; export = mod; export default mod }
declare module '@/lib/flags' { const mod: any; export = mod; export default mod }
declare module '@/sandbox/state/graphStore' { const mod: any; export = mod; export default mod }
declare module '@/whiteboard/domainMapping' { const mod: any; export = mod; export default mod }
declare module '@/domain/kr' { const mod: any; export = mod; export default mod }
declare module '@/contexts/AuthContext' { const mod: any; export = mod; export default mod }
declare module '@/sandbox/state/overridesStore' { const mod: any; export = mod; export default mod }
declare module '@/whiteboard/FocusOverlay' { const mod: any; export = mod; export default mod }
declare module '@/whiteboard/WhatIfOverlay' { const mod: any; export = mod; export default mod }
declare module '@/whiteboard/Canvas' { const mod: any; export = mod; export default mod }
declare module '@/whiteboard/CombinedSandboxRoute' { const mod: any; export = mod; export default mod }
declare module '@/test/rtlHelpers' { const mod: any; export = mod; export default mod }
declare module '@/test/renderSandbox' { const mod: any; export = mod; export default mod }

// Augment ImportMeta to ensure import.meta.env is always typed in editors.
interface ImportMetaEnv {
  readonly MODE?: string
  readonly VITEST?: string | boolean
  // Allow arbitrary env keys (e.g., VITE_*), without narrowing runtime behaviour
  readonly [key: string]: any
}

interface ImportMeta {
  readonly env: ImportMetaEnv
  // Some setups expose vitest on import.meta; keep it permissive
  readonly vitest?: any
}
