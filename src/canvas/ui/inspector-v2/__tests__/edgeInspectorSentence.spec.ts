import { describe, expect, it } from 'vitest'

import {
  resolveEdgeSignedStrengthDisplay,
  type EdgeValueDisplay,
} from '../../../domain/edgeValueProvenance'
import { EDGE_LINK_NOTICES, resolveEdgeLinkTemplate } from '../inspectorStrings'
import { buildEdgeInspectorSentence, type EdgeInspectorSentenceInput } from '../edgeInspectorSentence'

const sized = {
  weight: 0.55,
  weightSource: 'cee',
  direction: 'positive',
  directionSource: 'cee',
}
const unknownDisplay: EdgeValueDisplay = { show: false, reason: 'not_set' }
const disputed = {
  status: 'contested',
  user_action: 'pending',
  max_divergence: 0.4,
  contested_reasons: ['sign_flip'],
}

function input(
  data: Record<string, unknown> | undefined = sized,
  overrides: Partial<EdgeInspectorSentenceInput> = {},
): EdgeInspectorSentenceInput {
  return {
    sourceLabel: 'A',
    targetLabel: 'B',
    data,
    strengthDisplay: resolveEdgeSignedStrengthDisplay(data),
    linkKind: 'causal',
    ...overrides,
  }
}

function natural(author: string, userOrigin?: string) {
  return {
    amount: 2,
    unit: 'customers',
    perSourceChange: 1,
    sourceUnit: 'calls',
    strengthMean: 0.55,
    author,
    ...(userOrigin === undefined ? {} : { userOrigin }),
  }
}

describe('buildEdgeInspectorSentence — the relationship summary contract', () => {
  it('keeps the organisational notice body unchanged and without a provenance chip', () => {
    expect(buildEdgeInspectorSentence(input(sized, { linkKind: 'organisational' }))).toEqual({
      sentence: EDGE_LINK_NOTICES.organisational.body,
      chip: null,
    })
  })

  it('keeps the intervention notice body unchanged with the given labels', () => {
    const labels = { sourceLabel: 'Offer £49', targetLabel: 'Monthly churn rate' }
    expect(buildEdgeInspectorSentence(input(sized, { ...labels, linkKind: 'intervention' }))).toEqual({
      sentence: resolveEdgeLinkTemplate(labels),
      chip: null,
    })
  })

  it('states a definition before any numeric band, placeholder or authorship', () => {
    expect(buildEdgeInspectorSentence(input({
      ...sized,
      strengthDefinitional: true,
      strengthPlaceholder: 0.55,
    }))).toEqual({ sentence: 'B follows from A by definition.', chip: null })
  })

  it('does not call a user-authored strength a definition because of retained metadata', () => {
    expect(buildEdgeInspectorSentence(input({
      ...sized,
      weightSource: 'user',
      strengthDefinitional: true,
    }))).toEqual({ sentence: 'As A increases, B increases: strong.', chip: 'user' })
  })

  it.each([
    ['positive', 0.55, 'As A increases, B increases: strong.'],
    ['negative', 0.55, 'As A increases, B decreases: strong.'],
    ['positive', 0.1, 'As A increases, B increases: slight.'],
    ['positive', 0.3, 'As A increases, B increases: moderate.'],
    ['positive', 0.85, 'As A increases, B increases: very strong.'],
  ])('uses the canonical stated %s direction and strength band', (direction, weight, sentence) => {
    expect(buildEdgeInspectorSentence(input({ ...sized, direction, weight }))).toEqual({
      sentence,
      chip: 'olumi',
    })
  })

  it.each([
    { ...sized, directionSource: undefined },
    { ...sized, effect_direction: 'unknown' },
    { weight: 0.55, weightSource: 'cee' },
  ])('never infers an unstated direction from a default or a numeric sign', data => {
    expect(buildEdgeInspectorSentence(input(data))).toEqual({
      sentence: "A has a strong effect on B; the direction isn't stated.",
      chip: 'olumi',
    })
  })

  it.each([
    ['positive', 'increases'],
    ['negative', 'decreases'],
  ])('a placeholder with %s direction stays unsized', (direction, effect) => {
    const result = buildEdgeInspectorSentence(input({ ...sized, direction, strengthPlaceholder: 0.55 }))
    expect(result).toEqual({
      sentence: `As A increases, B ${effect}. This link isn't sized in the model yet. How strong do you think it is?`,
      chip: 'unsized',
    })
    expect(result.sentence.replace('How strong do you think it is?', '')).not.toMatch(/\b(slight|moderate|strong|very strong)\b/i)
  })

  it('a placeholder with an unstated direction stays unsized', () => {
    const result = buildEdgeInspectorSentence(input({ ...sized, directionSource: undefined, strengthPlaceholder: 0.55 }))
    expect(result).toEqual({
      sentence: "A affects B, but this link isn't sized in the model yet. How strong do you think it is?",
      chip: 'unsized',
    })
    // "How strong" is an invitation, not a band word. The licence guards
    // below remove that required question before scanning for an asserted band.
    expect(result.sentence.replace('How strong do you think it is?', '')).not.toMatch(/\b(slight|moderate|strong|very strong)\b/i)
  })

  it.each([
    ['positive', 'increases'],
    ['negative', 'decreases'],
  ])('strength that is not shown with %s direction stays unsized', (direction, effect) => {
    expect(buildEdgeInspectorSentence(input({ ...sized, direction }, { strengthDisplay: unknownDisplay }))).toEqual({
      sentence: `As A increases, B ${effect}. This link isn't sized in the model yet. How strong do you think it is?`,
      chip: 'unsized',
    })
  })

  it('strength that is not shown and has no direction stays unsized', () => {
    expect(buildEdgeInspectorSentence(input({}, { strengthDisplay: unknownDisplay }))).toEqual({
      sentence: "A affects B, but this link isn't sized in the model yet. How strong do you think it is?",
      chip: 'unsized',
    })
  })

  it('LICENCE / mutant pair: removing the placeholder marker restores the band assertion', () => {
    const placeholder = buildEdgeInspectorSentence(input({ ...sized, strengthPlaceholder: 0.55 }))
    const sizedControl = buildEdgeInspectorSentence(input(sized))
    const assertedPart = placeholder.sentence.replace('How strong do you think it is?', '')
    expect(assertedPart).not.toMatch(/\b(slight|moderate|strong|very strong)\b/i)
    expect(sizedControl.sentence).toMatch(/\bstrong\b/)
    expect(placeholder.chip).toBe('unsized')
    expect(sizedControl.chip).toBe('olumi')
  })

  it.each([
    [{ ...sized, weightSource: 'user' }, 'user'],
    [{ ...sized, weightSource: 'template' }, 'example'],
    [{ ...sized, strengthExampleFigure: 0.55 }, 'example'],
    [{ ...sized, naturalEffect: natural('olumi_estimate') }, 'olumi'],
    [{ ...sized, naturalEffect: natural('user', 'brief'), strengthStated: 0.55 }, 'brief'],
    [{ ...sized, naturalEffect: natural('user', 'entered'), strengthStated: 0.55 }, 'user'],
  ] as const)('maps only admitted strength provenance to the chip', (data, chip) => {
    expect(buildEdgeInspectorSentence(input(data)).chip).toBe(chip)
  })

  it('recognises an explicitly retained Olumi magnitude author without inventing a weight source', () => {
    const data = { naturalEffect: natural('olumi_estimate'), direction: 'positive', directionSource: 'cee' }
    expect(buildEdgeInspectorSentence(input(data, {
      strengthDisplay: { show: true, value: 0.55, source: 'cee' },
    })).chip).toBe('olumi')
  })

  it('keeps unknown provenance unknown even when a display was supplied', () => {
    const data = { ...sized, weightSource: 'unknown', naturalEffect: natural('unknown') }
    expect(buildEdgeInspectorSentence(input(data, {
      strengthDisplay: { show: true, value: 0.55, source: 'cee' },
    }))).toEqual({ sentence: 'As A increases, B increases: strong.', chip: null })
  })

  it('does not invent brief provenance from an unrecognised weightSource', () => {
    expect(buildEdgeInspectorSentence(input({ ...sized, weightSource: 'brief' }, {
      strengthDisplay: { show: true, value: 0.55, source: 'cee' },
    })).chip).toBeNull()
  })

  it('retires old example attribution when the strength changes', () => {
    expect(buildEdgeInspectorSentence(input({ ...sized, strengthExampleFigure: 0.3 })).chip).toBe('olumi')
  })

  it('the current user strength overrides retained Olumi or brief metadata', () => {
    expect(buildEdgeInspectorSentence(input({
      ...sized,
      weightSource: 'user',
      naturalEffect: natural('user', 'brief'),
      strengthStated: 0.55,
    })).chip).toBe('user')
  })

  it('brief provenance survives an unstated direction when the admitted strength is current', () => {
    expect(buildEdgeInspectorSentence(input({
      ...sized,
      directionSource: undefined,
      naturalEffect: natural('user', 'brief'),
      strengthStated: 0.55,
    }))).toEqual({
      sentence: "A has a strong effect on B; the direction isn't stated.",
      chip: 'brief',
    })
  })

  // Data layer Phase 1, DL call (b) 8 Oct: a strength sized from the user's stated figure reads "From your brief"
  // everywhere (canvas icon and Model tab already said brief; this chip said "Yours").
  it('uses the stated-figure owner when an incomplete natural effect cannot provide a size phrase', () => {
    expect(buildEdgeInspectorSentence(input({
      ...sized,
      directionSource: undefined,
      naturalEffect: { author: 'user' },
      strengthStated: 0.55,
    })).chip).toBe('brief')
  })

  it('a new producer magnitude retires the old brief attribution through the canonical freshness owners', () => {
    expect(buildEdgeInspectorSentence(input({
      ...sized,
      weight: 0.85,
      naturalEffect: natural('user', 'brief'),
      strengthStated: 0.55,
    }))).toEqual({ sentence: 'As A increases, B increases: very strong.', chip: 'olumi' })
  })

  it.each([
    { ...sized, validation: disputed },
    { ...sized, directionSource: undefined, validation: disputed },
    { ...sized, strengthPlaceholder: 0.55, validation: disputed },
    { ...sized, strengthDefinitional: true, validation: disputed },
  ])('appends the canonical unresolved direction disagreement without changing provenance', data => {
    const { validation: _validation, ...withoutDispute } = data
    const base = buildEdgeInspectorSentence(input(withoutDispute))
    expect(buildEdgeInspectorSentence(input(data))).toEqual({
      ...base,
      sentence: `${base.sentence} Two reviews disagree about its direction.`,
    })
  })

  it.each([
    { ...disputed, user_action: 'resolved' },
    { ...disputed, contested_reasons: ['magnitude'] },
    { ...disputed, status: 'agreed' },
  ])('does not invent direction disagreement from a settled or unrelated review', validation => {
    expect(buildEdgeInspectorSentence(input({ ...sized, validation })).sentence).toBe(
      'As A increases, B increases: strong.',
    )
  })

  it('uses labels verbatim rather than replacing them with graph identities', () => {
    expect(buildEdgeInspectorSentence(input(sized, {
      sourceLabel: 'Pro plan price (£)',
      targetLabel: 'MRR lost to churn',
    })).sentence).toBe('As Pro plan price (£) increases, MRR lost to churn increases: strong.')
  })

  it.each([
    input(sized),
    input({ ...sized, strengthPlaceholder: 0.55 }),
    input({ ...sized, directionSource: undefined }),
    input({ ...sized, strengthDefinitional: true }),
    input(sized, { linkKind: 'organisational' }),
    input(sized, { linkKind: 'intervention' }),
  ])('never turns a relationship summary into contest framing', value => {
    expect(buildEdgeInspectorSentence(value).sentence).not.toMatch(/\b(best|winner|recommend|ahead|leader)\b/i)
  })
})

// ⭐ ONE LICENCE ACROSS SURFACES (RC4; Science 393023 LICENCE ruling 3; #2623). The inspector's sentence reads the
// SAME CEE-shared parity fixture the canvas chip does: a wire edge the licence calls a placeholder never gets a band
// word here, and a sized one does. If this sentence ever grows its own "is it sized?" rule, this fails on the wire rows.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mapDraftEdgeToCanvas } from '../../../utils/applyDraftResult'
import { strengthForWords } from '../../../domain/strengthPlaceholder'

describe('buildEdgeInspectorSentence — the shared placeholder licence fixture', () => {
  const parityRows = JSON.parse(readFileSync(
    resolve(process.cwd(), 'src/canvas/domain/__tests__/fixtures/placeholder-licence-parity.json'), 'utf8',
  )) as Array<{ name: string; edge: Record<string, unknown> & { from: string; to: string }; placeholder: boolean }>
  const BAND = /\b(slight|moderate|strong|very strong)\b/i

  it('reads a fixture with both populations (positive control)', () => {
    expect(parityRows.filter(r => r.placeholder).length).toBeGreaterThan(0)
    expect(parityRows.filter(r => !r.placeholder).length).toBeGreaterThan(0)
  })

  for (const [i, row] of parityRows.entries()) {
    it(`agrees with strengthForWords: ${row.name}`, () => {
      const data = mapDraftEdgeToCanvas(row.edge, i).data as Record<string, unknown>
      const strengthDisplay = resolveEdgeSignedStrengthDisplay(data)
      const words = strengthForWords(data, strengthDisplay)
      const { sentence, chip } = buildEdgeInspectorSentence(input(data, { strengthDisplay }))
      const asserted = sentence.replace('How strong do you think it is?', '')
      if (row.placeholder) {
        expect(words.show).toBe(false)
        expect(asserted).not.toMatch(BAND)
        expect(chip).toBe('unsized')
      } else if (words.show) {
        expect(asserted).toMatch(BAND)
        expect(chip).not.toBe('unsized')
      } else {
        expect(asserted).not.toMatch(BAND)
      }
    })
  }
})
