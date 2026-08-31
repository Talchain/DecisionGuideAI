/**
 * Thin-structure doors — the door on the option nobody argued against.
 *
 * ⚠ THE ASYMMETRY GATE IS THE WHOLE DESIGN, so most of this file is about when
 * the door must NOT appear. An affordance that fires everywhere is furniture,
 * and furniture is how a good invitation becomes something the eye stops
 * seeing. These tests are the argument that it cannot.
 */
import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import {
  optionsWithoutRisk,
  withThinStructureDoors,
  THIN_STRUCTURE_DOOR_PREFIX,
} from '../thinStructureDoors'
import { isGhostNode } from '../fitTargets'

const n = (id: string, type: string, label = id): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data: { label, type } }) as Node
const e = (id: string, source: string, target: string): Edge =>
  ({ id, source, target }) as Edge

const OPT_A = n('a', 'option', 'Segment')
const OPT_B = n('b', 'option', 'RudderStack')
const OPT_C = n('c', 'option', 'Stay on the current CDP')
const RISK = n('r1', 'risk', 'Budget overrun')

const doorIdsFor = (nodes: Node[], edges: Edge[]) =>
  withThinStructureDoors(nodes, edges)
    .filter(x => x.id.startsWith(THIN_STRUCTURE_DOOR_PREFIX))
    .map(x => x.id)

describe('thin-structure doors — asymmetry, not sparseness', () => {
  it('marks the ONE option with no risk when its siblings have one', () => {
    const nodes = [OPT_A, OPT_B, RISK]
    const edges = [e('e1', 'a', 'r1')]
    expect(optionsWithoutRisk(nodes, edges).map(o => o.id)).toEqual(['b'])
  })

  it('⛔ says nothing when NO option has a risk — that is a young model, not a blind spot', () => {
    // The row-level frontier door already covers "you have no risks". A door on
    // every option here would be three copies of the same furniture.
    const nodes = [OPT_A, OPT_B, OPT_C, RISK]
    expect(optionsWithoutRisk(nodes, [])).toEqual([])
  })

  it('⛔ says nothing when EVERY option has a risk — nothing to point at', () => {
    const nodes = [OPT_A, OPT_B, RISK]
    const edges = [e('e1', 'a', 'r1'), e('e2', 'b', 'r1')]
    expect(optionsWithoutRisk(nodes, edges)).toEqual([])
  })

  it('⛔ says nothing when the model has no risks at all', () => {
    expect(optionsWithoutRisk([OPT_A, OPT_B], [])).toEqual([])
  })

  it('⛔ says nothing on a single-option model — there are no siblings to be asymmetric with', () => {
    expect(optionsWithoutRisk([OPT_A, RISK], [e('e1', 'a', 'r1')])).toEqual([])
  })

  it('reads the edge in EITHER direction', () => {
    // A producer may draw option → risk ("this choice creates that danger") or
    // risk → option. Which way it chose is not something this file should have
    // an opinion about, and having one would produce a door pointing at an
    // option that HAS been argued against.
    const nodes = [OPT_A, OPT_B, RISK]
    expect(optionsWithoutRisk(nodes, [e('e1', 'r1', 'a')]).map(o => o.id)).toEqual(['b'])
  })

  it('names the option in the prompt, and states a FACT rather than a verdict', () => {
    const out = withThinStructureDoors([OPT_A, OPT_B, RISK], [e('e1', 'a', 'r1')])
    const door = out.find(x => x.id.startsWith(THIN_STRUCTURE_DOOR_PREFIX))
    const prompt = String((door?.data as { prompt?: string })?.prompt)
    expect(prompt).toContain('RudderStack')
    expect(prompt).toContain('?')
    const JUDGEMENT = /\b(shallow|under-examined|overlooked|you (have )?(not|failed)|too few|weak|incomplete|should have)\b/i
    expect(prompt, `door prompt makes an assessment: "${prompt}"`).not.toMatch(JUDGEMENT)
  })

  it('survives an unlabelled option without inventing a name for it', () => {
    const blank = { ...n('b', 'option'), data: { type: 'option', label: '  ' } } as Node
    const out = withThinStructureDoors([OPT_A, blank, RISK], [e('e1', 'a', 'r1')])
    const prompt = String(
      (out.find(x => x.id.startsWith(THIN_STRUCTURE_DOOR_PREFIX))?.data as { prompt?: string })
        ?.prompt,
    )
    expect(prompt).not.toMatch(/untitled|unnamed|undefined|null/i)
    expect(prompt).toContain('?')
  })

  it('⭐ carries the shared ghost prefix, so it can never inflate the model’s own counts', () => {
    // A door that counted as an element would be a worse defect than the gap it
    // points at — the user would be told their model contains something that
    // is an invitation to add something.
    const out = withThinStructureDoors([OPT_A, OPT_B, RISK], [e('e1', 'a', 'r1')])
    const door = out.find(x => x.id.startsWith(THIN_STRUCTURE_DOOR_PREFIX))!
    expect(isGhostNode(door.id)).toBe(true)
    expect(door.selectable).toBe(false)
    expect(door.draggable).toBe(false)
  })

  it('returns the ORIGINAL array untouched when it has nothing to add', () => {
    const nodes = [OPT_A, OPT_B]
    expect(withThinStructureDoors(nodes, [])).toBe(nodes)
  })

  it('adds one door per uncovered option, and only those', () => {
    const nodes = [OPT_A, OPT_B, OPT_C, RISK]
    expect(doorIdsFor(nodes, [e('e1', 'a', 'r1')])).toEqual([
      `${THIN_STRUCTURE_DOOR_PREFIX}b`,
      `${THIN_STRUCTURE_DOOR_PREFIX}c`,
    ])
  })

  it('sits BELOW its option, so it reads as belonging to that card', () => {
    const out = withThinStructureDoors([OPT_A, OPT_B, RISK], [e('e1', 'a', 'r1')])
    const door = out.find(x => x.id.startsWith(THIN_STRUCTURE_DOOR_PREFIX))!
    expect(door.position.x).toBe(OPT_B.position.x)
    expect(door.position.y).toBeGreaterThan(OPT_B.position.y)
  })
})
