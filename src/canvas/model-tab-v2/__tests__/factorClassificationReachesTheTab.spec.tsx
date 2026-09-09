/**
 * ⭐⭐ "CAN WE ACT ON THIS?" — A PRODUCER FACT THAT REACHED NO SCREEN ON THE
 * SURFACE BUILT FOR READING YOUR MODEL.
 *
 * CEE stamps every factor `controllable` | `observable` | `external`. It is the
 * distinction between what a team can ACT ON and what it must PLAN AROUND — the
 * pivot from analysing a model to doing something about it, and one of the very
 * few producer facts that is about the THINKING rather than about the numbers.
 *
 * ── MEASURED ON THE DEPLOYED BUILD, NOT INFERRED ───────────────────────────
 * `14276d5b`, guest, restored model, completed run, all seven outline groups
 * expanded and the state asserted before reading:
 *
 *   store: 4 factors `category: 'controllable'`, 1 `category: 'external'`
 *   DOM:   "controllable" → absent · "uncontrollable" → absent · "external" → absent
 *
 * The field DISCRIMINATES on that run — it is not a constant, and not a default
 * — and none of its words appear anywhere in the rendered document.
 *
 * ⚠ AND IT IS NOT DARK EVERYWHERE. The INSPECTOR reads and edits it
 * (`inspector-v2/editors/FactorControllableEditor`, `useInspectorMutations
 * .setCategory`). One fact, two surfaces, one of them silent — the same shape
 * as #1329, where a producer finding the Inspector could route to and the
 * Reasoning panel could not.
 *
 * ── THE HONESTY RULE THIS FILE MOSTLY EXISTS TO PIN ────────────────────────
 * The inspector editor renders `(data?.category as string) ?? 'controllable'`,
 * so a factor CEE never classified is displayed as **Controllable** — a
 * classification nobody made, on the surface that then offers to "change" it.
 * A factor created locally really does carry none (`autoFix.addFactorNode`
 * seeds no category).
 *
 * This tab does the OPPOSITE and must keep doing it: no default, no
 * "Unclassified", no dash. A reader has to be able to tell *"CEE said this is
 * external"* from *"nothing here says"*, and a guessed classification is worse
 * than a missing one because it is indistinguishable from a real one.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ModelDetailRegion } from '../ModelDetailRegion'
import { toRowDetail } from '../adapters'
import { factorCategoryLabel, FACTOR_CATEGORY_LABEL } from '../../domain/vocabulary'
import type { ModelRow } from '../types'

const factorNode = (category?: unknown) => ({
  id: 'f1',
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label: 'Data Team Capacity', ...(category === undefined ? {} : { category }) },
})

const row: ModelRow = {
  id: 'f1',
  kind: 'factor',
  group: 'factors',
  label: 'Data Team Capacity',
  primaryValue: '3',
  attention: [],
  editable: true,
}

const detailFor = (node: unknown) =>
  toRowDetail({ nodes: [node], edges: [] } as never, 'f1')

const renderFor = (node: unknown) => {
  const detail = detailFor(node)
  if (detail === null) throw new Error('projection returned null — fixture is not in the model')
  return render(<ModelDetailRegion row={row} detail={detail} tier="plain" />)
}

describe('THE VOCABULARY IS SHARED, NOT RE-TYPED', () => {
  /**
   * ⚠ The three words were already spelled once, in the inspector's
   * `CATEGORY_OPTIONS`. A second copy for this tab is exactly the
   * hand-maintained mirror `domain/vocabulary.ts` was created to abolish —
   * after a bare `'Decision'` literal had to be renamed in NINE places.
   */
  it('covers exactly the three stamps CEE emits', () => {
    expect(Object.keys(FACTOR_CATEGORY_LABEL).sort()).toEqual([
      'controllable',
      'external',
      'observable',
    ])
  })

  it('maps each stamp to its display word', () => {
    expect(factorCategoryLabel('controllable')).toBe('Controllable')
    expect(factorCategoryLabel('external')).toBe('External')
    expect(factorCategoryLabel('observable')).toBe('Observable')
  })
})

describe('⛔ IT NEVER INVENTS A CLASSIFICATION', () => {
  /**
   * ⚠ THESE ARE THE CASES THAT MATTER MOST, and they are deliberately first
   * among the render tests. Every other assertion in this file is about showing
   * something; these are about the far more expensive failure of showing
   * something that is not there.
   */
  it('an ABSENT category yields null — not "Controllable"', () => {
    expect(factorCategoryLabel(undefined)).toBeNull()
    expect(detailFor(factorNode())?.classification).toBeNull()
  })

  it('an UNRECOGNISED stamp yields null — not the raw wire value', () => {
    // A value this vocabulary does not know is a value this surface cannot
    // explain. Printing `"partially_controllable"` would put a wire token on
    // screen as user copy.
    expect(factorCategoryLabel('partially_controllable')).toBeNull()
    expect(detailFor(factorNode('partially_controllable'))?.classification).toBeNull()
  })

  it('a non-string category yields null', () => {
    expect(factorCategoryLabel(3)).toBeNull()
    expect(factorCategoryLabel(null)).toBeNull()
    expect(factorCategoryLabel({ kind: 'controllable' })).toBeNull()
  })

  it('⭐ renders NO classification element at all when nothing is stated', () => {
    renderFor(factorNode())
    expect(screen.queryByTestId('model-detail-v2-classification')).toBeNull()
    // …and the kind line still renders, so the absence is of the qualifier only.
    expect(screen.getByTestId('model-detail-v2-kind')).toBeInTheDocument()
  })

  it('⛔ says nothing that could be read as a classification', () => {
    renderFor(factorNode())
    const kind = screen.getByTestId('model-detail-v2-kind').textContent ?? ''
    for (const word of ['Controllable', 'Observable', 'External', 'Unclassified', '—']) {
      expect(kind).not.toContain(word)
    }
  })
})

describe('a classified factor says so, on the tab built for reading the model', () => {
  it('⭐ renders the producer stamp beside the kind', () => {
    renderFor(factorNode('external'))
    expect(screen.getByTestId('model-detail-v2-classification')).toHaveTextContent('External')
  })

  it('⭐ the discriminating twin: a different stamp renders differently', () => {
    // One case alone shows the element can appear; the pair shows it is bound
    // to the producer's value rather than to a constant.
    renderFor(factorNode('controllable'))
    expect(screen.getByTestId('model-detail-v2-classification')).toHaveTextContent('Controllable')
    expect(screen.getByTestId('model-detail-v2-classification')).not.toHaveTextContent('External')
  })

  it('joins the kind rather than opening a labelled row of its own', () => {
    // A classification is part of "what this is". A separate labelled field
    // would make the reader look up what the label meant.
    renderFor(factorNode('external'))
    const kind = screen.getByTestId('model-detail-v2-kind').textContent ?? ''
    expect(kind).toContain('External')
    expect(kind.length).toBeLessThan(60)
  })
})

describe('⛔ SCOPED TO FACTORS', () => {
  it('a non-factor node carrying a category is NOT classified', () => {
    // `category` is a factor stamp. An option or risk that somehow carried one
    // would be data this surface has no licence to interpret — and the canvas
    // store's own history records a writer that seeded `category: 'external'`
    // on EVERY kind it created.
    const option = {
      id: 'f1',
      type: 'option',
      position: { x: 0, y: 0 },
      data: { label: 'Build on Snowflake', category: 'external' },
    }
    expect(detailFor(option)?.classification).toBeNull()
  })

  it('a relationship is never classified — the edge branch is explicit', () => {
    const detail = toRowDetail(
      {
        nodes: [factorNode('controllable'), { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'B' } }],
        edges: [{ id: 'e1', source: 'f1', target: 'f2', data: {} }],
      } as never,
      'e1',
    )
    expect(detail).not.toBeNull()
    expect(detail?.classification).toBeNull()
  })
})
