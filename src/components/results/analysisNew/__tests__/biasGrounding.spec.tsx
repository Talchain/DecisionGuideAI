/**
 * RED-first pins for the Reasoning tab's bias-grounding readout.
 *
 * ⭐⭐ EVERY PAYLOAD IN THIS FILE IS A REAL ONE, READ OFF A COMMITTED ARTEFACT.
 * `CAPTURED_OVERCONFIDENCE` and `CAPTURED_AUTHORITY` are transcribed verbatim
 * from, respectively:
 *
 *   `src/canvas/hydrate/__tests__/fixtures/pricing-provisional-poll.json`
 *      → `/graph/analysis_ready/bias_findings[0]`
 *   `src/canvas/starters/data/headcount-allocation.draft.json`
 *      → `/analysis_ready/bias_findings[0]`
 *
 * ⚠ THIS IS THE POINT, NOT A CONVENIENCE. A fixture the author invents encodes
 * the author's model of the producer rather than the producer (CLAUDE.md trap
 * 16-inverse), and it is exactly how the repo came to read
 * `micro_intervention.steps[0].text` against payloads whose `steps` are plain
 * strings. Both captures carry `steps: string[]`. §2 pins that, and it is the
 * assertion most likely to have gone the other way had these fixtures been
 * written from the TypeScript declaration.
 *
 * ⚠ AND THE WORDING IS ASSERTED AS LITERALS, NEVER AGAINST THE COPY DECK. A
 * test that compares the render to the same constant the component renders is
 * a guard agreeing with itself: it passes on any wording, including the one the
 * copy rules forbid. Where the point of an assertion IS the words, the words
 * are written out here.
 */

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { buildBiasGrounding } from '../biasGrounding'
import { BiasGrounding } from '../sections/BiasGrounding'

/**
 * Verbatim from the captured poll response. `steps` are STRINGS, there is no
 * `type` field, and the bias is named only by `code`.
 */
const CAPTURED_OVERCONFIDENCE = {
  id: 'overconfidence_narrow_belief_band',
  code: 'OVERCONFIDENCE',
  category: 'other',
  citation: 'Lichtenstein et al. (1982) - Judgment Under Uncertainty',
  severity: 'high',
  mechanism:
    'Excessive certainty in own judgments, leading to overly narrow confidence intervals and underestimation of uncertainty.',
  explanation:
    'Edge beliefs are all high and tightly clustered; probability estimates may be over-confident.',
  confidence_band: 'medium',
  micro_intervention: {
    steps: [
      'Widen your confidence interval: what would make you 90% confident vs 50%?',
      'List three things you might be wrong about in this analysis',
    ],
    estimated_minutes: 3,
  },
  structural_pattern: 'Belief values in high, narrow band [1.00, 1.00] across 6 edges',
} as const

/** Verbatim from the shipped starter draft. Same shape, different code. */
const CAPTURED_AUTHORITY = {
  id: 'authority_high_degree_node',
  code: 'AUTHORITY_BIAS',
  category: 'other',
  severity: 'medium',
  explanation:
    'One or more authority-labelled nodes are highly connected in the decision graph; this may overweight senior opinions.',
  mechanism:
    'Tendency to attribute greater accuracy to opinions of authority figures, regardless of content.',
  citation: 'Milgram (1963) - Journal of Abnormal and Social Psychology',
  micro_intervention: {
    steps: [
      'Collect input anonymously before revealing who said what',
      'Explicitly ask junior team members to share their view first',
    ],
    estimated_minutes: 3,
  },
} as const

const TESTID = 'analysis-new-bias-grounding'

function renderFor(findings: readonly unknown[]) {
  return render(<BiasGrounding items={buildBiasGrounding(findings)} />)
}

describe('§1 the producer\'s grounding survives normalisation', () => {
  it('carries mechanism, citation, steps and minutes off a real captured payload', () => {
    const [item] = buildBiasGrounding([CAPTURED_OVERCONFIDENCE])

    expect(item.id).toBe('overconfidence_narrow_belief_band')
    expect(item.mechanism).toBe(
      'Excessive certainty in own judgments, leading to overly narrow confidence intervals and underestimation of uncertainty.',
    )
    expect(item.citation).toBe('Lichtenstein et al. (1982) - Judgment Under Uncertainty')
    expect(item.estimatedMinutes).toBe(3)
    expect(item.steps).toEqual([
      'Widen your confidence interval: what would make you 90% confident vs 50%?',
      'List three things you might be wrong about in this analysis',
    ])
  })

  it('keeps both captured findings, each under its own producer id', () => {
    const items = buildBiasGrounding([CAPTURED_OVERCONFIDENCE, CAPTURED_AUTHORITY])
    expect(items.map((i) => i.id)).toEqual([
      'overconfidence_narrow_belief_band',
      'authority_high_degree_node',
    ])
  })
})

describe('§2 the two step shapes, and the captured one is the string shape', () => {
  /**
   * ⭐ THE DISCRIMINATING PAIR. The repo's declared shape and the shape both
   * captures actually carry are DIFFERENT, and a normaliser that handles only
   * one of them is silently lossy on the other. Neither case alone shows the
   * normaliser discriminates; the pair does.
   */
  it('reads plain-string steps, which is what both real payloads send', () => {
    const [item] = buildBiasGrounding([CAPTURED_AUTHORITY])
    expect(item.steps[0]).toBe('Collect input anonymously before revealing who said what')
  })

  it('also reads the repo-declared {text} step shape', () => {
    const [item] = buildBiasGrounding([
      {
        id: 'legacy_shape',
        mechanism: 'Anchoring on the first number offered.',
        micro_intervention: { steps: [{ text: 'Re-estimate from a blank sheet' }] },
      },
    ])
    expect(item.steps).toEqual(['Re-estimate from a blank sheet'])
  })

  it('drops blank and unreadable steps rather than rendering an empty bullet', () => {
    const [item] = buildBiasGrounding([
      {
        id: 'blanks',
        citation: 'Kahneman (2011)',
        micro_intervention: { steps: ['   ', { text: '' }, 42, null, 'Keep this one'] },
      },
    ])
    expect(item.steps).toEqual(['Keep this one'])
  })
})

describe('§3 absence produces nothing, never a placeholder', () => {
  it('returns no items for null, undefined and an empty list', () => {
    expect(buildBiasGrounding(null)).toEqual([])
    expect(buildBiasGrounding(undefined)).toEqual([])
    expect(buildBiasGrounding([])).toEqual([])
  })

  it('drops a finding that carries no mechanism, no citation and no steps', () => {
    expect(
      buildBiasGrounding([
        { id: 'bare', code: 'OVERCONFIDENCE', severity: 'high', explanation: 'Something' },
      ]),
    ).toEqual([])
  })

  it('rejects a non-positive or non-finite estimated_minutes instead of printing it', () => {
    const [zero] = buildBiasGrounding([
      { id: 'z', citation: 'X (1999)', micro_intervention: { steps: ['a'], estimated_minutes: 0 } },
    ])
    expect(zero.estimatedMinutes).toBeNull()

    const [nan] = buildBiasGrounding([
      {
        id: 'n',
        citation: 'X (1999)',
        micro_intervention: { steps: ['a'], estimated_minutes: 'soon' },
      },
    ])
    expect(nan.estimatedMinutes).toBeNull()
  })

  it('renders nothing at all when there is no grounding to show', () => {
    const { container } = renderFor([{ id: 'bare', code: 'OVERCONFIDENCE' }])
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })
})

describe('§4 the rendered readout, bound by identity', () => {
  it('renders the heading, in these words', () => {
    renderFor([CAPTURED_OVERCONFIDENCE])
    expect(screen.getByTestId(`${TESTID}-heading`).textContent).toBe(
      'Where these checks come from',
    )
  })

  it('renders the producer mechanism under the finding\'s own id', () => {
    renderFor([CAPTURED_OVERCONFIDENCE])
    expect(
      screen.getByTestId(`${TESTID}-mechanism-overconfidence_narrow_belief_band`).textContent,
    ).toBe(
      'Excessive certainty in own judgments, leading to overly narrow confidence intervals and underestimation of uncertainty.',
    )
  })

  it('renders the literature reference verbatim, labelled as a source', () => {
    renderFor([CAPTURED_AUTHORITY])
    expect(screen.getByTestId(`${TESTID}-citation-authority_high_degree_node`).textContent).toBe(
      'Source: Milgram (1963) - Journal of Abnormal and Social Psychology',
    )
  })

  it('renders every step the producer sent, in order', () => {
    renderFor([CAPTURED_AUTHORITY])
    const steps = screen.getByTestId(`${TESTID}-steps-authority_high_degree_node`)
    expect([...steps.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Collect input anonymously before revealing who said what',
      'Explicitly ask junior team members to share their view first',
    ])
  })

  it('states the time cost in words, and pluralises it', () => {
    renderFor([CAPTURED_AUTHORITY])
    expect(screen.getByTestId(`${TESTID}-minutes-authority_high_degree_node`).textContent).toBe(
      'About 3 minutes.',
    )
  })

  it('says "1 minute", not "1 minutes"', () => {
    renderFor([
      { id: 'one', citation: 'X (1999)', micro_intervention: { steps: ['a'], estimated_minutes: 1 } },
    ])
    expect(screen.getByTestId(`${TESTID}-minutes-one`).textContent).toBe('About 1 minute.')
  })

  it('omits the time line entirely when the producer costed nothing', () => {
    renderFor([{ id: 'nocost', citation: 'X (1999)', micro_intervention: { steps: ['a'] } }])
    expect(screen.queryByTestId(`${TESTID}-minutes-nocost`)).toBeNull()
  })
})

describe('§5 the copy rules, asserted on what actually renders', () => {
  /**
   * ⭐ NEVER NAME THE BIAS AS A DIAGNOSIS OF THE READER. The corrective
   * technique is the product; the label is not. Bound to the producer's own
   * `code` on both captured payloads, so it fails loud if a later edit starts
   * echoing the classification back at the user.
   */
  it('never prints the producer\'s bias code', () => {
    const { container } = renderFor([CAPTURED_OVERCONFIDENCE, CAPTURED_AUTHORITY])
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/overconfidence/i)
    expect(text).not.toMatch(/authority.?bias/i)
  })

  it('uses no em dashes', () => {
    const { container } = renderFor([CAPTURED_OVERCONFIDENCE, CAPTURED_AUTHORITY])
    expect(container.textContent ?? '').not.toContain('—')
  })

  /**
   * ⚠ NO RACE FRAMING AND NO PROMISE OF IMPROVEMENT. Both are standing rulings,
   * and a grounding readout is a natural place for "this will improve your
   * decision" to appear. The producer's own strings are excluded from this
   * sweep only where they are the producer's; the FURNITURE is ours and must
   * clear the rule on its own.
   */
  it('makes no claim that following the steps improves the decision', () => {
    const { container } = renderFor([CAPTURED_OVERCONFIDENCE])
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\b(winner|leading option|leads|best option|beat)\b/i)
    expect(text).not.toMatch(/\b(will|would) (improve|fix|correct|sharpen)\b/i)
  })
})
