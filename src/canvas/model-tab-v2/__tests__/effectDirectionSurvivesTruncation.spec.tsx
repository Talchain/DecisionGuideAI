/**
 * A relationship's DIRECTION survives at every width.
 *
 * ── THE WITNESSED DEFECT (deployed `d0f4628b`, 7 Sep 2026) ─────────────────
 * Guest board, Model tab, Relationships group, dock 414px. ELEVEN of eleven
 * rows rendered their effect value as the byte-identical string `Moderat…` —
 * six "Moderate negative effect" and five "Moderate positive effect". Whether a
 * factor HELPS or HURTS was unreadable on every relationship in the model, and
 * no `title` existed anywhere on the row to recover it by hover.
 *
 * Measured with real layout (a probe span at the element's own computed font,
 * binary-searching the longest prefix that fits), with two controls: an element
 * whose width equals its scrollWidth came back whole, and a known-clipped label
 * came back clipped. An earlier canvas-metrics estimate of the same thing was
 * WRONG — it claimed "Moderate n…", i.e. that direction survived — and was
 * caught only because its control could not reproduce a string that provably
 * fits. The alarming reading was the wrong one AND the reassuring one was the
 * wrong one; only the controlled measurement settled it.
 *
 * ── THIS IS THE SAME DEFECT CLASS AS `relationshipRowsStayDistinguishable` ──
 * That spec pins the LABEL column, after three rows shipped visually identical:
 * "tail truncation deletes the distinguishing half first". This is that
 * property on the VALUE column, where the distinguishing half is the direction
 * word. The two answer different questions and neither subsumes the other.
 *
 * ── THE PROPERTY, STATED AGAINST THE INFORMATION, NOT THE PIXELS ───────────
 * jsdom performs no layout, so this asserts the STRUCTURE that makes the
 * property hold — the direction is carried by an element that CANNOT shrink,
 * while the phrase beside it still can — rather than a measured width. The
 * width was measured on the deployed build; that evidence is above.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import type { ModelRow } from '../types'
import { RECOGNISED_EFFECT_LABELS, splitEffectLabel } from '../effectDirection'
import { getDirectionalStrengthLabel } from '../../components/model-tab/strengthBands'

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
      <ModelRowView tier="plain" row={{ ...REL, ...over }} onSelect={vi.fn()} onFocusOnCanvas={vi.fn()} />
    </ul>,
  )
  return screen.getByTestId('model-row-v2-e1-value')
}

/** Text inside elements that can NEVER be truncated away. */
const unshrinkableText = (cell: HTMLElement): string =>
  Array.from(cell.querySelectorAll('span'))
    .filter((el) => /(^|\s)shrink-0(\s|$)/.test(el.className))
    .map((el) => el.textContent ?? '')
    .join('')

describe('a stated effect direction cannot be truncated away', () => {
  it('CONTROL: the derived table is non-empty and covers BOTH directions', () => {
    // Without this the whole fix could be silently inert: an empty table makes
    // `splitEffectLabel` return null for everything, every assertion below that
    // renders a plain row still passes, and the defect ships unchanged. An
    // absence probe needs a positive control (CLAUDE.md trap 13).
    expect(RECOGNISED_EFFECT_LABELS.length, 'an empty table makes this fix invisible').toBeGreaterThan(0)
    const dirs = new Set(RECOGNISED_EFFECT_LABELS.map((l) => splitEffectLabel(l)?.direction))
    expect(dirs, 'one direction alone cannot demonstrate the pair is told apart').toEqual(
      new Set(['positive', 'negative']),
    )
  })

  it('CONTROL: the producer still emits the phrase this parses — derived, not pasted', () => {
    // Binds the parser to the REAL producer. If `getDirectionalStrengthLabel`
    // rewords, this fails here rather than the parser silently matching nothing
    // and every row quietly reverting to the defect (trap 12: the estate's
    // dominant defect is the hand-maintained mirror).
    const positive = getDirectionalStrengthLabel(0.4, { show: true, direction: 'positive', source: 'cee' })
    expect(RECOGNISED_EFFECT_LABELS).toContain(positive)
    const split = splitEffectLabel(positive)
    expect(split).not.toBeNull()
    // Reconstruction: nothing is invented and nothing but the direction word moves.
    expect(split!.remainder.replace('effect', `${split!.direction} effect`)).toBe(positive)
  })

  it('⭐ THE PROPERTY: positive and negative differ in text that CANNOT shrink', () => {
    // THE defect, stated exactly: on the deployed build these two rendered the
    // same eight characters. Whatever tells them apart must live somewhere
    // truncation cannot reach.
    const pos = unshrinkableText(renderRow({ primaryValue: 'Moderate positive effect' }))
    const neg = unshrinkableText(renderRow({ primaryValue: 'Moderate negative effect' }))
    expect(pos, 'a direction carried only by shrinkable text is a direction that can vanish').not.toBe('')
    expect(neg).not.toBe('')
    expect(neg, 'the two directions must be distinguishable without reading a truncatable phrase').not.toBe(pos)
  })

  it('the phrase beside the mark still shrinks — the label keeps its width', () => {
    // The 6 Sep trade is NOT reversed: the identity track is the only flexible
    // one, so an immovable value cell is paid for out of the row's label. This
    // fix moves the direction OUT of the shrinking text; it must not make the
    // text stop shrinking.
    const cell = renderRow({ primaryValue: 'Moderate negative effect' })
    const shrinkable = Array.from(cell.querySelectorAll('span')).filter((el) =>
      /(^|\s)truncate(\s|$)/.test(el.className),
    )
    expect(shrinkable.length, 'the phrase must still be able to give up width').toBeGreaterThan(0)
    for (const el of shrinkable) expect(el.className).toMatch(/min-w-0/)
  })

  it('nothing is LOST: the full producer sentence is still present for assistive tech and on hover', () => {
    const cell = renderRow({ primaryValue: 'Moderate negative effect' })
    expect(cell.textContent, 'the reader must not lose the producer\'s own words').toContain(
      'Moderate negative effect',
    )
    expect(
      cell.querySelector('[title="Moderate negative effect"]'),
      'the hover fallback the deployed row did not have',
    ).not.toBeNull()
  })

  it('DISCRIMINATOR: a value with NO stated direction gets NO mark', () => {
    // The producer distinguishes "we measured a size but nobody stated a
    // direction" from a stated one, deliberately. Marking that with an arrow
    // would invent precisely the claim the string exists to withhold — which
    // would be a worse defect than the one being fixed, so it is asserted here
    // and not left to inspection.
    const undirected = getDirectionalStrengthLabel(0.4, { show: false, reason: 'unknown' })
    expect(splitEffectLabel(undirected), 'an unstated direction must not acquire one').toBeNull()
    expect(unshrinkableText(renderRow({ primaryValue: undirected })), 'no mark may appear').toBe('')

    expect(splitEffectLabel('Negligible effect'), 'a negligible effect has no direction to carry').toBeNull()
    expect(unshrinkableText(renderRow({ primaryValue: 'Negligible effect' }))).toBe('')
  })

  it('DISCRIMINATOR: a plain measurement is untouched', () => {
    // A number keeps today's behaviour exactly. This is the branch a broad
    // "put a mark on every value" implementation gets wrong.
    expect(splitEffectLabel('45 days')).toBeNull()
    expect(unshrinkableText(renderRow({ primaryValue: '45 days' }))).toBe('')
    expect(renderRow({ primaryValue: '45 days' }).textContent).toContain('45 days')
  })
})
