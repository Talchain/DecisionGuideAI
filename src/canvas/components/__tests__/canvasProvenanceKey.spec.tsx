/**
 * THE CANVAS KEY (DL #85 5939855664 queue; PTL 5941434564 §6): existing provenance/uncertainty cues only.
 *
 * Rows, each bound to the cue's OWN function and words (a fixture first proves the real predicate fires on it, so no
 * row can pass on a fixture that draws nothing):
 *   P1  card marks: one entry per (claim, kind) the board's cards resolve to (`resolveProvenanceMarks`), in the mark's
 *       own words (`provenanceClaimLabel`); the board default (`provenanceDefaultKind`) is first and says "Unmarked
 *       cards".
 *   P2  link cues: a placeholder-strength link (`isStrengthPlaceholder`) → `EDGE_STRENGTH_PLACEHOLDER_SENTENCE`; a
 *       doubted link (`resolveExistenceDash` stated with a dash) → `EDGE_EXISTENCE_DOUBT_SENTENCE` with THAT dash.
 *   P3  CONTRAST: a cue the board does not draw has no entry; a board with no cue at all → no key (nothing rendered).
 *   P4  the key opens and closes (toggle, Escape) and renders exactly the derived entries.
 *   P5  band order: the key sits AFTER `degraded-banner` in `bottom-right` (a run warning outranks it).
 *   P7  values: a factor carrying a value lists its source word in the card's own token + label (`factorValueSourceMark`,
 *       `VALUE_SOURCE_MARK_TOKEN/LABEL`: "est." = Olumi estimate); CONTRAST: a factor with no value → no value entry.
 *   P6  options: while the Run withheld shares, the option card's `NOT_RANKED_MARKER` with the gate's own reason;
 *       CONTRAST: shares not withheld → no option entry.
 *   P8  OLUMI'S ADDITIONS ARE ALWAYS MARKED (principle audit, DL 0df0e1 #87 5992243567): on a board whose most common
 *       mark is Olumi's (`NODES`, a fresh draft's shape) there is no default, so an Olumi card keeps its mark at rest
 *       and the key flags nothing "Unmarked"; CONTROL: on a board whose most common mark is the person's own
 *       (`USER_NODES`), that mark still goes quiet at rest while an Olumi card on the same board keeps its own.
 *
 * ⚠ RE-PINNED 5 Oct (gate 5, PR-2): the P1/P4 default rows and the positive control used `NODES`, whose default was
 * Olumi's `ai`. The DL's principle-audit ruling makes an Olumi kind never a default, so those rows now read
 * `USER_NODES` (a person's mark is the default) and `NODES` moved to P8, where it pins the new rule.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { provenanceKey } from '../provenanceKey'
import { CanvasProvenanceKey, CANVAS_PROVENANCE_KEY_COPY, CANVAS_PROVENANCE_KEY_TESTID } from '../CanvasProvenanceKey'
import { OVERLAY_PRIORITY } from '../CanvasOverlayBand'
import { NodeProvenanceMark, provenanceDefaultKind, resolveProvenanceMarks } from '../../nodes/shared/NodeProvenanceMark'
import { provenanceClaimLabel } from '../../domain/nodeProvenanceClaim'
import { resolveNodeTypeLiteral } from '../../domain/nodes'
import { isStrengthPlaceholder } from '../../domain/strengthPlaceholder'
import { resolveEdgeValueDisplay } from '../../domain/edgeValueProvenance'
import { resolveExistenceDash } from '../../utils/graphDisplayCalculations'
import { EDGE_EXISTENCE_DOUBT_SENTENCE, EDGE_STRENGTH_PLACEHOLDER_SENTENCE } from '../../edges/connectorCopy'
import { NOT_RANKED_MARKER } from '../../state/winShareGate'
import { factorValueSourceMark, VALUE_SOURCE_MARK_LABEL, VALUE_SOURCE_MARK_TOKEN } from '../../nodes/shared/valueSourceMark'

const T = CANVAS_PROVENANCE_KEY_TESTID

// Shapes from the estate's own specs (lockedNodeCardDesign, strengthPlaceholder, LinkHoverCard).
const NODES = [
  { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { type: 'goal', label: 'Grow net revenue', provenance: 'from_brief' } },
  { id: 'opt-a', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Keep', provenance: 'ai_inferred' } },
  { id: 'opt-b', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Raise', provenance: 'ai_inferred' } },
  { id: 'risk-1', type: 'risk', position: { x: 0, y: 0 }, data: { type: 'risk', label: 'Churn spike', provenance: 'ai_inferred' } },
  { id: 'risk-2', type: 'risk', position: { x: 0, y: 0 }, data: { type: 'risk', label: 'Competitor', provenance: 'user_set' } },
]
/** A board whose most common card mark is the PERSON's own (`user_set` → `human`), beside one Olumi card. */
const USER_NODES = [
  { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { type: 'goal', label: 'Grow net revenue', provenance: 'from_brief' } },
  { id: 'opt-a', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Keep', provenance: 'ai_inferred' } },
  { id: 'opt-b', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Raise', provenance: 'user_set' } },
  { id: 'risk-1', type: 'risk', position: { x: 0, y: 0 }, data: { type: 'risk', label: 'Churn spike', provenance: 'user_set' } },
  { id: 'risk-2', type: 'risk', position: { x: 0, y: 0 }, data: { type: 'risk', label: 'Competitor', provenance: 'user_set' } },
]
const PLACEHOLDER_EDGE = { id: 'e-ph', source: 'opt-a', target: 'goal-1', data: { weight: 0.5, weightSource: 'cee', strengthPlaceholder: 0.5, direction: 'positive', directionSource: 'cee' } }
const DOUBT_EDGE = { id: 'e-doubt', source: 'risk-1', target: 'goal-1', data: { weight: 0.35, weightSource: 'cee', direction: 'positive', directionSource: 'user', beliefExists: 0.5, beliefExistsSource: 'user' } }
const PLAIN_EDGE = { id: 'e-plain', source: 'opt-b', target: 'goal-1', data: { weight: 0.35, weightSource: 'user', direction: 'positive', directionSource: 'user' } }

const doubtDash = (e: typeof DOUBT_EDGE) => {
  const d = resolveExistenceDash(resolveEdgeValueDisplay(e.data as Record<string, unknown>, 'beliefExists'))
  return d.kind === 'stated' ? d.dash : undefined
}

afterEach(() => { cleanup() })

describe('fixtures fire the real predicates (positive controls)', () => {
  it('the placeholder link is a placeholder, the doubted link has a dash, the plain link has neither', () => {
    expect(isStrengthPlaceholder(PLACEHOLDER_EDGE.data)).toBe(true)
    expect(doubtDash(DOUBT_EDGE)).toBeTruthy()
    expect(isStrengthPlaceholder(PLAIN_EDGE.data)).toBe(false)
    expect(doubtDash(PLAIN_EDGE as never)).toBeUndefined()
  })
  it('the cards resolve to marks; NODES is Olumi-majority, USER_NODES is the person\'s, with a board default', () => {
    const kinds = (ns: typeof NODES) => ns.flatMap((n) => resolveProvenanceMarks(resolveNodeTypeLiteral(n)!, n.data)).map((m) => m.kind)
    expect(kinds(NODES).filter((k) => k === 'ai').length).toBe(3)
    expect(kinds(USER_NODES).filter((k) => k === 'human').length).toBe(3)
    expect(kinds(USER_NODES)).toContain('ai')
    expect(provenanceDefaultKind(USER_NODES)).toBe('human')
  })
})

describe('P1 · card marks, in the mark\'s own words', () => {
  it('one entry per (claim, kind) on the board; the default first, flagged', () => {
    const key = provenanceKey(USER_NODES, [])
    const expected = new Map<string, string>()
    for (const n of USER_NODES) for (const m of resolveProvenanceMarks(resolveNodeTypeLiteral(n)!, n.data)) expected.set(`${m.claim}|${m.kind}`, provenanceClaimLabel(m.claim, m.kind))
    expect(new Map(key.marks.map((m) => [`${m.claim}|${m.kind}`, m.label]))).toEqual(expected)
    const def = provenanceDefaultKind(USER_NODES)
    expect(key.marks[0].kind).toBe(def)
    expect(key.marks[0].isDefault).toBe(true)
    expect(key.marks.filter((m) => m.isDefault).every((m) => m.kind === def)).toBe(true)
  })
})

describe('P2 · link cues, in the cue\'s own sentence and stroke', () => {
  it('placeholder → its sentence; doubt → its sentence with the SAME dash the link is drawn with', () => {
    const key = provenanceKey(NODES, [PLACEHOLDER_EDGE, DOUBT_EDGE, PLAIN_EDGE])
    expect(key.links).toEqual([
      { cue: 'placeholder', label: EDGE_STRENGTH_PLACEHOLDER_SENTENCE },
      { cue: 'doubt', label: EDGE_EXISTENCE_DOUBT_SENTENCE, dash: doubtDash(DOUBT_EDGE) },
    ])
  })
})

describe('P3 · CONTRAST: no cue, no entry', () => {
  it('plain links only → no link entries', () => {
    expect(provenanceKey(NODES, [PLAIN_EDGE]).links).toEqual([])
  })
  it('no marks and no link cues → empty, and the key renders nothing', () => {
    const bare = [{ id: 'o', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Keep' } }]
    const key = provenanceKey(bare, [PLAIN_EDGE])
    expect(key.marks).toEqual([])
    expect(key.empty).toBe(true)
    useCanvasStore.setState({ nodes: bare, edges: [PLAIN_EDGE] } as never)
    const { container } = render(<CanvasProvenanceKey />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId(T)).toBeNull()
  })
})

describe('P4 · the key opens, shows the derived entries, and closes', () => {
  it('toggle → entries; Escape → closed', () => {
    useCanvasStore.setState({ nodes: USER_NODES, edges: [PLACEHOLDER_EDGE, DOUBT_EDGE, PLAIN_EDGE] } as never)
    render(<CanvasProvenanceKey />)
    const toggle = screen.getByTestId(`${T}-toggle`)
    expect(toggle).toHaveTextContent(CANVAS_PROVENANCE_KEY_COPY.toggle)
    expect(screen.queryByTestId(`${T}-panel`)).toBeNull()
    fireEvent.click(toggle)
    const derived = provenanceKey(USER_NODES, [PLACEHOLDER_EDGE, DOUBT_EDGE, PLAIN_EDGE])
    expect(screen.getAllByTestId(`${T}-mark`).map((li) => li.getAttribute('data-provenance-kind'))).toEqual(derived.marks.map((m) => m.kind))
    expect(screen.getAllByTestId(`${T}-link`).map((li) => li.textContent)).toEqual(derived.links.map((l) => l.label))
    expect(screen.getAllByTestId(`${T}-mark`)[0]).toHaveTextContent(CANVAS_PROVENANCE_KEY_COPY.unmarked)
    fireEvent.keyDown(screen.getByTestId(T), { key: 'Escape' })
    expect(screen.queryByTestId(`${T}-panel`)).toBeNull()
  })
})

describe('P5 · band order', () => {
  it('bottom-right: degraded-banner, THEN the key', () => {
    expect(OVERLAY_PRIORITY['bottom-right']).toEqual(['degraded-banner', T])
  })
})

describe('P6 · the withheld-share marker, with the gate\'s own reason', () => {
  it('withheld → the marker + the reason verbatim; not withheld → no option entry', () => {
    const reason = 'The comparison does not yet separate the options reliably.'
    expect(provenanceKey(NODES, [], reason).options).toEqual({ label: NOT_RANKED_MARKER, reason })
    expect(provenanceKey(NODES, [], null).options).toBeNull()
  })
})

describe('P7 · value source words, in the card\'s own token and meaning', () => {
  const EST = { id: 'fac-conv', type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Trial conversion', category: 'controllable', observedState: { value: 0.08, unit: '%', extractionType: 'inferred', source: 'cee_inference' } } }
  const NO_VALUE = { id: 'fac-x', type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Market growth', category: 'external' } }
  it('positive control: the card\'s own function marks the inferred value', () => {
    expect(factorValueSourceMark(EST.data)?.kind).toBe('olumi')
  })
  it('an Olumi-estimated value → "est." with its meaning; a factor with no value → no value entry', () => {
    expect(provenanceKey([EST], []).values).toEqual([{ kind: 'olumi', token: VALUE_SOURCE_MARK_TOKEN.olumi, label: VALUE_SOURCE_MARK_LABEL.olumi }])
    expect(VALUE_SOURCE_MARK_TOKEN.olumi).toBe('est.')
    expect(provenanceKey([NO_VALUE], []).values).toEqual([])
  })
})

describe('P8 · Olumi\'s additions are always marked, including at rest', () => {
  const markAtRest = (nodes: typeof NODES, id: string) => {
    const n = nodes.find((x) => x.id === id)!
    const { container } = render(<NodeProvenanceMark nodeType={resolveNodeTypeLiteral(n)!} data={n.data} hideKind={provenanceDefaultKind(nodes)} />)
    const marks = Array.from(container.querySelectorAll('[data-testid="node-provenance-mark"]')).map((el) => el.getAttribute('data-provenance-kind'))
    cleanup()
    return marks
  }
  it('an Olumi-majority board has NO default: every Olumi card keeps its mark at rest, and nothing is "Unmarked"', () => {
    expect(provenanceDefaultKind(NODES)).toBeNull()
    for (const id of ['opt-a', 'opt-b', 'risk-1']) expect(markAtRest(NODES, id)).toEqual(['ai'])
    expect(provenanceKey(NODES, []).marks.some((m) => m.isDefault)).toBe(false)
  })
  it('a board of Olumi cards only has no default either', () => {
    expect(provenanceDefaultKind(NODES.filter((n) => n.data.provenance === 'ai_inferred'))).toBeNull()
  })
  it('CONTROL: the person\'s own majority mark still goes quiet at rest; an Olumi card on that board keeps its mark', () => {
    expect(markAtRest(USER_NODES, 'risk-1')).toEqual([])
    expect(markAtRest(USER_NODES, 'opt-a')).toEqual(['ai'])
  })
})
