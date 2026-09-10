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
 * "Unclassified", no dash. A reader has to be able to tell *"this model says
 * external"* from *"nothing here says"*, and a guessed classification is worse
 * than a missing one because it is indistinguishable from a real one.
 *
 * ── ⚠⚠ AND ABSENCE WAS NOT THE ONLY UNSTATED CASE ─────────────────────────
 * The first version of this file proved `factorNode()` with no `category`
 * yields `null` — true of `toRowDetail` in isolation, and NOT true of any
 * factor that has travelled the CEE adapter. `adapters/cee/client.ts`
 * `inferMissingCategories` fills an omitted `category` from edge shape on every
 * ingestion path, so the field is POPULATED for factors nobody classified, and
 * a reader checking only absence printed the UI's own guess in the model's
 * voice. Every fixture here was hand-built and fed straight to `toRowDetail`,
 * bypassing that adapter — and a fixture you wrote yourself is not evidence
 * about the wire, which is exactly why an otherwise green honesty corpus sat
 * over a live fabrication.
 *
 * The `THE REAL INGESTION PATH` block below therefore drives
 * `adaptDraftResponse` → `mapDraftNodeToCanvas` → `toRowDetail` → render, on
 * the payload shape the estate's own `adaptDraftResponse.spec.ts` uses to pin
 * the inference. It is the only block in this file whose input is not
 * self-authored, and it is the one that can see this defect class.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ModelDetailRegion } from '../ModelDetailRegion'
import { toRowDetail } from '../adapters'
import {
  factorCategoryLabel,
  statedFactorCategoryLabel,
  FACTOR_CATEGORY_LABEL,
} from '../../domain/vocabulary'
import { FactorCategoryEnum } from '../../domain/nodes'
import { adaptDraftResponse } from '../../../adapters/cee/client'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
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
  /**
   * ⚠ DERIVED FROM THE PRODUCER'S ENUM, NOT RE-TYPED. This assertion compared
   * `Object.keys(...)` against a HAND-TYPED literal array — both sides written
   * by hand, nothing binding either to the producer, which is the mirror the
   * module under test exists to abolish. It matters more than it looks:
   * `FactorControllableEditor` now DERIVES its writable options from this same
   * map, so a short map silently shortens the EDITOR's option set too. If
   * schemas gained a fourth member and CEE stamped it, the tab would show
   * nothing for those factors, the inspector could no longer select it, and a
   * hand-typed pair would stay green on both sides.
   */
  it('covers exactly the stamps the producer enum declares', () => {
    expect(Object.keys(FACTOR_CATEGORY_LABEL).sort()).toEqual(
      [...FactorCategoryEnum.options].sort(),
    )
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

describe('⛔ THE REAL INGESTION PATH — a UI guess is not the model speaking', () => {
  /**
   * ⭐⭐⭐ THE ONE BLOCK HERE WHOSE INPUT IS NOT SELF-AUTHORED.
   *
   * It drives the actual chain a drafted factor travels:
   *   CEE payload → `adaptDraftResponse` (runs `inferMissingCategories`)
   *                → `mapDraftNodeToCanvas` (spreads `...rest` into `data`)
   *                → `toRowDetail` → `ModelDetailRegion`
   *
   * The payload shape is lifted from `adapters/cee/__tests__/adaptDraftResponse
   * .spec.ts`, which pins the inference itself — so the input class comes from
   * the estate's record of what CEE does, not from this author's model of it.
   *
   * ⚠ IT IS A DISCRIMINATING TRIO, and that is the whole design. `f1` and `f2`
   * are unclassified by CEE and take the inferencer's two different guesses;
   * `f3` carries a real stamp. If the marker stopped being written, or the
   * reader stopped consulting it, `f1`/`f2` would render and this REDs. If the
   * gate were widened into a blanket suppression, `f3` would go silent and this
   * REDs on a DIFFERENT assertion. One of those alone proves nothing.
   */
  const CEE_PAYLOAD = {
    graph: {
      nodes: [
        { id: 'opt1', label: 'Option A', kind: 'option' },
        // CEE stamped NEITHER of these two. The inferencer will guess
        // `controllable` for f1 (targeted by an option edge) and `observable`
        // for f2 (not targeted).
        { id: 'f1', label: 'Price', kind: 'factor' },
        { id: 'f2', label: 'EU regulatory timetable', kind: 'factor' },
        // CEE DID stamp this one. The inferencer never emits `external`, so a
        // value here can only be the producer's.
        { id: 'f3', label: 'Commodity index', kind: 'factor', category: 'external' },
        { id: 'g1', label: 'Revenue', kind: 'goal' },
      ],
      edges: [
        { from: 'opt1', to: 'f1', weight: 0.5 },
        { from: 'f1', to: 'g1', weight: 0.8 },
        { from: 'f2', to: 'g1', weight: 0.3 },
        { from: 'f3', to: 'g1', weight: 0.2 },
      ],
    },
  }

  const ingest = () => {
    const adapted = adaptDraftResponse(CEE_PAYLOAD)
    return { nodes: adapted.nodes.map(mapDraftNodeToCanvas), edges: [] }
  }

  it('PRECONDITION: the inferencer really does populate the field on this payload', () => {
    // ⚠ PINS ITS OWN PRECONDITION. Without this, every assertion below would
    // also pass if the inferencer simply stopped running — a guard agreeing
    // with itself. The whole point is that `category` IS present and IS a
    // guess; the marker is what separates it from f3's stamp.
    const graph = ingest()
    const byId = (id: string) => graph.nodes.find((n: { id: string }) => n.id === id)
    expect(byId('f1').data.category).toBe('controllable')
    expect(byId('f2').data.category).toBe('observable')
    expect(byId('f1').data.categoryInferredByUi).toBe(true)
    expect(byId('f2').data.categoryInferredByUi).toBe(true)
    // The producer's own stamp is untouched and unmarked.
    expect(byId('f3').data.category).toBe('external')
    expect(byId('f3').data.categoryInferredByUi).toBeUndefined()
  })

  it('⭐ a factor the UI classified for itself gets NO classification on the tab', () => {
    const graph = ingest()
    expect(toRowDetail(graph as never, 'f1')?.classification).toBeNull()
    expect(toRowDetail(graph as never, 'f2')?.classification).toBeNull()
  })

  it('⭐ the discriminating twin: the factor CEE DID stamp still says so', () => {
    const graph = ingest()
    expect(toRowDetail(graph as never, 'f3')?.classification).toBe('External')
  })

  it('⭐ renders nothing for the inferred factor, and the stamp for the stated one', () => {
    const graph = ingest()

    const inferredRow: ModelRow = { ...row, id: 'f2', label: 'EU regulatory timetable' }
    const inferred = toRowDetail(graph as never, 'f2')
    if (inferred === null) throw new Error('projection returned null — fixture is not in the model')
    const first = render(<ModelDetailRegion row={inferredRow} detail={inferred} tier="plain" />)
    expect(screen.queryByTestId('model-detail-v2-classification')).toBeNull()
    // The absence is of the qualifier only — the row still says what it is.
    expect(screen.getByTestId('model-detail-v2-kind')).toBeInTheDocument()
    // ⛔ and the guess itself never reaches the document in any form.
    expect(first.container.textContent ?? '').not.toContain('Observable')
    first.unmount()

    const statedRow: ModelRow = { ...row, id: 'f3', label: 'Commodity index' }
    const stated = toRowDetail(graph as never, 'f3')
    if (stated === null) throw new Error('projection returned null — fixture is not in the model')
    render(<ModelDetailRegion row={statedRow} detail={stated} tier="plain" />)
    expect(screen.getByTestId('model-detail-v2-classification')).toHaveTextContent('External')
  })
})

describe('⛔ THE MARKER IS THE ONLY THING THAT WITHHOLDS', () => {
  /**
   * ⚠ NAMED APART FROM THE LABEL LOOKUP. `factorCategoryLabel` answers *how
   * does this value read?*; `statedFactorCategoryLabel` answers *may a surface
   * present this as the model's classification?*. Two questions under one name
   * is how a fail-open and a fail-closed default end up side by side looking
   * like an inconsistency to reconcile.
   */
  it('withholds ONLY on an explicit true', () => {
    expect(statedFactorCategoryLabel('external', true)).toBeNull()
    expect(statedFactorCategoryLabel('external', false)).toBe('External')
    expect(statedFactorCategoryLabel('external', undefined)).toBe('External')
  })

  it('a human stating the category clears the withholding', () => {
    // `useInspectorMutations.setCategory` writes `categoryInferredByUi: false`
    // in the same update as the value. Humans are the authors of this model: a
    // classification a person chose is stated, and withholding it would be the
    // mirror-image lie of printing a guess.
    expect(statedFactorCategoryLabel('observable', false)).toBe('Observable')
  })

  it('a truthy-but-not-true marker does not withhold, and a missing category still does', () => {
    // Bound to the literal `true` the writers emit, so a stray truthy value
    // cannot silently start suppressing real stamps.
    expect(statedFactorCategoryLabel('external', 'yes')).toBe('External')
    expect(statedFactorCategoryLabel(undefined, false)).toBeNull()
  })
})

describe('⛔ THE READER IS NOT STRICTER THAN ITS WRITERS', () => {
  /**
   * ⚠ THIS CORPUS IS NOT FROM THIS AUTHOR'S HEAD EITHER. Every value below is
   * named verbatim in a SHIPPED P1 hotfix comment at
   * `canvas/utils/graphDisplayCalculations.ts` — *"Normalize category to handle
   * LLM output inconsistencies (e.g., \"External\", \"external \",
   * \"CONTROLLABLE\")"*. That is the estate's own record of what arrives on
   * the wire, and it is the strongest evidence available about the real input
   * domain.
   *
   * ⚠ THE FAILURE DIRECTION IS THE ONE THIS FILE EXISTS TO PREVENT, INVERTED.
   * An un-normalised reader returns `null` for `"External"` — and `null` here
   * MEANS nobody stated one. So the canvas would draw the node with its
   * outside-your-control border while the tab said nothing, and the silence
   * would be indistinguishable from a genuinely unclassified factor.
   */
  it.each([
    ['External', 'External'],
    ['external ', 'External'],
    [' external', 'External'],
    ['CONTROLLABLE', 'Controllable'],
    ['Observable', 'Observable'],
  ])('reads %j as %j', (wire, expected) => {
    expect(factorCategoryLabel(wire)).toBe(expected)
    expect(statedFactorCategoryLabel(wire, undefined)).toBe(expected)
  })

  it('normalisation does not admit anything the vocabulary does not know', () => {
    // Contrast control for the block above: whitespace and case are forgiven,
    // membership is not. If this went green for an unknown token, the cases
    // above would be proving permissiveness rather than normalisation.
    expect(factorCategoryLabel(' Partially_Controllable ')).toBeNull()
    expect(factorCategoryLabel('   ')).toBeNull()
  })
})

describe('⛔ NO PROTOTYPE KEY REACHES THE SCREEN', () => {
  /**
   * ⚠ THE SIGNATURE IS `(category: unknown)` AND THE DOC PROMISES `null` FOR
   * ANYTHING UNRECOGNISED. An unguarded index into an object literal reaches
   * the prototype chain, and `??` falls back on null/undefined only — so
   * `"toString"` returned a FUNCTION, `detail.classification !== null` was
   * true, and the detail region rendered native-code source text as a
   * classification.
   *
   * ⚠ NO CLAIM IS MADE THAT CEE EMITS THESE. This is a shared primitive whose
   * input domain widens as other surfaces adopt it, and the guarantee is the
   * only reason to adopt it.
   */
  it.each(['toString', 'constructor', '__proto__', 'valueOf', 'hasOwnProperty'])(
    'inherited key %j yields null, not a function or an object',
    (key) => {
      expect(factorCategoryLabel(key)).toBeNull()
    },
  )

  it('⭐ renders no classification element for an inherited key', () => {
    renderFor(factorNode('toString'))
    expect(screen.queryByTestId('model-detail-v2-classification')).toBeNull()
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
