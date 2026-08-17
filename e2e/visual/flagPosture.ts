/**
 * Derive the flag posture the visual references are captured under.
 *
 * WHY THIS IS DERIVED AND NOT A LIST (CLAUDE.md trap 12, "the dominant defect
 * is the hand-maintained mirror"; trap 3b, "a UI test can be bound to a
 * component the deployed flags switch off").
 *
 * The dev server the harness boots inherits only `playwright.visual.config.ts`
 * + `.env.development`, which is a DIFFERENT flag posture from the deployed
 * build. Row 2.466/2.491 shipped the same defect twice: a spec bound to a
 * component that the deployed flags never mount, green forever, blind by
 * construction. Concretely at this tip: `preAnalysisV3` defaults to FALSE
 * locally (no `defaultValue` in `src/flags.ts`, `makeFlag` defaults false) but
 * `netlify.toml` sets `VITE_FEATURE_PRE_ANALYSIS_V3 = "1"`. Screenshotting the
 * local default would bless a readiness surface no staging user sees.
 *
 * So the posture is JOINED at run time from the two sources of truth:
 *   - `netlify.toml`      — which `VITE_FEATURE_` / `VITE_ENABLE_` vars are set, and to what
 *   - `src/flags.ts`      — the envKey -> storageKey mapping (`feature.<name>`)
 * and applied as `localStorage` overrides before first paint.
 *
 * ⚠ SCOPE, stated precisely (trap 18 / trap 20): `netlify.toml` is NOT the
 * deployed environment. Render/Netlify DASHBOARD variables override it and this
 * repo cannot see them. This module's claim is narrow and honest: "the
 * references were captured under the posture `netlify.toml` declares", which is
 * strictly closer to a staging user than the dev-server default and, unlike the
 * dev default, is written down. It is NOT a claim about what staging serves.
 * `posturePins()` returns the pins so a spec can record them in the artefact.
 *
 * Positive controls (trap 13 / 13e): both parsers assert a plausible non-zero
 * yield. A regex that silently stops matching returns an empty posture, and an
 * empty posture is indistinguishable from "no flags to pin" — which is exactly
 * how a harness quietly starts measuring the wrong surface.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './repoRoot'

/** Minimum flag entries we expect to parse out of `src/flags.ts`. */
const MIN_FLAG_ENTRIES = 30
/** Minimum joined pins we expect. */
const MIN_PINS = 5

export interface FlagPin {
  envKey: string
  storageKey: string
  value: string
}

/**
 * envKey -> storageKey, parsed from FLAGS_CONFIG in `src/flags.ts`.
 * The two keys are adjacent lines inside each config object literal.
 */
function readEnvKeyToStorageKey(): Map<string, string> {
  const src = readFileSync(join(repoRoot(), 'src', 'flags.ts'), 'utf8')
  const map = new Map<string, string>()
  const re = /envKey:\s*'([A-Z0-9_]+)'\s*,\s*\n\s*storageKey:\s*'([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) map.set(m[1], m[2])

  if (map.size < MIN_FLAG_ENTRIES) {
    throw new Error(
      `[visreg/flagPosture] Parsed only ${map.size} envKey->storageKey pairs from src/flags.ts ` +
        `(expected >= ${MIN_FLAG_ENTRIES}). The FLAGS_CONFIG shape has changed and this parser is ` +
        `silently under-reporting. An under-reporting parser yields an EMPTY posture, which looks ` +
        `identical to "nothing to pin" — fix the parser, do not lower the floor.`,
    )
  }
  return map
}

/** VITE_FEATURE_* / VITE_ENABLE_* assignments declared in `netlify.toml`. */
function readNetlifyFlagEnv(): Map<string, string> {
  const toml = readFileSync(join(repoRoot(), 'netlify.toml'), 'utf8')
  const env = new Map<string, string>()
  const re = /^\s*(VITE_(?:FEATURE|ENABLE)_[A-Z0-9_]+)\s*=\s*"([^"]*)"/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(toml)) !== null) env.set(m[1], m[2])

  if (env.size < MIN_PINS) {
    throw new Error(
      `[visreg/flagPosture] Parsed only ${env.size} VITE_FEATURE_ / VITE_ENABLE_ assignments from ` +
        `netlify.toml (expected >= ${MIN_PINS}). Parser is blind — fix it, do not lower the floor.`,
    )
  }
  return env
}

/**
 * The pins to write into `localStorage` before first paint, sorted by
 * storageKey so the recorded posture is stable across runs.
 */
export function posturePins(): FlagPin[] {
  const envToStorage = readEnvKeyToStorageKey()
  const netlifyEnv = readNetlifyFlagEnv()

  const pins: FlagPin[] = []
  for (const [envKey, value] of netlifyEnv) {
    const storageKey = envToStorage.get(envKey)
    // A netlify flag with no counterpart in flags.ts is either a non-flag build
    // var (several are) or a retired flag. Not an error — but it IS silently
    // unpinned, so it is reported by `unmappedNetlifyFlags()` for the artefact.
    if (!storageKey) continue
    pins.push({ envKey, storageKey, value })
  }
  pins.sort((a, b) => a.storageKey.localeCompare(b.storageKey))

  if (pins.length < MIN_PINS) {
    throw new Error(
      `[visreg/flagPosture] Joined only ${pins.length} pins (expected >= ${MIN_PINS}). ` +
        `netlify.toml and src/flags.ts no longer share envKeys — the posture would be captured ` +
        `under the DEV default, which is the trap-3b defect this module exists to prevent.`,
    )
  }
  return pins
}

/** netlify.toml flag-shaped vars with no flags.ts storageKey (reported, not pinned). */
export function unmappedNetlifyFlags(): string[] {
  const envToStorage = readEnvKeyToStorageKey()
  return [...readNetlifyFlagEnv().keys()].filter((k) => !envToStorage.has(k)).sort()
}

/** A stable one-line fingerprint of the posture, embedded in the run artefact. */
export function postureFingerprint(): string {
  return posturePins()
    .map((p) => `${p.storageKey}=${p.value}`)
    .join(';')
}
