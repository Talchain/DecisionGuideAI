// scripts/generate-flag-env.d.mts
// Types for the flagEnv generator, so its spec is checked rather than `any`.
//
// The implementation is plain .mjs deliberately: it must run with a bare
// `node scripts/generate-flag-env.mjs`, with no build step and no loader.

export interface DerivedFlagEnvKeys {
  /** Vite build metadata. `BASE_URL` MUST stay first — flags:check anchors on it. */
  builtins: string[]
  /** Declared flag envKeys plus netlify.toml VITE_FEATURE_ / VITE_ENABLE_ keys, sorted. */
  vite: string[]
  /** How many came from `src/flags.ts` FLAGS_CONFIG. */
  declaredCount: number
  /** How many came from `netlify.toml`. */
  netlifyCount: number
}

/** Every `VITE_FEATURE_*` / `VITE_ENABLE_*` declared anywhere in netlify.toml. */
export declare function deriveNetlifyFeatureKeys(tomlText: string): string[]

/**
 * Derive the full key set for `src/lib/flagEnv.ts`.
 * @throws if `src/flags.ts` has unparseable declarations, or derives zero flags —
 *         rather than emitting a snapshot that would silently omit a flag and make
 *         it resolve to its defaultValue.
 */
export declare function deriveKeys(input: {
  flagsSource: string
  netlifySource: string
}): DerivedFlagEnvKeys

/** Render the generated module text. Compared byte-for-byte by `--check`. */
export declare function renderModule(keys: DerivedFlagEnvKeys): string
