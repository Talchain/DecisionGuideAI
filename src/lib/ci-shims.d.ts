// src/lib/ci-shims.d.ts
// CI-only ambient declarations to satisfy TypeScript when running
// `npm run typecheck` without pulling full Node typings into the app
// bundle. These do NOT affect runtime behaviour.

// Minimal Buffer shim used in URL encoding helpers
declare const Buffer: {
  from(
    input: string | Uint8Array | number[],
    encoding?: string
  ): { toString(encoding?: string): string }
}

// Minimal process.env shim for environments where process may exist
declare const process: {
  env?: Record<string, string | undefined>
}

// Minimal pako module typing used by scenarios/snapshot share helpers
declare module 'pako' {
  export function deflateRaw(data: Uint8Array | ArrayLike<number>): Uint8Array
  export function inflateRaw(data: Uint8Array | ArrayLike<number>): Uint8Array
}
