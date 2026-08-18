/**
 * N-23 — STALE COACHING MUST NOT SURVIVE A LOCAL STRUCTURAL EDIT, ON THE SURFACE
 * THE DEPLOYMENT ACTUALLY MOUNTS.
 *
 * THE DEFECT, derived at the bytes at `4d1e650b` (the commit deployed to
 * staging, `version.json`): `clearGuidanceItems()` had exactly ONE production
 * caller — `useGraphEditEvents.ts:293` — and that hook's only host is
 * `DraftChat`, which `ReactFlowGraph.tsx:2484` mounts ONLY when `aiPanelV2` is
 * OFF (`{!isAiPanelV2Enabled() && <DraftChat />}`). The flag is `"true"` at
 * `netlify.toml:57`, i.e. ON for every deployed user. So the mechanism that
 * drops coaching when the user changes their model never ran for anybody: the
 * guidance strip, the on-canvas node coaching markers and every inspector
 * coaching section could go on describing a model that no longer exists.
 *
 * WHY THE FIX IS A NEW HOOK RATHER THAN A RE-HOST. Mounting `useGraphEditEvents`
 * on the live path would also switch on `direct_graph_edit` wire emission for
 * every user — a change to what CEE receives, smuggled in as a UX fix. The
 * coaching half is therefore split out as `useGuidanceInvalidationOnEdit`, which
 * takes no transport and imports none, and is hosted by
 * `GuidanceInvalidationHost`. §2 below enforces that separation AT THE SOURCE,
 * with a contrast control, so it cannot decay into a promise in a comment.
 *
 * CLAIM TYPE (CLAUDE.md trap 3): §1 asserts STORE STATE after a real store
 * mutation; §2 asserts SOURCE TEXT. Neither proves anything about pixels. The
 * on-screen proof is the deployed witness recorded with this lane.
 *
 * DIRECTIONAL COVERAGE (trap 22b — a corpus that tests one direction is a guard
 * watching one door): every clearing case below has an opposite-direction twin
 * proving coaching SURVIVES the things that must not wipe it. A hook that
 * cleared guidance on every store tick would pass a one-directional suite and
 * destroy the user's coaching on a node drag.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Node, Edge } from '@xyflow/react'

import { useGuidanceInvalidationOnEdit } from '../useGraphEditEvents'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'
import { useCanvasStore } from '../../store'

// ── fixtures ───────────────────────────────────────────────────────────────

const SCENARIO = 'scenario-n23'

/** Bound BY IDENTITY (trap 19): every assertion names this id, never a count alone. */
const ITEM_ID = 'guidance-n23-target'

function item(id: string): GuidanceItem {
  return {
    item_id: id,
    source: 'analysis',
    title: `Coaching ${id}`,
    primary_action: { type: 'discuss', prompt: 'tell me more' },
    priority: 50,
  }
}

function node(id: string, label: string, x = 0, y = 0): Node {
  return { id, type: 'factor', position: { x, y }, data: { label } }
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target, data: {} }
}

const BASE_NODES: Node[] = [node('n1', 'Revenue'), node('n2', 'Cost')]
const BASE_EDGES: Edge[] = [edge('e1', 'n1', 'n2')]

/** Ids of the guidance currently in the store — the object-level assertion target. */
function guidanceIds(): string[] {
  return useGuidanceStore.getState().guidanceItems.map((i) => i.item_id)
}

function seedGraph(): void {
  useCanvasStore.setState({
    nodes: BASE_NODES,
    edges: BASE_EDGES,
    currentScenarioId: SCENARIO,
    _externalMutationActive: 0,
  } as never)
}

function seedGuidance(): void {
  useGuidanceStore.setState({ guidanceItems: [item(ITEM_ID)], activeGuidanceItemId: null })
}

// ---------------------------------------------------------------------------
// § 1 — BEHAVIOUR
// ---------------------------------------------------------------------------

describe('N-23 §1 — useGuidanceInvalidationOnEdit clears stale coaching on a local structural edit', () => {
  beforeEach(() => {
    seedGraph()
    seedGuidance()
  })

  afterEach(() => {
    useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null })
  })

  it('CONTROL: the fixture actually seeds the item under test', () => {
    // Trap 13 — an absence assertion is vacuous unless the presence is proven
    // first. Every "cleared" case below is meaningless if this is empty.
    expect(guidanceIds()).toContain(ITEM_ID)
  })

  it('a node ADD clears the coaching authored against the previous model', () => {
    renderHook(() => useGuidanceInvalidationOnEdit())
    expect(guidanceIds(), 'precondition: mounting alone must not clear').toContain(ITEM_ID)

    useCanvasStore.setState({ nodes: [...BASE_NODES, node('n3', 'Churn')] } as never)

    expect(guidanceIds()).not.toContain(ITEM_ID)
  })

  it('a node REMOVE clears it', () => {
    renderHook(() => useGuidanceInvalidationOnEdit())
    useCanvasStore.setState({ nodes: [BASE_NODES[0]] } as never)
    expect(guidanceIds()).not.toContain(ITEM_ID)
  })

  it('a node RELABEL (structural data change) clears it', () => {
    renderHook(() => useGuidanceInvalidationOnEdit())
    useCanvasStore.setState({
      nodes: [node('n1', 'Gross Revenue'), BASE_NODES[1]],
    } as never)
    expect(guidanceIds()).not.toContain(ITEM_ID)
  })

  it('an EDGE ADD clears it', () => {
    renderHook(() => useGuidanceInvalidationOnEdit())
    useCanvasStore.setState({ edges: [...BASE_EDGES, edge('e2', 'n2', 'n1')] } as never)
    expect(guidanceIds()).not.toContain(ITEM_ID)
  })

  // ── opposite-direction twins ─────────────────────────────────────────────

  it('TWIN: a POSITION-ONLY move must NOT clear coaching', () => {
    // Dragging a node is not a change to the model the coaching describes. A
    // hook that cleared on every store tick would pass every case above and
    // silently destroy the user's coaching on a drag.
    renderHook(() => useGuidanceInvalidationOnEdit())
    useCanvasStore.setState({
      nodes: [node('n1', 'Revenue', 400, 250), BASE_NODES[1]],
    } as never)
    expect(guidanceIds()).toContain(ITEM_ID)
  })

  it('TWIN: a structural change under an EXTERNAL mutation must NOT clear coaching', () => {
    // Accepting an assistant patch runs under `beginExternalGraphMutation`
    // and uses `clearItemsByTargetIds` to drop only what the patch touched.
    // A blanket clear here would destroy untargeted items that are still valid,
    // and would defeat `guidanceStore`'s `minting` gate.
    renderHook(() => useGuidanceInvalidationOnEdit())
    useCanvasStore.setState({
      _externalMutationActive: 1,
      nodes: [...BASE_NODES, node('n3', 'Patched')],
    } as never)
    expect(guidanceIds()).toContain(ITEM_ID)
  })

  it('TWIN: a SCENARIO SWITCH re-baselines and must NOT clear coaching', () => {
    renderHook(() => useGuidanceInvalidationOnEdit())
    useCanvasStore.setState({
      currentScenarioId: 'scenario-other',
      nodes: [node('x1', 'Elsewhere')],
    } as never)
    expect(guidanceIds()).toContain(ITEM_ID)
  })

  it('after an external mutation the baseline advances, so the NEXT real edit still clears', () => {
    // The re-baseline in the suppression limb is load-bearing: without it the
    // next user edit diffs against a pre-patch graph. This pins that the
    // suppression is a skip, not a permanent deafness.
    renderHook(() => useGuidanceInvalidationOnEdit())
    const patched = [...BASE_NODES, node('n3', 'Patched')]
    useCanvasStore.setState({ _externalMutationActive: 1, nodes: patched } as never)
    expect(guidanceIds(), 'precondition: the patch itself did not clear').toContain(ITEM_ID)

    useCanvasStore.setState({ _externalMutationActive: 0 } as never)
    useCanvasStore.setState({ nodes: [...patched, node('n4', 'User added this')] } as never)
    expect(guidanceIds()).not.toContain(ITEM_ID)
  })

  it('an unmounted hook stops clearing (no leaked subscription)', () => {
    const { unmount } = renderHook(() => useGuidanceInvalidationOnEdit())
    unmount()
    seedGuidance()
    useCanvasStore.setState({ nodes: [...BASE_NODES, node('n9', 'After unmount')] } as never)
    expect(guidanceIds()).toContain(ITEM_ID)
  })
})

// ---------------------------------------------------------------------------
// § 2 — REACHABILITY AND THE WIRE SEPARATION, AT THE SOURCE
//
// The defect this closes was never a logic error — the logic was correct and
// unreachable. A behaviour suite cannot see that, because it mounts the hook
// itself. These assertions read the production source.
// ---------------------------------------------------------------------------

const CANVAS_ROOT = 'src/canvas/ReactFlowGraph.tsx'
const HOST = 'src/canvas/conversation/GuidanceInvalidationHost.tsx'
const EMITTER_FILE = 'src/canvas/conversation/useGraphEditEvents.ts'
const SIBLING_HOST = 'src/canvas/conversation/StructuralDeleteDrainHost.tsx'

function read(repoRelative: string): string {
  return readFileSync(resolve(process.cwd(), repoRelative), 'utf8')
}

/**
 * The flag-ON provider block, anchored on the FUNCTION DECLARATION first.
 *
 * ⚠ Not a tidy-up: `drainHostReachability.derived.spec.ts` records that slicing
 * the whole file on `<ConversationProvider>` matched a DOC-COMMENT mention
 * rather than the JSX, and still returned the right answer — a probe reading the
 * wrong bytes and agreeing anyway (trap 16). Anchoring on the declaration puts
 * the comment out of range.
 */
function flagOnProviderBlock(): string {
  const source = read(CANVAS_ROOT)
  const fnStart = source.indexOf('export function MaybeConversationProvider')
  if (fnStart === -1) return ''
  const body = source.slice(fnStart)
  const open = body.indexOf('<ConversationProvider>')
  const close = body.indexOf('</ConversationProvider>')
  if (open === -1 || close === -1 || close <= open) return ''
  return body.slice(open, close)
}

/**
 * Strip JSX `{/* … *\/}` and `//` comments.
 *
 * ⚠ WRITTEN AFTER THIS SPEC'S OWN PROBE FAILED ON ITSELF, which is the reason it
 * exists rather than a tidy-up. The "did not re-host the emitter" assertion below
 * matched the word `useGraphEditEvents` inside the explanatory JSX COMMENT beside
 * the new mount, and reported a re-host that had not happened. A substring probe
 * over source cannot tell a call from a mention (CLAUDE.md trap 16: a grepped
 * symbol proves presence-in-text, never presence-on-the-live-path). The failure
 * was the honest one — it fired when nothing was wrong — but the inverse of the
 * same blindness is a probe that passes while something IS wrong.
 */
function stripComments(source: string): string {
  return source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

/** The body of one top-level function, up to the next top-level `export function`. */
function functionBody(source: string, declaration: string): string {
  const start = source.indexOf(declaration)
  if (start === -1) return ''
  const rest = source.slice(start + declaration.length)
  const next = rest.indexOf('\nexport function ')
  return next === -1 ? rest : rest.slice(0, next)
}

describe('N-23 §2 — the fix is mounted on the deployed surface, and carries no wire', () => {
  it('CONTROL: every source this section reads is non-empty', () => {
    // Trap 13e / the zsh-empty-file lesson: an instrument that extracted nothing
    // agrees with every other instrument that extracted nothing. Every assertion
    // below is vacuous if any of these is empty.
    for (const f of [CANVAS_ROOT, HOST, EMITTER_FILE, SIBLING_HOST]) {
      expect(read(f).length, `${f} read as empty`).toBeGreaterThan(200)
    }
  })

  it('CONTROL: the flag-ON provider block is found and already hosts its known siblings', () => {
    // If `MaybeConversationProvider` is renamed or restructured this returns '',
    // and the mount assertion below would read "absent" as a finding rather than
    // as instrument failure (trap 20: uniformity is evidence about the probe).
    const block = flagOnProviderBlock()
    expect(block.length).toBeGreaterThan(0)
    expect(block).toContain('<PanelApplyDrainHost />')
    expect(block).toContain('<StructuralDeleteDrainHost />')
  })

  it('GuidanceInvalidationHost is mounted inside the flag-ON provider', () => {
    // THE PROOF OBLIGATION: deleting the mount must RED. This is the guard that
    // was missing when the capability first shipped dark.
    //
    // ⚠⚠ STRIPPED, AND THE OMISSION HERE WAS THE REAL DEFECT. The first version
    // of this spec added `stripComments` to the NEGATIVE assertions and not to
    // this one — the ASYMMETRY is the bug. Mutant M1b (delete the mount, leave a
    // JSX comment that merely NAMES `<GuidanceInvalidationHost />`) left this
    // test GREEN: a comment satisfied the spec's central claim. Finding one
    // instance of a class is not finding the class.
    expect(stripComments(flagOnProviderBlock())).toContain('<GuidanceInvalidationHost />')
  })

  it('M1b: a COMMENT naming the host does not satisfy the mount assertion', () => {
    // The permanent, in-suite form of the mutant. If `stripComments` ever stops
    // stripping, this REDs — rather than the mount assertion silently going blind.
    const commentOnly = '{/* <GuidanceInvalidationHost /> was here */}\n<Other />'
    expect(stripComments(commentOnly)).not.toContain('<GuidanceInvalidationHost />')
    // …and a real mount still survives the strip (contrast: the strip is not
    // simply eating everything).
    expect(stripComments('{/* note */}\n<GuidanceInvalidationHost />')).toContain(
      '<GuidanceInvalidationHost />',
    )
  })

  it('M6/M8: the RENDER path and the FLAG that decides it are pinned here', () => {
    // ⚠ THIS SPEC WAS NOT SELF-SUFFICIENT ON ITS OWN CENTRAL CLAIM. Two mutants
    // left it 22/22 GREEN:
    //   M6 — `<MaybeConversationProvider>` replaced by `<>`, so EVERY host in the
    //        block above goes dark while the block itself still reads correct.
    //   M8 — `if (isAiPanelV2Enabled())` inverted to `if (!isAiPanelV2Enabled())`,
    //        this estate's twice-shipped signature defect.
    // Both were caught only by `panelApplyReachability.production.spec.tsx` — a
    // spec this file's own header disparaged while silently depending on it for
    // the only render-level and flag-level guard that existed. Pinned here now.
    const source = stripComments(read(CANVAS_ROOT))

    // M6: the provider must actually be RENDERED, not merely declared.
    expect(source, 'M6: MaybeConversationProvider must be rendered').toMatch(
      /<MaybeConversationProvider[\s>]/,
    )

    // M8: the flag-ON branch must be the POSITIVE test, verbatim.
    const fnStart = source.indexOf('export function MaybeConversationProvider')
    expect(fnStart, 'precondition: the provider function was found').toBeGreaterThan(-1)
    const body = source.slice(fnStart, fnStart + 400)
    expect(body, 'M8: the flag-ON branch must not be inverted').toContain(
      'if (isAiPanelV2Enabled()) {',
    )
    expect(body).not.toContain('if (!isAiPanelV2Enabled()) {')
  })

  it('the canvas root imports the host from its own module', () => {
    expect(read(CANVAS_ROOT)).toContain(
      "import { GuidanceInvalidationHost } from './conversation/GuidanceInvalidationHost'",
    )
  })

  it('the host calls the wire-free hook', () => {
    const host = read(HOST)
    expect(host).toContain('useGuidanceInvalidationOnEdit()')
    expect(host).toContain("from './useGraphEditEvents'")
  })

  it('the invalidation hook is STRUCTURALLY incapable of emitting to the wire', () => {
    const emitterSource = read(EMITTER_FILE)
    const invalidation = functionBody(emitterSource, 'export function useGuidanceInvalidationOnEdit')
    const emitter = functionBody(emitterSource, 'export function useGraphEditEvents')

    // CONTRAST CONTROL (trap 13e): absence is only evidence when the same probe
    // reads a PRESENCE on a same-family target in the same run. If this probe
    // were blind, the emitter would read clean too.
    expect(emitter, 'contrast: the emitter DOES take the transport').toContain('sendSystemEvent')
    expect(emitter, 'contrast: the emitter DOES emit direct_graph_edit').toContain(
      'direct_graph_edit',
    )

    expect(invalidation.length, 'precondition: the hook body was extracted').toBeGreaterThan(200)
    expect(invalidation, 'the coaching hook must not touch the transport').not.toContain(
      'sendSystemEvent',
    )
    expect(invalidation).not.toContain('direct_graph_edit')
    expect(invalidation).not.toContain('appendEvent')
    // The whole point of the split: it DOES do the coaching job.
    expect(invalidation).toContain('clearGuidanceItems()')
  })

  it('the host itself pulls in no transport', () => {
    const host = read(HOST)
    // CONTRAST CONTROL: the sibling host genuinely does take the transport, so a
    // probe that saw nothing anywhere would fail here first.
    const sibling = read(SIBLING_HOST)
    expect(sibling, 'contrast: the sibling host DOES use the conversation transport').toContain(
      'sendSystemEvent',
    )

    expect(host).not.toContain('sendSystemEvent')
    expect(host).not.toContain('useConversationContext')
  })

  it('the two guard chains have not diverged', () => {
    // ⚠ THE "SINGLE AUTHORITY" CLAIM WAS NOT EARNED, and saying so is the point.
    // What is genuinely shared is the DIFF (`takeSnapshot`/`diffSnapshots`). The
    // INVALIDATION DECISION — scenario switch, reference equality,
    // `_externalMutationActive`, baseline advance, position-only — is ~30 lines
    // of COPIED control flow with nothing asserting the two copies agree.
    // Mutant M2c proved the divergence is invisible: removing the position-only
    // guard from the EMITTER left all 22 tests green.
    //
    // This does not merge the two chains (they legitimately differ after the
    // decision point: one clears, one debounces and emits). It asserts that both
    // still ASK THE SAME QUESTIONS, so a guard deleted from either side REDs.
    const src = read(EMITTER_FILE)
    const emitter = stripComments(functionBody(src, 'export function useGraphEditEvents'))
    const invalidation = stripComments(
      functionBody(src, 'export function useGuidanceInvalidationOnEdit'),
    )

    expect(emitter.length, 'precondition: emitter body extracted').toBeGreaterThan(200)
    expect(invalidation.length, 'precondition: invalidation body extracted').toBeGreaterThan(200)

    const SHARED_GUARDS: Array<[string, RegExp]> = [
      ['scenario switch', /currentScenarioId !== scenarioIdRef\.current/],
      ['reference equality', /curr\.nodes === prev\.nodes && curr\.edges === prev\.edges/],
      ['external mutation', /curr\._externalMutationActive > 0/],
      ['missing baseline', /if \(!prevSnapshot\)/],
      ['position-only', /if \(!diff\)/],
    ]
    for (const [name, re] of SHARED_GUARDS) {
      expect(re.test(emitter), `emitter lost its "${name}" guard`).toBe(true)
      expect(re.test(invalidation), `invalidation lost its "${name}" guard`).toBe(true)
    }
  })

  it('the emitter keeps its single DraftChat host — this lane did not re-host it', () => {
    // The flag-OFF path must be untouched: `useGraphEditEvents` still runs only
    // inside DraftChat, so no flag-ON user starts sending `direct_graph_edit`.
    // If a later lane re-hosts it, that is a wire decision and this REDs to say so.
    const block = stripComments(flagOnProviderBlock())

    // CONTROL: stripping must not have eaten the block itself — an empty string
    // would satisfy every `not.toContain` below by testing nothing (trap 13).
    expect(block).toContain('<GuidanceInvalidationHost />')

    expect(block).not.toContain('useGraphEditEvents')
    expect(stripComments(read(HOST))).not.toContain('useGraphEditEvents(')

    // The flag-OFF host is untouched and still the emitter's only caller.
    expect(read(CANVAS_ROOT)).toContain('{!isAiPanelV2Enabled() && <DraftChat />}')
  })
})
