/**
 * Driver-display policy tripwire — no raw influence reads outside the policy.
 *
 * The July-13 Codex final audit found the tornado ordering by
 * `influenceScore ?? normalisedInfluence`, bypassing the shared
 * `driverDisplayModel` policy (R3-B1) — the FOURTH surface to do so — and the
 * same evening's adversarial verification found three MORE live bypasses
 * (TriageActionCards nudge, strengthen LEHI ranking, model-tab factor map).
 * "Shared policy" means nothing without a net: this spec scans the results +
 * canvas source trees and fails on any line that reads the RAW metrics
 * (`influenceScore` / `normalisedInfluence`) without going through the policy.
 *
 * SAFE line: `displayInfluence` appears EARLIER on the same (or previous)
 * line — this sanctions exactly the canonical consumer chain
 * `displayInfluence ?? influenceScore ?? normalisedInfluence` (raw only as
 * legacy fallback; runtime-dead, fixture-only — see Lane 2 PR) while a
 * WRONG-ORDERED chain (`influenceScore ?? displayInfluence`) still fails.
 *
 * ALLOWLIST (attestation-guarded, DEFENCE_IN_DEPTH style): the policy module
 * itself, the two adapters that FEED the policy, and the V17 dominance GATE
 * (UI-SEM-040 — deliberately absolute-threshold semantics, not display
 * ranking). Each entry names a regex that must still be present in the file;
 * if the attestation disappears the exemption dies with it.
 *
 * Out of scope (documented, not silent): the elasticity/sensitivity_score
 * field family (a 6th bypass of that family — OptionNode winsVia — is fixed
 * and spec-pinned in this same lane); fixtures/specs/stories; the debug
 * bundle (outside both scan roots).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const REPO_SRC = join(__dirname, '..', '..', '..')
const SCAN_ROOTS = [
  join(REPO_SRC, 'components', 'results'),
  join(REPO_SRC, 'canvas'),
]

/** Skip dirs/files with no production render path. */
const SKIP_DIR = /^(__tests__|__fixtures__|__mocks__|Debug|Advanced)$/
const SKIP_FILE = /(\.spec\.|\.test\.|\.stories\.)/

function getSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || SKIP_DIR.test(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...getSourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry) && !SKIP_FILE.test(entry)) {
      files.push(full)
    }
  }
  return files
}

/** A raw-metric member read: `x.influenceScore`, `d?.normalisedInfluence`. */
const RAW_MEMBER_READ = /\b[\w$)\]]+\??\.(influenceScore|normalisedInfluence)\b/
/** Destructuring / shorthand pickup of the raw keys: `{ influenceScore }`. */
const RAW_DESTRUCTURE = /[{,]\s*(influenceScore|normalisedInfluence)\s*[,}]/

/**
 * Allowlisted files (path RELATIVE to src/) → attestation regex that must
 * still hold in the file source for the exemption to stand.
 */
const ALLOWLIST: Record<string, RegExp> = {
  // THE policy — the only module allowed to interpret the raw metrics.
  'components/results/driverDisplayModel.ts': /export function selectDriverDisplayModel/,
  // Producer/adapter: builds DriverItems from the wire and stamps
  // displayInfluence via the policy; also reads normalisedInfluence for the
  // semantic-label thresholds the policy header explicitly sanctions.
  'components/results/useResultsSectionData.ts': /selectDriverDisplayModel/,
  // Graph-badge adapter: feeds raw metrics INTO the policy.
  'canvas/hooks/useNodeDisplayMetadata.ts': /selectDriverDisplayModel/,
  // V17 hero dominance GATE (UI-SEM-040): absolute/ratio thresholds over the
  // raw metrics — deliberately NOT the display-ranking policy. The marker
  // comment is the attestation; if the gate is rewritten, re-decide.
  'components/results/analysisHeroV17/buildAnalysisHeroViewModel.ts': /UI-SEM-040/,
  // Model-tab factor map: post-Lane-2 an adapter that feeds the policy
  // (reads the wire-shape camelCase fallback on its input rows).
  'canvas/components/model-tab/utils.ts': /selectDriverDisplayModel/,
  // OptionNode winsVia: post-Lane-2 an adapter that feeds the policy (reads
  // the wire-shape camelCase fallback on its sensitivity rows) and claims
  // "#1 driver" only when the lever IS the policy's global top.
  'canvas/nodes/OptionNode.tsx': /selectDriverDisplayModel/,
}

/** SAFE when displayInfluence appears EARLIER on the same or previous line. */
function isSanctionedChain(lines: string[], i: number, matchIndex: number): boolean {
  const line = lines[i]
  const before = line.slice(0, matchIndex)
  if (before.includes('displayInfluence')) return true
  // Presence probes are not decisions (same exemption as the ESLint rule):
  // `typeof x.influenceScore` checks existence, never consumes the value.
  if (/typeof\s+$/.test(before)) return true
  // Wrapped chains: `d.displayInfluence ??` on the previous line.
  const prev = i > 0 ? lines[i - 1] : ''
  return /displayInfluence[^]*\?\?\s*$/.test(prev.trimEnd())
}

describe('driver-display policy: no raw influence reads outside the policy', () => {
  const sourceFiles = SCAN_ROOTS.flatMap((root) => getSourceFiles(root))
  expect(sourceFiles.length).toBeGreaterThan(50) // scan actually ran

  for (const filePath of sourceFiles) {
    const rel = relative(REPO_SRC, filePath)

    it(`${rel} reads influence only through the display policy`, () => {
      const content = readFileSync(filePath, 'utf-8')
      // Cheap pre-filter — most files never mention the raw fields.
      if (!/influenceScore|normalisedInfluence/.test(content)) return

      const allow = ALLOWLIST[rel]
      if (allow) {
        if (!allow.test(content)) {
          throw new Error(
            `${rel} is allowlisted for raw influence reads but its attestation ` +
              `(${allow}) is gone. Either restore it or route the file through ` +
              `driverDisplayModel and drop the allowlist entry.`,
          )
        }
        return
      }

      const lines = content.split('\n')
      const violations: string[] = []
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const member = RAW_MEMBER_READ.exec(line)
        if (member && !isSanctionedChain(lines, i, member.index)) {
          violations.push(`  L${i + 1}: ${line.trim()}`)
          continue
        }
        if (RAW_DESTRUCTURE.test(line)) {
          violations.push(`  L${i + 1}: ${line.trim()} (destructured raw key)`)
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `Raw influence read(s) outside driverDisplayModel in ${rel}:\n` +
            violations.join('\n') +
            `\n\nRead displayInfluence (stamped by selectDriverDisplayModel) — or, ` +
            `for a true adapter/gate, add an attestation-guarded allowlist entry ` +
            `in no-raw-influence-read.spec.ts with the rationale.`,
        )
      }
    })
  }
})
