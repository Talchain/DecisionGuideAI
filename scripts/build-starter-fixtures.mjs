#!/usr/bin/env node
/**
 * build-starter-fixtures — DERIVE the starter payloads, never hand-maintain them.
 *
 * WHY THIS SCRIPT EXISTS (CLAUDE.md trap 12: "the dominant defect is the
 * hand-maintained mirror"). A starter scenario is a REAL CEE draft-graph
 * response captured from live staging. Three things could drift out of sync if
 * a human owned them: the shipped fixture vs its source capture, the card copy
 * vs the graph it opens, and the redraft brief vs the brief that actually
 * produced the graph. All three are DERIVED here from one source of truth
 * (`docs/evidence/starters/raw/*.capture.json` + `briefs.json`), and `--check`
 * re-derives and byte-compares so drift FAILS LOUD in CI instead of reading green.
 *
 * The source captures are the verbatim response bodies from
 * `POST https://cee-staging.onrender.com/assist/v1/draft-graph`. They are
 * committed unmodified next to this script's output so anyone can re-derive
 * and diff.
 *
 * ⚠ THE SET SPANS TWO CEE BUILDS — do not restate one build for all five.
 * `build-vs-buy` is the original `1b9d596` capture (2026-07-24, probe lane
 * `parallel-briefs/STARTER-BRIEF-VALIDATION-2026-07-24.md`); the other four
 * were recaptured on `cb54320` (2026-07-28) to clear near-duplicate label
 * collisions — see the STARTERS table for the per-starter reason. The build is
 * therefore recorded PER STARTER in `provenance.ceeBuild`, derived from the
 * table rather than written once as a constant, because a single shared string
 * is exactly the hand-maintained mirror that would go stale on the next
 * recapture (CLAUDE.md trap 12).
 *
 * TWO transformations are applied, both mechanical and both re-derivable:
 *
 *  1. Deletion of two purely diagnostic top-level keys (see STRIPPED_KEYS).
 *  2. Overlay of the RE-DERIVED `analysis_ready` display strings (see
 *     REDERIVED below). Display strings only — every numeric value is asserted
 *     unchanged, and the assertion fails the build if one moves.
 *
 * Nothing else is rewritten, reordered, padded or invented — a hand-written
 * graph would be a fabricated demo.
 *
 * ⚠ WHY TRANSFORMATION 2 EXISTS (2026-08-29). The captures predate CEE #944
 * (2026-08-14, "stop showing every option the status quo"), which added the
 * `sitsAtObservedState` guard to `buildInterventionDetail`. Before that guard,
 * every option that touched a factor BORROWED the factor's own baseline
 * `display_value` — so an option's receipt described the status quo wearing the
 * option's name. Measured across the five captures: **27 of 70 interventions**
 * carried a display string that contradicted their own value, in ALL FIVE
 * starters.
 *
 * On the deployed canvas that renders as a no-op ("Low (0) → Low (0)" for an
 * option that moves the factor 0 → 1) or, worse, as a sign inversion —
 * `fac_adoption_friction` read "Very high (0.8)" on options setting it to 0.1,
 * and `fac_build_indicator` read "No in-house build pursued" on the option that
 * builds in-house. A starter is the first model a colleague ever opens.
 *
 * THE FIX IS NOT A RECAPTURE. The defect is a transform artefact, not model
 * content: all 55 shared intervention values agree exactly between the V3 option
 * nodes and `analysis_ready`, and the factor nodes' own display strings are
 * correct (they genuinely describe the baseline). Only the strings CEE
 * synthesised into `analysis_ready` were wrong. So the display strings were
 * re-derived by running CEE's OWN `buildInterventionDetail` — at a named SHA,
 * offline, no LLM and no credentials — over the committed V3 factor nodes and
 * intervention values. No node, edge, option, count or brief changes, so no
 * starter can come back worse. A fresh recapture would also have carried a ~45%
 * per-draw chance of reintroducing the near-duplicate label collision the
 * 2026-07-28 recapture existed to clear.
 *
 * ⚠ THE SOURCE CAPTURES ARE UNTOUCHED AND STAY UNTOUCHED. They are dated
 * records of what a build actually emitted (CLAUDE.md trap 14b: a capture
 * corpus is evidence, append-only). The re-derivation is committed BESIDE them
 * as a separate artefact, so both the original defect and the correction remain
 * inspectable.
 *
 *   node scripts/build-starter-fixtures.mjs           # write fixtures + manifest
 *   node scripts/build-starter-fixtures.mjs --check   # verify committed output matches
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW_DIR = join(ROOT, 'docs/evidence/starters/raw')
const OUT_DIR = join(ROOT, 'src/canvas/starters/data')
const MANIFEST = join(ROOT, 'src/canvas/starters/starters.manifest.json')
const BRIEFS = join(ROOT, 'docs/evidence/starters/briefs.json')
/**
 * Re-derived `analysis_ready` display strings, produced by CEE's own
 * `buildInterventionDetail` run offline over the committed captures. Generated,
 * never hand-edited — see the header for why it exists and `_provenance` inside
 * the file for the CEE SHA it was produced at.
 */
const REDERIVED = join(ROOT, 'docs/evidence/starters/rederived-analysis-ready.json')

/**
 * Purely diagnostic top-level keys removed from the shipped fixture.
 *
 * `trace` is the CEE pipeline diagnostic bundle (llm_raw prompt/response text,
 * stage snapshots, repair provenance) and `_timings` is per-stage millisecond
 * accounting. Neither is read by any canvas ingestion code — `applyDraftResult`
 * consumes nodes/edges/analysis_ready/goal_constraints/quality/coaching only —
 * and together they are ~47% of the capture bytes.
 *
 * They are stripped for BUNDLE SIZE, not to hide anything: the full capture
 * including both keys is committed verbatim at docs/evidence/starters/raw/.
 * `trace.llm_raw.text` also carries the raw model output, which does not belong
 * in a client bundle.
 */
const STRIPPED_KEYS = ['trace', '_timings']

/**
 * The five starters, each pinned to the ONE capture it is derived from.
 *
 * `capture` names a SUCCESSFUL probe (HTTP 200, structurally valid, complete
 * coaching). Selection rationale per starter is recorded in `note`, and
 * `ceeBuild`/`capturedAt` are per-starter because the set is NOT single-build
 * (see below) — a single hardcoded build string would have mislabelled four of
 * the five the moment they were recaptured.
 *
 * ⚠ FOUR OF FIVE WERE RECAPTURED 2026-07-28, and the reason is the selection
 * criterion — not a content refresh. The original captures (CEE `1b9d596`)
 * shipped four NEAR-DUPLICATE LABEL COLLISIONS across four starters:
 *
 *   vendor-selection      factor "Data Team Capacity" ⊂ risk "Data Team Capacity Strain"
 *   market-entry          factor "UK Financial Services Deepening" ⊂ option "… (Status Quo)"
 *   headcount-allocation  goal "Achieve ARR Growth by Q3" ⊃ outcome "ARR Growth by Q3"
 *   pricing-model         goal "Achieve Net Revenue Retention Above 110% …" ⊃ outcome "Net Revenue Retention"
 *
 * ROADMAP 1.320 established a clean 6/6 correlate between a near-duplicate
 * label sibling and edits failing at a ~50% base rate, with the mechanism
 * confirmed as `ENTITY_KIND_MISMATCH` at CEE's routing validator — the entity
 * is found by LABEL and then rejected by KIND. The goal⊃outcome pairs are that
 * shape exactly. A starter is the first graph a new user ever edits, so
 * shipping one handed them the failing shape on their first attempt.
 *
 * THE BRIEFS ARE UNCHANGED. Every recapture re-sends the SAME brief bytes as
 * before; only the draw differs. Rewording was tested and proved unnecessary:
 * 11 fresh probes of the ORIGINAL briefs on CEE `cb54320` came back
 * collision-free 6/11 (55%), i.e. the collision is draft NON-DETERMINISM, not
 * a property of the brief. Evidence: raw/probe-results-2026-07-28.jsonl.
 *
 * ⚠ AND THAT 55% IS WHY THE FIX IS NOT THIS FILE. Recapturing is a one-off; the
 * next recapture has a ~45% chance of reintroducing a collision. The durable
 * guard is `src/canvas/starters/nearDuplicateLabels.ts`, asserted per-starter
 * in starters.integrity.spec.ts — it fails loud on any capture that carries one.
 */
const STARTERS = [
  {
    id: 'vendor-selection',
    capture: 'vendor-selection.capture.json',
    ceeBuild: 'cb54320',
    capturedAt: '2026-07-28',
    note: 'RECAPTURED — original brief, 19n/39e/4opt, 56.7s, coaching complete, zero label collisions. Replaces the 1b9d596 draw whose factor "Data Team Capacity" was a token-subset of risk "Data Team Capacity Strain".',
  },
  {
    id: 'market-entry',
    capture: 'market-entry.capture.json',
    ceeBuild: 'cb54320',
    capturedAt: '2026-07-28',
    note: 'RECAPTURED — original brief, 18n/32e/3opt, 56.8s, coaching complete, zero label collisions. Replaces the 1b9d596 draw whose factor "UK Financial Services Deepening" was a token-subset of the option of the same name. Also drafts far more reliably on cb54320 (2/2) than the 1/5 recorded on 1b9d596.',
  },
  {
    id: 'build-vs-buy',
    capture: 'build-vs-buy.capture.json',
    ceeBuild: '1b9d596',
    capturedAt: '2026-07-24',
    note: 'NOT recaptured — probe idx 12, 19n/37e/4opt, 59.1s, coaching complete. The only original capture already free of label collisions, so it is left exactly as it was rather than re-rolled for tidiness.',
  },
  {
    id: 'headcount-allocation',
    capture: 'headcount-allocation.capture.json',
    ceeBuild: 'cb54320',
    capturedAt: '2026-07-28',
    note: 'RECAPTURED — original brief, 16n/25e/4opt, 53.3s, coaching complete, zero label collisions. Replaces the 1b9d596 draw whose goal "Achieve ARR Growth by Q3" strictly contained outcome "ARR Growth by Q3". 1 of 3 fresh draws was collision-free.',
  },
  {
    id: 'pricing-model',
    capture: 'pricing-model.capture.json',
    ceeBuild: 'cb54320',
    capturedAt: '2026-07-28',
    note: 'RECAPTURED — original brief, 15n/30e/4opt, 50.4s, coaching complete, zero label collisions. Replaces the 1b9d596 draw whose goal strictly contained outcome "Net Revenue Retention". 1 of 3 fresh draws was collision-free.',
  },
]

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

/** Fail loudly with a message an operator can act on. */
function fail(msg) {
  console.error(`\n[build-starter-fixtures] FAIL: ${msg}\n`)
  process.exit(1)
}

/**
 * Card copy is DERIVED FROM THE GRAPH, never authored.
 *
 * title   = the `decision` node's label, verbatim
 * summary = the `goal` node's label, verbatim
 *
 * Both are the producer's own words about the graph the card opens, so the card
 * cannot describe something the graph does not contain. A graph missing either
 * node is an error, not a prompt to invent copy.
 */
function deriveCardCopy(id, nodes) {
  const decisions = nodes.filter((n) => n.kind === 'decision')
  const goals = nodes.filter((n) => n.kind === 'goal')
  if (decisions.length !== 1) fail(`${id}: expected exactly 1 decision node, found ${decisions.length}`)
  if (goals.length !== 1) fail(`${id}: expected exactly 1 goal node, found ${goals.length}`)
  const title = decisions[0].label
  const summary = goals[0].label
  if (!title || !summary) fail(`${id}: decision/goal node missing a label — cannot derive card copy`)
  return { title, summary }
}

/** Unwrap an intervention entry, which is a bare number or a `{ value }` object. */
function interventionValue(entry) {
  return typeof entry === 'number' ? entry : entry?.value
}

/**
 * Overlay the re-derived display strings onto one starter's `analysis_ready`.
 *
 * DISPLAY ONLY. Every numeric value is asserted equal to the captured value
 * before the overlay is accepted, so this can correct a string and can never
 * move a number. A missing option or factor is an error, not a silent skip —
 * a partial overlay would leave some receipts on the pre-#944 borrow and read
 * green (CLAUDE.md trap 12: a mirror must fail loud on drift).
 */
function overlayRederivedDisplayValues(id, analysisReady, rederivedForStarter) {
  if (!rederivedForStarter) fail(`${id}: no re-derived analysis_ready entry`)
  const seen = new Set()
  for (const option of analysisReady.options ?? []) {
    const derived = rederivedForStarter[option.id]
    if (!derived) fail(`${id}: re-derivation has no entry for option "${option.id}"`)
    seen.add(option.id)

    for (const [factorId, capturedEntry] of Object.entries(option.interventions ?? {})) {
      const capturedValue = interventionValue(capturedEntry)
      if (typeof capturedValue !== 'number') continue
      const derivedEntry = derived.interventions?.[factorId]
      if (derivedEntry === undefined) fail(`${id}/${option.id}: re-derivation is missing factor "${factorId}"`)
      const derivedValue = interventionValue(derivedEntry)
      // THE LOAD-BEARING ASSERTION: the re-derivation is display-only.
      if (derivedValue !== capturedValue) {
        fail(`${id}/${option.id}/${factorId}: re-derivation moved a VALUE (${capturedValue} → ${derivedValue}); it may only change display strings`)
      }
      const derivedDetail = derived.intervention_details?.[factorId]
      if (!derivedDetail) fail(`${id}/${option.id}: re-derivation is missing intervention_details for "${factorId}"`)
      if (derivedDetail.normalised_value !== capturedValue) {
        fail(`${id}/${option.id}/${factorId}: re-derived intervention_details.normalised_value (${derivedDetail.normalised_value}) ≠ captured value (${capturedValue})`)
      }
      // The two mirrors must carry the SAME string — they did in the capture
      // (0 divergences) and a fix that split them would be a new defect.
      const ivDisplay = typeof derivedEntry === 'object' ? derivedEntry.display_value : undefined
      if (ivDisplay !== undefined && ivDisplay !== derivedDetail.display_value) {
        fail(`${id}/${option.id}/${factorId}: re-derived mirrors disagree (${JSON.stringify(ivDisplay)} vs ${JSON.stringify(derivedDetail.display_value)})`)
      }
    }

    option.interventions = derived.interventions
    option.intervention_details = derived.intervention_details
  }
  for (const optionId of Object.keys(rederivedForStarter)) {
    if (!seen.has(optionId)) fail(`${id}: re-derivation carries option "${optionId}" that the capture does not`)
  }
}

function build() {
  if (!existsSync(BRIEFS)) fail(`missing ${BRIEFS}`)
  const briefs = JSON.parse(readFileSync(BRIEFS, 'utf8')).briefs
  if (!existsSync(REDERIVED)) fail(`missing ${REDERIVED}`)
  const rederivedFile = JSON.parse(readFileSync(REDERIVED, 'utf8'))
  const rederived = rederivedFile.starters
  const rederivedProvenance = rederivedFile._provenance ?? {}
  if (!rederivedProvenance.ceeSha) fail(`${REDERIVED}: no _provenance.ceeSha — the re-derivation must name the CEE build that produced it`)

  const manifestEntries = []
  const fixtures = new Map()

  for (const s of STARTERS) {
    const rawPath = join(RAW_DIR, s.capture)
    if (!existsSync(rawPath)) fail(`missing source capture ${rawPath}`)
    const rawBytes = readFileSync(rawPath)
    const capture = JSON.parse(rawBytes.toString('utf8'))

    // --- Non-vacuous source assertions: prove this capture is a real success ---
    const outcome = capture._pipeline_outcome ?? {}
    if (outcome.graph_drafted !== true) fail(`${s.id}: source capture has graph_drafted !== true`)
    if (outcome.graph_structurally_valid !== true) fail(`${s.id}: source capture is not structurally valid`)
    if (!Array.isArray(capture.nodes) || capture.nodes.length < 3) fail(`${s.id}: source capture has <3 nodes`)
    if (!Array.isArray(capture.edges) || capture.edges.length < 1) fail(`${s.id}: source capture has no edges`)
    const options = capture.analysis_ready?.options ?? []
    if (options.length < 2) fail(`${s.id}: source capture has <2 options`)
    if (typeof capture.analysis_ready?.goal_node_id !== 'string') fail(`${s.id}: no analysis_ready.goal_node_id`)

    const brief = briefs[s.id]
    if (typeof brief !== 'string' || brief.length < 50) fail(`${s.id}: missing/short brief in briefs.json`)

    // --- Transformation 1: delete the diagnostic keys ---
    const fixture = { ...capture }
    for (const k of STRIPPED_KEYS) delete fixture[k]

    // Prove the strip did not touch anything load-bearing. Runs BEFORE the
    // overlay so it still measures a pure deletion — checking it afterwards
    // would fold two transformations into one assertion and see neither.
    for (const k of Object.keys(capture)) {
      if (STRIPPED_KEYS.includes(k)) continue
      if (JSON.stringify(capture[k]) !== JSON.stringify(fixture[k])) {
        fail(`${s.id}: key "${k}" changed during strip — the transformation is not a pure deletion`)
      }
    }

    // --- Transformation 2: overlay the re-derived display strings ---
    // Deep-cloned first: `fixture` is a SHALLOW copy of `capture`, so mutating
    // `fixture.analysis_ready` in place would also rewrite the parsed capture
    // that the assertions above and the counts below are derived from.
    if (fixture.analysis_ready) {
      fixture.analysis_ready = JSON.parse(JSON.stringify(fixture.analysis_ready))
      overlayRederivedDisplayValues(s.id, fixture.analysis_ready, rederived[s.id])
    }

    const { title, summary } = deriveCardCopy(s.id, capture.nodes)

    fixtures.set(s.id, JSON.stringify(fixture, null, 2) + '\n')

    manifestEntries.push({
      id: s.id,
      // Producer's own words, derived from the graph (see deriveCardCopy).
      title,
      summary,
      // The exact bytes that produced this graph. The redraft affordance
      // re-sends THIS string, so it can never drift from the graph shown.
      brief,
      // Derived counts — a test pins these against the fixture so a fixture
      // swap without a manifest rebuild fails loud instead of mislabelling.
      nodeCount: capture.nodes.length,
      edgeCount: capture.edges.length,
      optionCount: options.length,
      // Total option×factor interventions. Derived, and pinned by the integrity
      // spec so the display-coherence guards cannot go vacuous: stripping
      // display strings to satisfy an absence assertion moves this count and
      // REDs (see starters.integrity.spec.ts, the coverage pin).
      interventionCount: options.reduce((n, o) => n + Object.keys(o.interventions ?? {}).length, 0),
      provenance: {
        source: 'POST https://cee-staging.onrender.com/assist/v1/draft-graph',
        // Per-starter, not a shared constant: the set spans two CEE builds
        // since the 2026-07-28 collision recapture (see STARTERS above).
        ceeBuild: s.ceeBuild,
        capturedAt: s.capturedAt,
        requestId: capture.trace?.request_id ?? null,
        model: capture.trace?.pipeline?.llm_metadata?.model ?? null,
        promptVersion: capture.trace?.pipeline?.llm_metadata?.prompt_version ?? null,
        coachingStatus: outcome.coaching_status ?? null,
        captureFile: `docs/evidence/starters/raw/${s.capture}`,
        captureSha256: sha256(rawBytes),
        // Disclosed on the record: the shipped graph is the captured graph, but
        // its analysis_ready display STRINGS were re-derived through CEE's
        // post-#944 guarded transform. Values, nodes, edges and counts are the
        // capture's own. See the script header.
        displayValuesRederived: {
          reason: 'capture predates CEE #944 (sitsAtObservedState); every option borrowed the factor baseline display string',
          artefact: 'docs/evidence/starters/rederived-analysis-ready.json',
          ceeSha: rederivedProvenance.ceeSha,
          rederivedAt: rederivedProvenance.rederivedAt,
        },
        note: s.note,
      },
    })
  }

  const manifestJson =
    JSON.stringify(
      {
        _generated: 'scripts/build-starter-fixtures.mjs — DO NOT EDIT BY HAND. Run the script; `--check` fails CI on drift.',
        _strippedKeys: STRIPPED_KEYS,
        starters: manifestEntries,
      },
      null,
      2,
    ) + '\n'

  return { fixtures, manifestJson }
}

const check = process.argv.includes('--check')
const { fixtures, manifestJson } = build()

let drift = 0
for (const [id, body] of fixtures) {
  const path = join(OUT_DIR, `${id}.draft.json`)
  if (check) {
    if (!existsSync(path)) { console.error(`DRIFT: missing ${path}`); drift++; continue }
    if (readFileSync(path, 'utf8') !== body) { console.error(`DRIFT: ${path} differs from re-derived output`); drift++ }
  } else {
    writeFileSync(path, body)
    console.log(`wrote ${path} (${(body.length / 1024).toFixed(1)} KB)`)
  }
}
if (check) {
  if (!existsSync(MANIFEST)) { console.error(`DRIFT: missing ${MANIFEST}`); drift++ }
  else if (readFileSync(MANIFEST, 'utf8') !== manifestJson) { console.error(`DRIFT: ${MANIFEST} differs from re-derived output`); drift++ }
  if (drift > 0) fail(`${drift} starter artefact(s) drifted from their source captures. Run: node scripts/build-starter-fixtures.mjs`)
  console.log('[build-starter-fixtures] OK — all starter fixtures + manifest match their source captures.')
} else {
  writeFileSync(MANIFEST, manifestJson)
  console.log(`wrote ${MANIFEST}`)
}
