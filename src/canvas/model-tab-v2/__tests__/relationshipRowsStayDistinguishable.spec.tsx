/**
 * A relationship row keeps BOTH of its endpoints on screen at every width.
 *
 * ── THE WITNESSED DEFECT (Paul, deployed `a9c2e050`, 5 Sep 2026) ────────────
 * Three consecutive rows in the Relationships group were VISUALLY IDENTICAL —
 * every one reading `Tech Lead Hired...`. They were three different edges out
 * of one source node, and the only thing that told them apart was the TARGET,
 * which is at the far end of a `From → To` label rendered in a single
 * tail-truncating element. Tail truncation deletes the distinguishing half
 * first.
 *
 * ── WHY THE `title` FIX WAS NOT A FIX, AND IS NOT WHAT THIS PINS ───────────
 * I shipped `title={row.label}` so the lost half was at least reachable. That
 * was worth doing and is not an answer: a hover tooltip is unreachable by touch
 * and by keyboard, and a reader should not have to interrogate three identical
 * rows one at a time to learn which is which. The row must be legible at rest.
 *
 * ── THE PROPERTY, STATED AGAINST THE INFORMATION AND NOT AGAINST THE PIXELS ─
 * For a DIRECTED relationship, both endpoints are identity; neither is
 * optional. So the two halves each get their own share of the identity column
 * and each truncates independently — at any width the row reads `A… → B…`
 * rather than `A…`. jsdom performs no layout, so this asserts the STRUCTURE
 * that makes the property hold (two independently-shrinkable, independently-
 * truncating halves) rather than a measured width, and says so.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import type { ModelRow } from '../types'
import type { Edge, Node } from '@xyflow/react'
import type { EdgeData } from '../../domain/edges'
import { relationshipIdentity, toModelRows, RELATIONSHIP_LABEL_SEPARATOR } from '../adapters'
import type { ModelProjectionInput } from '../types'

const LABELS = new Map([
  ['n1', 'Tech Lead Hired'],
  ['n2', 'Delivery Throughput'],
  ['n3', 'Team Coordination Overhead'],
])

describe('a relationship row carries both endpoints as structure', () => {
  it('CONTROL: the joined label is unchanged — this is not a copy change', () => {
    // Proves the probe reaches the real builder and that the visible sentence a
    // reader already knows is untouched. Without it, every assertion below
    // could pass against a function that had stopped producing a label at all.
    expect(relationshipIdentity(undefined, 'n1', 'n2', LABELS).label).toBe(
      `Tech Lead Hired${RELATIONSHIP_LABEL_SEPARATOR}Delivery Throughput`,
    )
  })

  it('THE WIRING: a real relationship row carries the pair', () => {
    // ⚠ The helper tests above cannot see a row that never asks for the pair.
    // Measured, not assumed: this is the assertion that REDs if the adapter
    // stops setting `labelEndpoints`, and the four above all stay green.
    const nodes: Node[] = [
      { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Tech Lead Hired' } },
      { id: 'n2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Delivery Throughput' } },
    ]
    const edges: Edge<EdgeData>[] = [
      { id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.6 } as EdgeData },
    ]
    const rows = toModelRows({ nodes, edges, goalThreshold: null } as ModelProjectionInput)
    const rel = rows.find((r) => r.id === 'e1')
    expect(rel, 'the fixture must produce a relationship row').toBeTruthy()
    expect(rel!.labelEndpoints).toEqual(['Tech Lead Hired', 'Delivery Throughput'])
  })

  it('an endpoint pair is exposed as two parts, not one string', () => {
    const id = relationshipIdentity(undefined, 'n1', 'n2', LABELS)
    expect(id.endpoints, 'the renderer cannot allot space to a half it cannot see').toEqual([
      'Tech Lead Hired',
      'Delivery Throughput',
    ])
    expect(id.label).toBe(`Tech Lead Hired${RELATIONSHIP_LABEL_SEPARATOR}Delivery Throughput`)
  })

  it("DISCRIMINATOR: an edge's OWN label is one thing and is NOT split", () => {
    // The load-bearing case. `honestLabel(data.label)` returns an author's own
    // sentence, which has no endpoints — splitting it on an arrow it happens to
    // contain would invent a structure the author did not write. This is the
    // branch a naive `label.split(' → ')` implementation gets wrong, so it is
    // asserted rather than left to the reading.
    const id = relationshipIdentity({ label: 'Hiring → faster only if onboarding holds' }, 'n1', 'n2', LABELS)
    expect(id.label).toBe('Hiring → faster only if onboarding holds')
    expect(id.endpoints, 'an own-label edge has no endpoint pair to allot').toBeUndefined()
  })

  it('three edges out of ONE source differ in their second part', () => {
    // The witnessed defect, as a property: what tells these rows apart must not
    // live in the half a tail truncation removes first.
    const a = relationshipIdentity(undefined, 'n1', 'n2', LABELS)
    const b = relationshipIdentity(undefined, 'n1', 'n3', LABELS)
    expect(a.endpoints![0]).toBe(b.endpoints![0])
    expect(a.endpoints![1], 'the distinguishing half must be separately addressable').not.toBe(
      b.endpoints![1],
    )
  })

  // ══════════════════════════════════════════════════════════════════════════
  // THE RENDER. The assertions above prove the DATA carries both halves; they
  // cannot see a renderer that joins them straight back into one truncating
  // element, which is what shipped. jsdom performs no layout, so this pins the
  // STRUCTURE that makes the property hold — two independently shrinkable,
  // independently truncating halves — and says so rather than pretending to
  // measure pixels.
  // ══════════════════════════════════════════════════════════════════════════

  const REL: ModelRow = {
    id: 'e1',
    kind: 'relationship',
    group: 'relationships',
    label: 'Tech Lead Hired → Delivery Throughput',
    labelEndpoints: ['Tech Lead Hired', 'Delivery Throughput'],
    primaryValue: 'Moderate positive effect',
    attention: [],
    editable: false,
  }

  const renderRow = (over: Partial<ModelRow> = {}) => {
    cleanup()
    render(
      <ul>
        <ModelRowView row={{ ...REL, ...over }} onSelect={vi.fn()} onFocusOnCanvas={vi.fn()} />
      </ul>,
    )
    return screen.getByTestId('model-row-v2-e1-label')
  }

  it('THE RENDER: each endpoint truncates on its own', () => {
    const button = renderRow()
    const halves = Array.from(button.querySelectorAll('span')).filter((el) =>
      /(^|\s)truncate(\s|$)/.test(el.className),
    )
    expect(
      halves.map((el) => el.textContent),
      'both endpoints must be separately shrinkable, or the tail is eaten first',
    ).toEqual(['Tech Lead Hired', 'Delivery Throughput'])
    for (const half of halves) {
      expect(half.className, 'a half that cannot shrink cannot share the column').toMatch(
        /min-w-0/,
      )
      expect(half.className).toMatch(/flex-1/)
    }
  })

  it('the full identity is still one readable string', () => {
    // The visible sentence a reader knows, and the hover fallback, are both
    // unchanged — this is a layout change, not a copy change.
    const button = renderRow()
    expect(button).toHaveTextContent('Tech Lead Hired → Delivery Throughput')
    expect(button).toHaveAttribute('title', 'Tech Lead Hired → Delivery Throughput')
  })

  it("DISCRIMINATOR: a row with NO endpoint pair keeps the plain single truncate", () => {
    // The load-bearing render case. An authored edge label, a factor, a goal —
    // none has endpoints, and giving them a two-half layout would split text on
    // an arrow nobody wrote. Measured by the class the button itself carries.
    const button = renderRow({
      labelEndpoints: undefined,
      label: 'Hiring → faster only if onboarding holds',
    })
    expect(button.className, 'a single label must keep its own truncate').toMatch(
      /(^|\s)truncate(\s|$)/,
    )
    expect(
      Array.from(button.querySelectorAll('span')).filter((el) =>
        /(^|\s)truncate(\s|$)/.test(el.className),
      ),
      'nothing may be split when there is no pair',
    ).toEqual([])
  })
})
