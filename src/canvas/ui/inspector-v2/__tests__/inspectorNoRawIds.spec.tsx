/**
 * B4 — NO RAW IDENTIFIER REACHES THE USER FROM AN INSPECTOR PANEL.
 *
 * The defect, measured at `dd089a50`: fourteen call sites across nine panels
 * resolved a missing element name to the element's **id**
 * (`String(n.data?.label ?? n.id)`), unconditionally — not behind technical
 * mode. The panel HEADER, three lines above, already resolved the same absent
 * label to `'Untitled'` (`InspectorRouter.tsx:229`). So one unlabelled node was
 * shown under two different names on one screen, and one of them was a database
 * key the user cannot act on.
 *
 * TWO ASSERTIONS, DELIBERATELY OF DIFFERENT KINDS, because neither alone is
 * enough:
 *
 *   1. A RENDER assertion through the MOUNTED consumer (P2). It proves the
 *      user-visible outcome on a real panel, and it is bound BY IDENTITY: the
 *      unlabelled node's id is a unique string that appears nowhere else in the
 *      fixture, so `queryByText(THAT id)` cannot be satisfied by another
 *      element (trap 19). It covers exactly one panel.
 *
 *   2. A SOURCE SCAN, derived by walking the panel directory, which covers all
 *      of them and keeps covering a panel added tomorrow. A render test per
 *      panel would be a hand-maintained mirror of the panel list (trap 12) and
 *      would go quietly short the moment someone adds the tenth panel.
 *
 * The scan carries a POSITIVE control (it detects the real defect form) and a
 * CONTRAST control (it does NOT flag the sanctioned quoted fallback) — an
 * absence assertion whose matcher is broken reports a clean sweep by testing
 * nothing (trap 13).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

import { stripComments } from '../../../../../tests/helpers/stripSourceComments'
import { resolveElementLabel, UNNAMED_ELEMENT_LABEL } from '../../../domain/elementLabel'

// ── The mounted-consumer assertion ───────────────────────────────────────────

/**
 * A string that could only ever be an id. It is deliberately unlike any label
 * in the fixture, so an assertion naming it is bound to THIS element and cannot
 * pass because some other node happens to share a value (trap 19).
 */
const UNLABELLED_NODE_ID = 'fac_7c21e0_unlabelled_probe'
const SUBJECT_ID = 'node_subject'

const graph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }

function state() {
  return {
    nodes: graph.nodes,
    edges: graph.edges,
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    nodeRationales: {},
  }
}

vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector(state())),
    { getState: state },
  ),
}))

import { GenericNodePanel } from '../panels/GenericNodePanel'

beforeEach(() => {
  vi.clearAllMocks()
  graph.nodes = [
    { id: SUBJECT_ID, type: 'action', position: { x: 0, y: 0 }, data: { label: 'Run the pilot' } },
    // The element under test: present in the graph, connected, and NAMELESS.
    { id: UNLABELLED_NODE_ID, type: 'factor', position: { x: 0, y: 0 }, data: {} },
  ]
  graph.edges = [{ id: 'e1', source: UNLABELLED_NODE_ID, target: SUBJECT_ID, data: {} }]
})

describe('B4 · an inspector panel never shows the user a raw element id', () => {
  it('renders the honest no-name fallback for a connected element that has no label', () => {
    render(<GenericNodePanel nodeId={SUBJECT_ID} techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />)

    const panel = screen.getByTestId('inspector-generic-panel')
    expect(within(panel).getByText(UNNAMED_ELEMENT_LABEL)).toBeInTheDocument()
  })

  it('does NOT print that element’s id anywhere in the panel', () => {
    render(<GenericNodePanel nodeId={SUBJECT_ID} techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />)

    const panel = screen.getByTestId('inspector-generic-panel')
    // Bound by identity: this exact id, which belongs to exactly one element.
    expect(within(panel).queryByText(UNLABELLED_NODE_ID)).toBeNull()
    expect(panel.textContent).not.toContain(UNLABELLED_NODE_ID)
  })

  it('CONTRAST: a named element still shows its own name, not the fallback', () => {
    graph.nodes = [
      { id: SUBJECT_ID, type: 'action', position: { x: 0, y: 0 }, data: { label: 'Run the pilot' } },
      { id: UNLABELLED_NODE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Budget headroom' } },
    ]
    render(<GenericNodePanel nodeId={SUBJECT_ID} techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />)

    const panel = screen.getByTestId('inspector-generic-panel')
    expect(within(panel).getByText('Budget headroom')).toBeInTheDocument()
    // Proves the first two assertions are discriminating rather than always-true:
    // the fallback must be ABSENT when a real name exists.
    expect(within(panel).queryByText(UNNAMED_ELEMENT_LABEL)).toBeNull()
  })
})

// ── The resolver itself ──────────────────────────────────────────────────────

describe('B4 · resolveElementLabel states absence, it never invents a name', () => {
  it('returns the label when one is stated', () => {
    expect(resolveElementLabel({ label: 'Budget headroom' })).toBe('Budget headroom')
  })

  it('returns the no-name fallback when the label is absent, empty or blank', () => {
    expect(resolveElementLabel({})).toBe(UNNAMED_ELEMENT_LABEL)
    expect(resolveElementLabel({ label: '' })).toBe(UNNAMED_ELEMENT_LABEL)
    // Whitespace-only is indistinguishable from no label ON SCREEN; treating it
    // as present renders a nameless row with no fallback at all.
    expect(resolveElementLabel({ label: '   ' })).toBe(UNNAMED_ELEMENT_LABEL)
    expect(resolveElementLabel(undefined)).toBe(UNNAMED_ELEMENT_LABEL)
    expect(resolveElementLabel(null)).toBe(UNNAMED_ELEMENT_LABEL)
  })

  it('never returns an id: it is not given one', () => {
    // The signature takes the DATA BAG, so there is no id in scope to leak.
    // This is the structural half of the guarantee — the scan below is the
    // behavioural half.
    expect(resolveElementLabel({ id: UNLABELLED_NODE_ID })).toBe(UNNAMED_ELEMENT_LABEL)
  })
})

// ── The source scan, derived by walking the directory ────────────────────────

/**
 * The defect form: a label read whose fallback is an EXPRESSION rather than a
 * quoted string. `?? n.id`, `?? e.source`, `?? otherId` all match; the
 * sanctioned `?? 'Untitled'` and `?? ''` do not.
 *
 * Matching the FALLBACK SHAPE rather than a list of id variable names is
 * deliberate: a scan keyed on `\.id\b` would miss `?? otherId` and `?? e.source`,
 * which are two of the real call sites.
 *
 * ⚠ THIS MATCHER WAS WRONG ON ITS FIRST WRITING AND THE CONTRAST CONTROL BELOW
 * IS THE ONLY REASON IT DID NOT SHIP. It was `\?\?\s*(?!['"`])` — a negative
 * lookahead after a greedy-but-optional `\s*`. The regex simply backtracks
 * `\s*` to zero width and evaluates the lookahead against the SPACE, which is
 * not a quote, so the sanctioned `?? 'Untitled'` matched too: the guard flagged
 * all 36 sites including the five already correct. Consuming a CONCRETE
 * non-quote, non-space character cannot backtrack into that. The general
 * lesson: `\s*` followed by a negative lookahead asserts nothing, because the
 * quantifier can always yield the position the lookahead wants.
 */
const ID_FALLBACK_LABEL = /\.data\?\.label\s*\?\?\s*[^\s'"`]/g

/**
 * ⭐⭐ THE SECOND SHAPE — ADDED 10 Sep 2026, AND IT IS WHY THIS FILE'S OWN
 * "NO OFFENDERS" WAS A STATEMENT ABOUT THE INSTRUMENT.
 *
 * `ID_FALLBACK_LABEL` is anchored on the literal text `.data?.label`, because
 * every one of the fourteen original call sites read a NODE'S DATA BAG. The
 * defect CLASS is wider: it is *a label read whose fallback is an expression*,
 * and the label can belong to a WIRE OBJECT that has no `data` bag at all.
 *
 * Measured at `2e8e6d43`, in this directory, which this file walks recursively
 * and certified clean:
 *
 *     {String(c.label ?? c.node_id ?? `#${i + 1}`)}   GoalAdvancedEditor.tsx:73
 *     label: String(factorData?.label ?? factorId),   OptionAdvancedEditor.tsx:41
 *
 * The first printed a CONSTRAINT's target id — a production hash — as the
 * constraint's NAME, on a group whose `label` the contract documents as
 * "genuinely absent in practice" (`adapters/cee/types.ts:278-285`), i.e. the
 * normal case. Neither matched, because `c.label` and `factorData?.label` are
 * not `.data?.label`.
 *
 * ⚠ THE SIBLING GUARD WAS BLIND TOO, ON A DIFFERENT AXIS, AND THE TWO
 * BLINDNESSES ARE NOT THE SAME FACT. `modelTabNoRawIdFallback.sourceScan
 * .spec.ts` matches `\?\?\s*…\.(?:id|source|target)\b` — which reads ZERO on
 * `?? c.node_id` (measured: its own positive control reads 1 on `?? node.id`),
 * because `node_id` is not `id`. So that scan misses this class on its PATTERN
 * as well as on its SCOPE, and fixing the scope alone would not have caught it.
 *
 * This is trap 12d: a guard derived from the one spelling its author had just
 * fixed proves agreement with that spelling and nothing about the class. The
 * widened matcher keeps the original's real insight — match the FALLBACK SHAPE
 * (an unquoted expression), not a list of id variable names — and simply stops
 * requiring the `data?.` segment.
 */
const ID_FALLBACK_LABEL_WIRE = /\.label\s*\?\?\s*[^\s'"`]/g

/**
 * The one site this widening surfaced that is NOT this commit's to fix, pinned
 * with its reason and asserted for EXACT EQUALITY in both directions.
 *
 * `OptionAdvancedEditor.tsx:41` builds an intervention row's display label as
 * `String(factorData?.label ?? factorId)` — a genuine live leak of the same
 * class, in a different editor, reached by a different panel. It is PINNED
 * rather than fixed here because this lane's surface is the GOAL editor and a
 * drive-by fix to the OPTION editor would be the "while we're here" work the
 * scope rule prohibits; it is pinned rather than IGNORED so a NEW leak cannot
 * hide behind it.
 *
 * Growth is a new leak. SHRINKAGE is the follow-up landing, and it must red too,
 * so that commit has to come here and say so rather than quietly satisfying a
 * `<=`.
 */
const WIRE_LABEL_PINNED: Record<string, number> = {
  'OptionAdvancedEditor.tsx': 1,
}

function idFallbacksIn(src: string, file: string): number {
  return [...stripComments(src, file).matchAll(ID_FALLBACK_LABEL)].length
}

/** The widened class: any `label` read with an unquoted `??` fallback. */
function wireLabelFallbacksIn(src: string, file: string): number {
  return [...stripComments(src, file).matchAll(ID_FALLBACK_LABEL_WIRE)].length
}

const INSPECTOR_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

function sourceFilesIn(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') out.push(...sourceFilesIn(full))
      continue
    }
    if (!/\.tsx?$/.test(entry.name)) continue
    if (/\.(spec|test|stories)\.tsx?$/.test(entry.name)) continue
    out.push(full)
  }
  return out
}

describe('B4 · no inspector-v2 source falls back to an id for a display label', () => {
  const files = sourceFilesIn(INSPECTOR_DIR)

  it('POSITIVE CONTROL: the sweep reaches the panels it claims to cover', () => {
    // A magnitude check, not a bare non-zero: a walker returning three files
    // would also "find nothing" below, and that clean result would be an
    // instrument failure rather than a fact.
    const names = files.map(f => basename(f))
    expect(files.length).toBeGreaterThan(40)
    for (const required of [
      'GoalPanel.tsx', 'OptionPanel.tsx', 'DecisionPanel.tsx', 'EdgePanel.tsx',
      'OutcomePanel.tsx', 'RiskPanel.tsx', 'GenericNodePanel.tsx',
      'FactorControllablePanel.tsx', 'FactorObservablePanel.tsx', 'FactorExternalPanel.tsx',
      'InspectorRouter.tsx',
    ]) {
      expect(names).toContain(required)
    }
  })

  it('POSITIVE CONTROL: the matcher detects the real defect form, through the same pipeline', () => {
    expect(idFallbacksIn('const l = String(n.data?.label ?? n.id)', 'x.tsx')).toBe(1)
    expect(idFallbacksIn('label: String(other.data?.label ?? otherId),', 'x.tsx')).toBe(1)
    expect(idFallbacksIn('label: String(src?.data?.label ?? e.source),', 'x.tsx')).toBe(1)
  })

  it('CONTRAST CONTROL: the matcher does NOT flag a sanctioned quoted fallback', () => {
    // Without this, a matcher that flagged everything would pass the claim
    // below by making it unsatisfiable, and a matcher that flagged nothing
    // would pass it by testing nothing. Both are excluded only by having the
    // two controls point in opposite directions.
    expect(idFallbacksIn("const l = String(n.data?.label ?? 'Untitled')", 'x.tsx')).toBe(0)
    expect(idFallbacksIn("labelContext={{ label: String(node.data?.label ?? '') }}", 'x.tsx')).toBe(0)
  })

  it('CONTRAST CONTROL: the defect form inside a COMMENT is not counted', () => {
    expect(idFallbacksIn('// String(n.data?.label ?? n.id)\nconst x = 1', 'x.tsx')).toBe(0)
  })

  it('no panel, editor or shared component resolves a label to an id', () => {
    const offenders: string[] = []
    for (const file of files) {
      const n = idFallbacksIn(readFileSync(file, 'utf8'), file)
      if (n > 0) offenders.push(`${basename(file)}: ${n}`)
    }
    expect(offenders).toEqual([])
  })
})

describe('B4 · the WIDENED class — a WIRE object’s label falls back to no id either', () => {
  const files = sourceFilesIn(INSPECTOR_DIR)

  it('POSITIVE CONTROL: the widened matcher detects BOTH live shapes it was written for', () => {
    // The two exact expressions that stood in this directory while the narrow
    // matcher above reported no offenders. Through the same pipeline the claim
    // below uses, so a transform change cannot hollow this out.
    expect(
      wireLabelFallbacksIn('{String(c.label ?? c.node_id ?? `#${i + 1}`)}', 'x.tsx'),
    ).toBe(1)
    expect(
      wireLabelFallbacksIn('label: String(factorData?.label ?? factorId),', 'x.tsx'),
    ).toBe(1)
  })

  it('POSITIVE CONTROL: it still detects the ORIGINAL node-data shape', () => {
    // The widening must be a SUPERSET. If it ever stops matching the shape the
    // narrow matcher was built for, the two guards have diverged and the
    // original fourteen call sites could return under a green suite.
    expect(wireLabelFallbacksIn('const l = String(n.data?.label ?? n.id)', 'x.tsx')).toBe(1)
  })

  it('⭐ REGRESSION CONTROL: the NARROW matcher provably could NOT see the wire shape', () => {
    // Pins WHY the widening was needed, as a fact about the instrument rather
    // than a claim in a comment — so nobody "simplifies" the two matchers back
    // into one by keeping the narrow one and silently restores the blind spot.
    const live = '{String(c.label ?? c.node_id ?? `#${i + 1}`)}'
    expect(idFallbacksIn(live, 'x.tsx')).toBe(0)
    expect(wireLabelFallbacksIn(live, 'x.tsx')).toBe(1)
  })

  it('CONTRAST CONTROL: sanctioned quoted fallbacks are still clean', () => {
    // Without this the widened matcher could pass the claim below by flagging
    // everything, and it would be narrowed back to uselessness by the first
    // lane it inconvenienced.
    expect(wireLabelFallbacksIn("const l = String(c.label ?? 'Constraint')", 'x.tsx')).toBe(0)
    expect(wireLabelFallbacksIn("const l = String(c.label ?? '')", 'x.tsx')).toBe(0)
    expect(wireLabelFallbacksIn('const l = c.label ?? `fallback`', 'x.tsx')).toBe(0)
  })

  it('CONTRAST CONTROL: the honest formatter call is clean', () => {
    // The shape this commit ships. A guard that reddened the correct fix would
    // be deleted by the next lane, so the fix is pinned as acceptable here.
    expect(wireLabelFallbacksIn('{goalConstraintText(c, nodes)}', 'x.tsx')).toBe(0)
    expect(
      wireLabelFallbacksIn('const key = c.constraint_id ?? c.id ?? i', 'x.tsx'),
    ).toBe(0)
  })

  it('CONTRAST CONTROL: the defect form inside a COMMENT is not counted', () => {
    // This file's own header quotes both live expressions, and so does
    // `GoalAdvancedEditor`'s. A scan matching its own documentation would
    // report leaks that do not exist.
    expect(wireLabelFallbacksIn('// String(c.label ?? c.node_id)\nconst x = 1', 'x.tsx')).toBe(0)
  })

  it('the GOAL editor — the site this commit fixes — is at ZERO', () => {
    // Named explicitly rather than left to the aggregate below: this is the
    // assertion that the raw-id fallback is GONE, not merely unreached by the
    // render tests in `GoalAdvancedEditor.constraintsRead.spec.tsx`. A refactor
    // that reinstated `?? c.node_id` would pass every render test that does not
    // happen to use an unresolvable target.
    const goalEditor = files.find(f => basename(f) === 'GoalAdvancedEditor.tsx')
    expect(goalEditor).toBeDefined()
    expect(wireLabelFallbacksIn(readFileSync(goalEditor!, 'utf8'), goalEditor!)).toBe(0)
  })

  it('the residual matches the pinned set EXACTLY — growth is a leak, shrinkage is the follow-up', () => {
    const found: Record<string, number> = {}
    for (const file of files) {
      const n = wireLabelFallbacksIn(readFileSync(file, 'utf8'), file)
      if (n > 0) found[basename(file)] = n
    }
    expect(found).toEqual(WIRE_LABEL_PINNED)
  })

  it('CONTRAST CONTROL: the scan reads real files, and it discriminates', () => {
    // A magnitude check against a known non-zero, so the ZERO asserted for the
    // goal editor cannot be the output of a scan that silently read nothing.
    // The pinned offender must read non-zero through the SAME helper.
    expect(files.length).toBeGreaterThan(40)
    const pinned = files.find(f => basename(f) === 'OptionAdvancedEditor.tsx')
    expect(pinned).toBeDefined()
    expect(wireLabelFallbacksIn(readFileSync(pinned!, 'utf8'), pinned!)).toBe(1)
  })
})
