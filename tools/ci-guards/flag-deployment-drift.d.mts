// tools/ci-guards/flag-deployment-drift.d.mts
// Types for the flag-deployment-drift guard, so TypeScript consumers (its spec,
// and any future caller) are checked rather than silently `any`.
//
// The implementation is plain .mjs deliberately: the guard must be runnable with
// a bare `node tools/ci-guards/flag-deployment-drift.mjs` during an incident,
// with no build step and no loader. This file gives it types without that cost.

export declare const DEFAULT_DEPLOY_URL: string

/** Thrown when the deployed bundle could not be reached or read. */
export declare class DeployUnreachableError extends Error {
  constructor(message: string, options?: { url?: string; cause?: unknown })
  name: 'DeployUnreachableError'
  url?: string
  cause?: unknown
}

export interface DeclaredFlag {
  /** Property name in `FLAGS_CONFIG`, e.g. `v5CanonicalAnalysis`. */
  name: string
  /** Environment variable, e.g. `VITE_V5_CANONICAL_ANALYSIS`. */
  envKey: string
  /** localStorage override key, e.g. `feature.v5CanonicalAnalysis`. */
  storageKey: string | null
  /** Compiled default when neither localStorage nor env decides. */
  defaultValue: boolean
}

/** A declaration the AST walker could not read. Never silently dropped. */
export interface UnparseableFlag {
  name: string
  reason: string
}

export interface NetlifyEnv {
  build: Record<string, string>
  staging: Record<string, string>
}

export declare const VERDICT: {
  readonly OK: 'OK'
  readonly DRIFT: 'DRIFT'
  readonly DASHBOARD: 'DRIFT (dashboard-set)'
  readonly NONBOOL: 'NON-BOOLEAN'
}

export type Verdict = (typeof VERDICT)[keyof typeof VERDICT]

export interface DivergenceRow {
  name: string
  envKey: string
  declaredDefault: boolean
  /** Raw netlify.toml value, or null when the file does not mention the key. */
  netlifyValue: string | null
  repoSource: 'netlify.toml[staging]' | 'netlify.toml[build]' | 'flags.ts default'
  /** What repo config predicts the flag resolves to. */
  repoExpected: boolean
  /** Deployed value, or `<non-boolean:redacted>`; null when absent from the bundle. */
  deployedRaw: string | null
  deployedPresent: boolean
  /** What the flag ACTUALLY resolves to in the deploy. This is the truth. */
  deployEffective: boolean
  /** Present in the deploy but absent from netlify.toml => set in the dashboard. */
  dashboardOnly: boolean
  verdict: Verdict
}

export interface DivergenceReport {
  rows: DivergenceRow[]
  divergences: DivergenceRow[]
  /** Deployed VITE_* keys with no flags.ts declaration. NAMES ONLY — may be credentials. */
  undeclaredInDeploy: string[]
}

/**
 * Derive every flag declared in `FLAGS_CONFIG` by walking the TypeScript AST.
 * @throws if `FLAGS_CONFIG` is missing or is not an object literal.
 */
export declare function deriveDeclaredFlags(
  sourceText: string,
  fileName?: string,
): { flags: DeclaredFlag[]; unparseable: UnparseableFlag[] }

/** Read `[build.environment]` and `[context.staging.environment]` from netlify.toml. */
export declare function parseNetlifyEnv(tomlText: string): NetlifyEnv

/**
 * Pull Vite's baked `import.meta.env` object out of served bundle text.
 * @throws DeployUnreachableError rather than ever returning an empty map.
 */
export declare function extractDeployedEnv(
  chunkText: string,
  options?: { sourceLabel?: string },
): Record<string, string>

/** Mirrors `flagFactory.makeFlag`'s coercion. `null` = not boolean-ish. */
export declare function coerceFlagValue(raw: unknown): boolean | null

/**
 * Derive the content-hashed asset chain from the served index.html and read the
 * deployed env out of it.
 * @throws DeployUnreachableError on any fetch or extraction failure.
 */
export declare function fetchDeployedEnv(
  baseUrl?: string,
  options?: { timeoutMs?: number; log?: (message: string) => void },
): Promise<{ env: Record<string, string>; chain: string[] }>

export declare function computeDivergences(input: {
  declared: DeclaredFlag[]
  netlify: NetlifyEnv
  deployed: Record<string, string>
}): DivergenceReport

export declare function renderTable(rows: DivergenceRow[]): string

/**
 * CLI entry. Resolves to the process exit code.
 * 0 = reported (even with divergences — reporting posture, and UNVERIFIED),
 * 1 = divergences found AND `--fail-on-divergence` was passed,
 * 2 = the derivation itself failed (empty or unparseable declared set).
 */
export declare function run(
  argv?: string[],
  options?: {
    cwd?: string
    log?: (message: string) => void
    err?: (message: string) => void
  },
): Promise<number>
