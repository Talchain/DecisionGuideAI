#!/usr/bin/env node
/**
 * THE UI'S `prior_is_unquantified` SPELLING MUST MATCH CEE'S, AT THE BOUNDARY.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * The UI declares the field name itself (`canvas/domain/nodes.ts`
 * `PRIOR_IS_UNQUANTIFIED_FIELD`) because it is NOT in the UI's pinned
 * `@talchain/schemas@0.48.0` and the pin must not move (CEE is on 0.50.0; a
 * skew is a hard 422 on the whole turn).
 *
 * ⚠⚠ THE UNIT TEST THAT ASSERTS THAT CONSTANT IS A GUARD AGREEING WITH ITSELF.
 * It compares a UI constant against a UI-side literal, so **a CEE rename leaves
 * it GREEN** while every surface that depends on the flag silently reverts:
 * the amber affordance goes dark again, the inspector prints `0 to 1 on 0–1
 * scale` again, and the node prints `Range: 0 to 1` beside "No estimate yet".
 * Nothing in the UI repo can observe that. **This script is the only thing in
 * the estate that looks at BOTH sides.**
 *
 * ── WHAT IT ASSERTS, AND THE THREE STATES IT DISTINGUISHES ──────────────────
 *
 *   1. CEE declares the constant → its literal MUST equal the UI's.  HARD FAIL
 *      on mismatch. This is the rename case, and the whole point.
 *   2. CEE uses the field name somewhere but no longer declares the constant
 *      → HARD FAIL. The declaration moved; a human must re-point this guard
 *      rather than let it quietly stop discriminating.
 *   3. CEE has neither → WARN. CEE #1223 has not merged yet. This is a real,
 *      expected, DATED state, not a pass to be inherited: it is loud, it names
 *      the PR, and it flips to case 1 the moment #1223 lands.
 *
 * ⚠ Case 3 is the one hole and it is stated rather than hidden: while it holds,
 * this guard cannot detect a rename because there is nothing to compare. It is
 * bounded — #1223 merges in the same window as the UI half — and case 2 is what
 * stops it degrading into a permanent fail-open afterwards.
 *
 * ── POSITIVE CONTROL — because an absence probe with no control proves nothing
 *
 * A sparse checkout that silently fetched nothing would make every "not found"
 * branch fire, and case 3 would report a clean, plausible, entirely wrong
 * "CEE hasn't shipped it yet" forever. So the CEE source directory must exist
 * AND contain a known-present sibling file. If it does not, that is a HARD FAIL
 * about the INSTRUMENT, reported as such — never as a fact about CEE.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const CEE_ROOT = process.env.CEE_REPO_PATH ?? './cee-repo'
const CEE_PROVENANCE = join(CEE_ROOT, 'src/cee/provenance')
/** A file that has been on CEE `staging` independently of #1223. */
const CEE_CONTROL_FILE = 'factor-value-provenance.ts'
const UI_OWNER = 'src/canvas/domain/nodes.ts'

const fail = (msg) => { console.error(`[31m✗ ${msg}[0m`); process.exit(1) }
const warn = (msg) => console.log(`::warning title=unquantified-prior field parity::${msg}`)
const ok = (msg) => console.log(`[32m✓ ${msg}[0m`)

// ── UI side ────────────────────────────────────────────────────────────────
if (!existsSync(UI_OWNER)) fail(`UI owner ${UI_OWNER} not found — run from the repo root.`)
const uiSrc = readFileSync(UI_OWNER, 'utf8')
const uiMatch = uiSrc.match(/PRIOR_IS_UNQUANTIFIED_FIELD\s*=\s*['"]([^'"]+)['"]/)
if (!uiMatch) {
  fail(`${UI_OWNER} no longer declares PRIOR_IS_UNQUANTIFIED_FIELD. If the field moved, re-point this guard.`)
}
const uiLiteral = uiMatch[1]
ok(`UI declares PRIOR_IS_UNQUANTIFIED_FIELD = "${uiLiteral}" (${UI_OWNER})`)

// ── INSTRUMENT CONTROL — prove the CEE checkout is real before reading it ──
if (!existsSync(CEE_PROVENANCE)) {
  fail(
    `INSTRUMENT FAILURE, not a finding about CEE: ${CEE_PROVENANCE} does not exist. ` +
    `The sparse-checkout must include 'src/cee/provenance/'. Refusing to report on CEE from an empty tree.`
  )
}
const ceeFiles = readdirSync(CEE_PROVENANCE)
if (!ceeFiles.includes(CEE_CONTROL_FILE)) {
  fail(
    `INSTRUMENT FAILURE: positive control '${CEE_CONTROL_FILE}' absent from ${CEE_PROVENANCE} ` +
    `(saw: ${ceeFiles.join(', ') || '<empty>'}). The checkout is not what this guard assumes.`
  )
}
ok(`CEE checkout control fired: ${CEE_CONTROL_FILE} present in ${CEE_PROVENANCE}`)

// ── CEE side ───────────────────────────────────────────────────────────────
let declared = null
let usedSomewhere = false
for (const name of ceeFiles) {
  if (!name.endsWith('.ts')) continue
  const body = readFileSync(join(CEE_PROVENANCE, name), 'utf8')
  const m = body.match(/PRIOR_IS_UNQUANTIFIED_FIELD\s*=\s*['"]([^'"]+)['"]/)
  if (m) declared = { literal: m[1], file: name }
  if (body.includes('prior_is_unquantified')) usedSomewhere = true
}

if (declared) {
  if (declared.literal !== uiLiteral) {
    fail(
      `FIELD SPELLING DRIFT — the UI and CEE disagree.\n` +
      `    UI  ${UI_OWNER}: "${uiLiteral}"\n` +
      `    CEE src/cee/provenance/${declared.file}: "${declared.literal}"\n` +
      `  Every surface keyed on this flag silently reverts when these differ: the amber\n` +
      `  "needs your judgement" affordance, the inspector's prior rows, and the node's\n` +
      `  range line. Update ${UI_OWNER} to match CEE.`
    )
  }
  ok(`CEE agrees: src/cee/provenance/${declared.file} declares "${declared.literal}"`)
  process.exit(0)
}

if (usedSomewhere) {
  fail(
    `CEE uses 'prior_is_unquantified' but no longer DECLARES PRIOR_IS_UNQUANTIFIED_FIELD in\n` +
    `  src/cee/provenance/. The declaration has moved, so this guard can no longer compare the\n` +
    `  two sides. Re-point it rather than letting it stop discriminating silently.`
  )
}

warn(
  `CEE staging does not yet carry the unquantified-prior field (PR #1223 unmerged). ` +
  `Spelling parity is UNVERIFIED until it lands — this guard binds hard the moment it does.`
)
ok('UI side well-formed; CEE side not shipped yet (expected pre-#1223).')
