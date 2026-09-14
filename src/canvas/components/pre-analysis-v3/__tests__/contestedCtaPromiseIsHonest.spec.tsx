/**
 * THE CONTESTED CTA MAY PROMISE ONLY WHAT ITS DESTINATION CAN DO.
 *
 * ── THE DEFECT, DERIVED AT STAGING `2416ac3f` ──────────────────────────────
 * `ContestedSection` ships a LIVE button — pre-analysis v3 is on in staging
 * (`netlify.toml:179`, `VITE_FEATURE_PRE_ANALYSIS_V3 = "1"`) — reading
 * **"Settle these in the model tab"**. The Model tab cannot settle them. The
 * only control that has ever offered the four adjudication verdicts (accept the
 * first look, accept the review, enter your own, dismiss) is
 * `ContestedEdgeCard`, and its ONE remaining product render site is not mounted:
 *
 *   · `pre-analysis/AllImprovements.tsx` — exported from the
 *     `pre-analysis/index.ts` barrel and imported by NO product file.
 *
 * ⚠ UPDATED 2026-09-11. There used to be a second site,
 * `model-tab/RelationshipsSection.tsx`, hosted ONLY at `ModelTabBody.tsx` INSIDE
 * `{LEGACY_DETAILED_EDITOR_MOUNTED && (…)}` with that constant `false` — esbuild
 * folded it, so the stack was not merely hidden, it was not shipped. It was
 * DELETED with the v1 Model stack (Paul's ruling). The claim this file makes is
 * unchanged in substance and simpler to state: adjudication has no live route.
 * It got weaker in one respect worth naming — there is now one host rather than
 * two, so reviving the capability is a build rather than a mount.
 *
 * `ModelTabV2Panel`'s own `MountedQueueId` says the same thing from the other
 * side: it is `Extract<RepairQueue['id'], 'confirm-estimates'>` deliberately,
 * because typing it to the total union "would make `'contested'` look
 * sanctioned when nothing renders it".
 *
 * An advertised action that terminates in nothing is the defect class this
 * estate ships most often. This spec closes it and keeps it closed.
 *
 * ── WHY THE BUTTON STAYS ───────────────────────────────────────────────────
 * The destination is not empty. The v2 outline carries every CAUSAL contested
 * relationship, marked with its own shape and named "Two passes disagree"
 * (`adapters.ts` → `rowPresentation.ts`), and — per edge, where
 * `edgeStrengthEditIsAssertable` holds — the row's strength IS editable through
 * a server-authoritative carrier. So the honest fix is to stop claiming
 * ADJUDICATION, not to remove the route: §2 below MEASURES that the destination
 * shows something, which is what licenses keeping the navigation at all.
 *
 * ⚠⚠ "CAUSAL" IS LOAD-BEARING AND WAS MISSING FROM THIS COMMENT — THE TWO
 * SURFACES DO NOT SHARE A TOPOLOGY FILTER. The destination applies
 * `getCausalEdges` (`adapters.ts:136`), which drops every edge whose source OR
 * target is a `decision` or `option` node (`domain/edgeUtils.ts:77-90`,
 * sign-symmetric on both endpoints). The pre-analysis rows CANNOT apply it:
 * `selectSurfacedContestedEdges` takes `edges` only — no node parameter — and
 * `computeContestedRows.ts:62` calls it that way, using `nodes` for labels
 * alone. The exclusion is therefore structurally impossible on that side.
 *
 * So an option-sourced or decision-touching contested edge is listed here and
 * is ABSENT at the destination the CTA names. §2b pins exactly that, in both
 * directions, so the gap cannot widen or silently close unobserved.
 *
 * ⭐ WHAT IS NOT SETTLED, WRITTEN DOWN RATHER THAN LEFT IMPLIED: whether CEE
 * ever attaches two-pass contested validation to a decision- or option-touching
 * edge. This repo cannot answer it — the shape is admitted by the type either
 * way. If the answer is "never", the gap is unreachable and this is a
 * documentation nicety; if it is "sometimes", the CTA routes a user to a
 * surface that will not show the row they clicked from. **The claim in this
 * comment must not depend on which it turns out to be**, which is why it is
 * qualified rather than defended.
 *
 * ── WHAT EACH SECTION IS FOR ───────────────────────────────────────────────
 * §1 DERIVES the premise (no adjudication host is mounted) from the source
 *    rather than restating it, with a CONTRAST CONTROL in the same scan — a
 *    sibling that IS mounted, and a sibling of the unmounted one that IS
 *    imported. An absence claim whose probe has never returned a presence is
 *    not evidence (trap 13). If somebody re-mounts an adjudication host, §1
 *    goes RED and the copy is due a review — which is the point of deriving it.
 * §2 MEASURES the destination surface itself (not a component in isolation —
 *    trap 3b), with the attention mark as the positive control.
 * §3 pins the COPY against both.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Edge, Node } from '@xyflow/react'

import { stripComments } from '../../../../../tests/helpers/stripSourceComments'
import { CONTESTED_COPY } from '../constants'
import { ATTENTION_LABEL } from '../../../model-tab-v2/rowPresentation'
import { ModelTabV2Panel } from '../../../model-tab-v2/ModelTabV2Panel'
import { makeContestedEdge, makeContestedValidation } from '../../../../__fixtures__/contestedEdge'
import { openOutlineGroups } from '../../../model-tab-v2/__tests__/openOutlineGroups'
import { computeContestedRows } from '../selectors/computeContestedRows'
import { getCausalEdges } from '../../../domain/edgeUtils'
import type { EdgeData } from '../../../domain/edges'

vi.mock('../../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

// ─────────────────────────────────────────────────────────────────────────────
// §1 — DERIVED: no adjudication host is mounted
// ─────────────────────────────────────────────────────────────────────────────

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const EXCLUDED_DIRS = new Set(['node_modules', '__tests__', '__mocks__', 'test', 'tests'])

/** Every PRODUCT `.ts`/`.tsx` under `src/`, comments blanked, keyed by repo path. */
function productSources(): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(full)
        continue
      }
      if (!/\.tsx?$/.test(entry.name)) continue
      if (/\.(spec|test)\.tsx?$/.test(entry.name)) continue
      out.set(
        relative(SRC, full).split(sep).join('/'),
        stripComments(readFileSync(full, 'utf8'), entry.name),
      )
    }
  }
  walk(SRC)
  return out
}

const SOURCES = productSources()

/** Files whose CODE (not comments) renders the named component. */
function renderersOf(component: string): string[] {
  const needle = `<${component}`
  return [...SOURCES.entries()]
    .filter(([, text]) => text.includes(needle))
    .map(([path]) => path)
    .sort()
}

describe('§1 the Model tab has no mounted contested-adjudication control', () => {
  it('CONTROL: the scan can see a product file at all, and it strips comments', () => {
    // Without this every absence below could pass against an empty walk. The
    // second half matters more than it looks: `ContestedEdgeCard` is named in
    // the COMMENTS of a dozen live files, and a scan that counted those would
    // report a mounted host that does not exist.
    expect(SOURCES.size).toBeGreaterThan(500)
    expect(SOURCES.has('canvas/components/ModelTabBody.tsx')).toBe(true)
    const contestedSection = SOURCES.get(
      'canvas/components/pre-analysis-v3/contested/ContestedSection.tsx',
    )
    expect(contestedSection, 'the section under discussion must be in the walk').toBeTruthy()
    expect(
      contestedSection!.includes('ContestedEdgeCard'),
      'this file names the card in its HEADER only — a comment-blind scan would see it here',
    ).toBe(false)
  })

  it('the card has exactly ONE product render site, and this is the whole manifest', () => {
    // EXACT equality in both directions. Growth is a new host (the copy may
    // then be strengthened); shrinkage is a removal landing, and it must red
    // too so the removing commit has to come here and say so.
    //
    // ⭐ A REMOVAL LANDED, AND THIS IS THE COMMIT COMING HERE TO SAY SO
    // (2026-09-11, Paul's ruling on the v1 Model-stack removal). The manifest was
    // two entries; `canvas/components/model-tab/RelationshipsSection.tsx` was
    // DELETED. It rendered inside `ModelTabBody`'s `LEGACY_DETAILED_EDITOR_MOUNTED
    // = false` gate and `ModelTabBody` was its only importer, so it was already
    // unreachable — the removal cost no user anything it could reach.
    //
    // ⚠ WHAT THE REMOVAL DID COST, stated plainly rather than implied: this card
    // now has exactly one host, and that host (`AllImprovements`) is ITSELF
    // unmounted — see the next case, which pins that and is unchanged. So
    // contested-edge adjudication has no live route at all, and reviving it is now
    // a build, not a flag flip. `ContestedEdgeCard.tsx` and `AllImprovements.tsx`
    // were both KEPT deliberately: the card still has a host, so it is not dead by
    // manifest, and removing the pair is a product decision about a capability,
    // not a tidy-up that belongs in a dead-code removal.
    expect(renderersOf('ContestedEdgeCard')).toEqual([
      'canvas/components/pre-analysis/AllImprovements.tsx',
    ])
  })

  /**
   * ⚠ 'host 1' WAS HERE AND IS DELETED (2026-09-11). It proved that
   * `RelationshipsSection` was rendered ONLY inside `ModelTabBody`'s
   * `{LEGACY_DETAILED_EDITOR_MOUNTED && (` block — with a contrast control in the
   * same scan showing `<ModelHealthSection>` OUTSIDE it, so the probe could tell a
   * dead host from a live one.
   *
   * That case cannot run: the gate, the block and `RelationshipsSection.tsx` were
   * all deleted with the v1 Model stack (Paul's ruling). Its conclusion is now a
   * stronger fact recorded in the manifest above — the host does not exist, which
   * needs no containment argument. `host 2` below is unchanged and still carries
   * the live half of the claim: the surviving host is itself unmounted.
   */
  it('host 2: AllImprovements is exported by the barrel and imported by nothing', () => {
    const importers = [...SOURCES.entries()]
      .filter(([path]) => path !== 'canvas/components/pre-analysis/AllImprovements.tsx')
      .filter(([path]) => path !== 'canvas/components/pre-analysis/index.ts')
      .filter(([, text]) => text.includes('AllImprovements'))
      .map(([path]) => path)
    expect(importers).toEqual([])

    // ⚠ CONTRAST CONTROL. `PreAnalysisPanel` leaves the SAME barrel and IS
    // imported by the dock — so "nothing imports AllImprovements" is a fact
    // about that symbol, not a probe that cannot see a barrel import.
    const barrel = SOURCES.get('canvas/components/pre-analysis/index.ts')!
    expect(barrel).toContain('export { AllImprovements }')
    expect(barrel).toContain('export { PreAnalysisPanel }')
    const dock = SOURCES.get('canvas/components/OutputsDock.tsx')!
    expect(dock, 'CONTRAST: a sibling of the same barrel IS imported').toContain(
      "import { PreAnalysisPanel } from './pre-analysis'",
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §2 — MEASURED: the destination shows the contested relationships
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_ID = 'f_lead'
const TARGET_ID = 'f_speed'
const EDGE_ID = 'e_lead_speed'

function factor(id: string, label: string): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label } } as Node
}

function renderDestination() {
  render(
    <ModelTabV2Panel
      nodes={[factor(SOURCE_ID, 'Tech lead impact'), factor(TARGET_ID, 'Delivery speed')]}
      edges={
        [
          makeContestedEdge(EDGE_ID, SOURCE_ID, TARGET_ID, makeContestedValidation()),
        ] as Edge[]
      }
      goalThreshold={null}
    />,
  )
  openOutlineGroups()
}

describe('§2 the destination the CTA names', () => {
  beforeEach(() => renderDestination())
  afterEach(() => cleanup())

  it('POSITIVE CONTROL: the contested relationship is on the surface, and says so', () => {
    // This is what licenses keeping the navigation. It is also the control for
    // the absence assertion below: without it, "no adjudication control" could
    // be true because the fixture never reached the surface at all.
    const mark = screen.getByTestId(`model-row-v2-${EDGE_ID}-attention-contested`)
    expect(mark).toBeVisible()
    expect(mark).toHaveAccessibleName(ATTENTION_LABEL.contested)
  })

  it('offers NO verdict on the disagreement — the card is not there', () => {
    // Bound by IDENTITY to the card's own testids (trap 19), not to a phrase
    // another control could satisfy.
    expect(screen.queryByTestId(`contested-card-${EDGE_ID}`)).toBeNull()
    expect(screen.queryByTestId(`contested-actions-${EDGE_ID}`)).toBeNull()
    expect(screen.queryByTestId(`contested-accept-pass1-${EDGE_ID}`)).toBeNull()
    expect(screen.queryByTestId(`contested-accept-pass2-${EDGE_ID}`)).toBeNull()
    expect(screen.queryByTestId(`contested-enter-own-${EDGE_ID}`)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §2b — THE KNOWN GAP, PINNED: the two surfaces do not share a topology filter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * §2's fixture is factor-to-factor, so it CANNOT observe the class the
 * destination excludes — what a corpus leaves out is the thing to check, not
 * what it covers. These cases supply the missing class and bind the divergence
 * in BOTH directions, so the suite REDs if the gap widens OR closes.
 */

const OPTION_ID = 'o_ship_now'
const OPTION_EDGE_ID = 'e_opt_speed'

function option(id: string, label: string): Node {
  return { id, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label } } as Node
}

describe('§2b KNOWN GAP — an option-sourced contested edge reaches ONE surface, not both', () => {
  const gapNodes = [option(OPTION_ID, 'Ship now'), factor(TARGET_ID, 'Delivery speed')]
  const gapEdges = [
    makeContestedEdge(OPTION_EDGE_ID, OPTION_ID, TARGET_ID, makeContestedValidation()),
  ] as Edge[]

  /**
   * `getCausalEdges` declares `Edge<EdgeData>[]`, while the shared fixture
   * (`src/__fixtures__/contestedEdge.ts`) returns a bare `Edge` whose `data` is
   * already the EdgeData shape (weight, direction, beliefExists, provenance,
   * validation). So the narrowing is truthful about the value, not a cover for
   * a mismatched fixture.
   *
   * Narrowed ONCE here, by the SAME assertion the production caller makes at
   * `ModelTabV2Panel.tsx:330` (`edges as Edge<EdgeData>[]`), so this spec meets
   * the seam on the terms the surface it reasons about already uses.
   *
   * `gapEdges` deliberately stays bare `Edge[]`: that is what the panel's own
   * `edges` prop and `computeContestedRows` declare, and re-typing it would
   * change what those two calls are exercising.
   */
  const gapCausalEdges = gapEdges as Edge<EdgeData>[]

  afterEach(() => cleanup())

  it('the PRE-ANALYSIS surface DOES list it — no node-kind filter exists on that side', () => {
    // Bound by edge IDENTITY, never by count: another row could satisfy a length
    // assertion (trap 19).
    const rows = computeContestedRows(gapNodes, gapEdges)
    expect(rows.map((r) => r.edgeId)).toContain(OPTION_EDGE_ID)
  })

  it('the MODEL-TAB destination DOES NOT — `getCausalEdges` drops it at both endpoints', () => {
    expect(getCausalEdges(gapNodes, gapCausalEdges)).toEqual([])

    render(<ModelTabV2Panel nodes={gapNodes} edges={gapEdges} goalThreshold={null} />)
    openOutlineGroups()
    expect(
      screen.queryByTestId(`model-row-v2-${OPTION_EDGE_ID}-attention-contested`),
    ).toBeNull()
  })

  it('CONTROL: the SAME edge between two factors DOES reach the destination', () => {
    // Without this, the absence above could hold because the fixture never
    // reached the surface at all — an absence probe that has never returned a
    // presence is not evidence (trap 13). The ONLY difference between this case
    // and the one above is the source node's kind.
    const factorNodes = [factor(OPTION_ID, 'Ship now'), factor(TARGET_ID, 'Delivery speed')]
    expect(getCausalEdges(factorNodes, gapCausalEdges)).toHaveLength(1)

    render(<ModelTabV2Panel nodes={factorNodes} edges={gapEdges} goalThreshold={null} />)
    openOutlineGroups()
    expect(
      screen.getByTestId(`model-row-v2-${OPTION_EDGE_ID}-attention-contested`),
    ).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §3 — the copy claims only what §1 and §2 support
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verbs that promise the disagreement will be ENDED. Each one is a claim §1
 * proves false. They are listed rather than derived because there is nothing to
 * derive them FROM — the harm is a promise in English, and the estate's own
 * precedent for this is `test/glossaryBannedTerms`.
 */
const SETTLEMENT_VERBS = ['settle', 'resolve', 'adjudicate', 'decide', 'choose', 'pick', 'fix']

describe('§3 the contested CTA promises navigation, not a verdict', () => {
  it('THE WITNESSED STRING: the CTA no longer says it will settle them', () => {
    // Deployed staging shipped exactly this. Pinned as the regression it was.
    expect(CONTESTED_COPY.reviewCta).not.toBe('Settle these in the model tab')
  })

  it('uses no verb that promises the disagreement will be ended', () => {
    const lower = CONTESTED_COPY.reviewCta.toLowerCase()
    const promised = SETTLEMENT_VERBS.filter(verb => lower.includes(verb))
    expect(promised, `"${CONTESTED_COPY.reviewCta}" claims more than the Model tab can do`).toEqual(
      [],
    )
  })

  it('CONTROL: the verb list can fire, and the CTA still names its destination', () => {
    // A banned-terms assertion that has never matched anything is not evidence.
    expect(SETTLEMENT_VERBS.filter(v => 'Settle these in the model tab'.toLowerCase().includes(v)))
      .toEqual(['settle'])
    // And the button must still be a route: a CTA that stopped naming where it
    // goes would pass every assertion above by saying nothing.
    expect(CONTESTED_COPY.reviewCta.toLowerCase()).toContain('model tab')
  })
})
