/**
 * WHEN THE PRODUCER HAS SAID WHAT THE NUMBER MEANS, THE CARD MUST NOT SUBSTITUTE
 * A MAGNITUDE WORD FOR IT.
 *
 * ⭐ THE DEFECT, MEASURED ON THE COMMITTED CAPTURES. 10 of 87 nodes carry an
 * `encoding_map` — the producer's own statement of what each level on that
 * factor's scale means — and the card rendered a CEE-composed magnitude word
 * every time:
 *
 *   "Germany Market Entry"       rendered "Low (0)"   ·  map says 0 = "Not pursued"
 *   "Segment Platform Adoption"  rendered "Low (0)"   ·  map says 0 = "Not adopted"
 *   "Account Executives Added"   rendered "Low (0)"   ·  map says 0 = "No AEs added"
 *
 * ⛔ These are not merely vague. "Low" is not a small amount of market entry —
 * the market entry is NOT PURSUED. A magnitude word applied to a categorical
 * scale is a category error, and it reads to a user as a finding about their
 * business.
 *
 * The data was already arriving: `mapDraftNodeToCanvas` spreads the wire node's
 * remaining keys verbatim, so `encoding_map` reaches `node.data` untouched. The
 * only consumer before this change was a debug export bundle.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { encodingMapPhrase, formatFactorDisplayValue } from '../formatFactorDisplayValue'

const base = { label: 'F', raw_value: null, unit: null, factor_type: null, cap: null, category: null }

describe('the producer\'s meaning replaces the magnitude word', () => {
  it('renders the map\'s phrase instead of the composed summary', () => {
    expect(formatFactorDisplayValue({
      ...base, value: 0, display_value: 'Low (0)',
      encoding_map: { '0': 'Not pursued', '1': 'Pursued' },
    })).toBe('Not pursued')
  })

  /** Keys arrive as `"1.0"` in the captures; a string compare would miss. */
  it('matches keys numerically, not as strings', () => {
    expect(encodingMapPhrase({ '0': 'No engineers added', '1.0': 'Four engineers added' }, 1))
      .toBe('Four engineers added')
    expect(encodingMapPhrase({ '0.5': 'Two AEs added' }, 0.5)).toBe('Two AEs added')
  })
})

describe('⛔ it only displaces a MAGNITUDE SUMMARY, never contextual copy', () => {
  /**
   * ⭐ THE CASE CI TAUGHT ME, and it is the golden fixture verbatim.
   * `fac_acquisition` carries display_value "No acquisition pursued" beside
   * encoding_map {0: "Not pursued"}. The CEE-authored sentence is BETTER — it
   * names the subject where the map's phrase loses it. My first version
   * preferred the map unconditionally and replaced good copy with worse.
   */
  it('keeps contextual copy that the map would only make terser', () => {
    expect(formatFactorDisplayValue({
      ...base, value: 0, display_value: 'No acquisition pursued',
      encoding_map: { '0': 'Not pursued', '1': 'Pursued' },
    })).toBe('No acquisition pursued')
  })

  /** …while a summary that merely restates the model-scale number gives way. */
  it('displaces a summary that restates the node\'s own number', () => {
    expect(formatFactorDisplayValue({
      ...base, value: 0, display_value: 'Low (0)',
      encoding_map: { '0': 'Not pursued' },
    })).toBe('Not pursued')
  })

  /**
   * The discriminator is STRUCTURAL: the parenthesised figure must EQUAL the
   * node's value. A parenthesis holding some other number is not a restatement
   * of this node, so it is contextual copy and keeps its place.
   */
  it('does not treat an unrelated parenthesised number as a summary', () => {
    expect(formatFactorDisplayValue({
      ...base, value: 0, display_value: 'Cut by half (2 of 4 teams)',
      encoding_map: { '0': 'Not pursued' },
    })).toBe('Cut by half (2 of 4 teams)')
  })
})

/**
 * ⭐ F6 (canvas audit 27 Sep, edit-values; served `23ff3ca8`, pricing-model).
 * After the user set Usage-Based Pricing Exposure to 1, CEE's readback carried
 * `display_value: "1"`, `raw_value: 1`, no unit, beside `encoding_map {0: "No
 * usage pricing", 1: "Full usage pricing"}`. The card read "1 Set by you" while
 * the option rows on the same board read "No usage pricing → Full usage
 * pricing". A bare figure EQUAL to the node's own value is the plainest
 * restatement of that value there is — the map's meaning outranks it, exactly
 * as it outranks "High (1)".
 */
describe('F6 — a bare restated figure is a summary too: the map wins after a user edit', () => {
  it('the served readback shape reads the map phrase, not "1"', () => {
    expect(formatFactorDisplayValue({
      ...base, value: 1, raw_value: 1, display_value: '1',
      encoding_map: { '0': 'No usage pricing', '1': 'Full usage pricing' },
    })).toBe('Full usage pricing')
    expect(formatFactorDisplayValue({
      ...base, value: 0, raw_value: 0, display_value: '0',
      encoding_map: { '0': 'No usage pricing', '1': 'Full usage pricing' },
    })).toBe('No usage pricing')
    // With the provenance the served readback carried (the person typed it).
    expect(formatFactorDisplayValue({
      ...base, value: 1, raw_value: 1, display_value: '1', value_source: 'user_override',
      encoding_map: { '0': 'No usage pricing', '1': 'Full usage pricing' },
    })).toBe('Full usage pricing')
  })

  it('CONTRAST — the same bare figure with no map stays the figure', () => {
    expect(formatFactorDisplayValue({ ...base, value: 1, raw_value: 1, display_value: '1' })).toBe('1')
  })

  it('CONTRAST — a bare figure that is NOT the node\'s value is not a restatement', () => {
    // "4" beside value 1: the map's phrase for 1 would contradict the string.
    expect(formatFactorDisplayValue({
      ...base, value: 1, display_value: '4',
      encoding_map: { '0': 'No usage pricing', '1': 'Full usage pricing' },
    })).not.toBe('Full usage pricing')
  })
})

describe('⛔ and it never invents one', () => {
  /**
   * ⭐ THE CASE THAT DECIDES THE IMPLEMENTATION, and it is a real capture.
   * `GDPR EU Data Residency Compliance` carries `value: 0.5` against its own
   * BINARY map — the producer contradicts itself. Interpolating between
   * "Non-compliant" and "Fully compliant" would invent a compliance state
   * nobody asserted, on a subject where that is the worst thing to invent.
   */
  it('returns nothing when the value matches no key', () => {
    expect(encodingMapPhrase({ '0': 'Non-compliant', '1': 'Fully compliant' }, 0.5)).toBeNull()
  })

  it('leaves the card exactly as it was when it cannot answer', () => {
    expect(formatFactorDisplayValue({
      ...base, value: 0.5, display_value: 'Moderate (0.5)',
      encoding_map: { '0': 'Non-compliant', '1': 'Fully compliant' },
    })).toBe('Moderate (0.5)')
  })

  it('ignores a malformed or empty map rather than throwing', () => {
    for (const m of [null, undefined, [], 'nope', {}, { '0': '' }, { '0': '   ' }]) {
      expect(encodingMapPhrase(m, 0)).toBeNull()
    }
  })

  /** The schema admits `string | number`. A number is a second encoding, not a
   *  phrase — swapping one bare number for another helps nobody. */
  it('refuses a numeric map value', () => {
    expect(encodingMapPhrase({ '0': 42 }, 0)).toBeNull()
  })

  it('refuses a non-finite or absent value', () => {
    for (const v of [null, undefined, NaN, Infinity]) {
      expect(encodingMapPhrase({ '0': 'Not pursued' }, v as number)).toBeNull()
    }
  })

  /** A real-world magnitude is a MEASUREMENT; where one exists the map adds
   *  nothing, and Pattern 1 must keep winning. */
  it('does not outrank a real unit magnitude', () => {
    expect(formatFactorDisplayValue({
      ...base, value: 0, raw_value: 26000, unit: '£', display_value: 'Low (0)',
      encoding_map: { '0': 'Not pursued' },
    })).toBe('£26,000')
  })
})

/**
 * ⭐⭐ THE CENSUS, DERIVED FROM THE CAPTURES AT RUN TIME rather than restated,
 * so it cannot drift from them and REDs when the producer changes.
 */
describe('the census that justifies this', () => {
  const dir = resolve(__dirname, '../../canvas/starters/data')
  const nodes: Array<Record<string, unknown>> = (() => {
    const out: Array<Record<string, unknown>> = []
    for (const f of readdirSync(dir).filter(n => n.endsWith('.json'))) {
      let j: Record<string, unknown>
      try { j = JSON.parse(readFileSync(resolve(dir, f), 'utf8')) } catch { continue }
      const ns = ((j.nodes ?? (j.graph as Record<string, unknown>)?.nodes) ?? []) as Array<Record<string, unknown>>
      out.push(...ns)
    }
    return out
  })()

  it('read the captures at all — or every count below is blind', () => {
    expect(nodes.length).toBe(87)
  })

  it('MEASURED: 10 nodes carry a map, and 9 of them resolve', () => {
    const withMap = nodes.filter(n => n.encoding_map)
    expect(withMap.length).toBe(10)
    const resolved = withMap.filter(n => {
      const v = (n.observed_state as Record<string, unknown> | undefined)?.value
      return encodingMapPhrase(n.encoding_map, v as number) !== null
    })
    expect(resolved.length).toBe(9)
  })

  /**
   * ⛔ THE ONE THAT DOES NOT RESOLVE IS PINNED BY NAME, not by a count, so it
   * cannot quietly become two. If the producer fixes its self-contradiction
   * this REDs, which is the signal to re-measure — not a failure.
   */
  it('names the single unresolved case', () => {
    const unresolved = nodes
      .filter(n => n.encoding_map)
      .filter(n => encodingMapPhrase(n.encoding_map,
        (n.observed_state as Record<string, unknown> | undefined)?.value as number) === null)
      .map(n => n.label)
    expect(unresolved).toEqual(['GDPR EU Data Residency Compliance'])
  })

  it('every phrase it would render is the producer\'s own string, never composed', () => {
    for (const n of nodes.filter(x => x.encoding_map)) {
      const v = (n.observed_state as Record<string, unknown> | undefined)?.value
      const phrase = encodingMapPhrase(n.encoding_map, v as number)
      if (phrase === null) continue
      expect(Object.values(n.encoding_map as Record<string, unknown>)).toContain(phrase)
    }
  })
})
