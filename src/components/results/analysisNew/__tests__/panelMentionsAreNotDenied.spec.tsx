/**
 * THE STRIP MAY NOT SAY THE PANEL IS SILENT WHILE THE PANEL IS TALKING.
 *
 * ⚠⚠ WITNESSED ON DEPLOYED `d82e81f0`, NOT REASONED ABOUT. Selecting **Platform
 * Capability Fit** produced *"Nothing else on this panel refers to this node"*
 * while the SAME PANEL, at the same moment, carried all four of:
 *
 *   · "Platform Capability Fit is the hinge"                     (key insights)
 *   · "If \"Platform Capability Fit → …\" changes significantly, \"Status Quo /
 *      Defer Decision\" could become the better choice"          (sensitivity)
 *   · "If \"EU Data Residency Compliance → Platform Capability Fit\" …"
 *   · "Olumi estimated how strongly Platform Capability Fit affects …"
 *
 * The copy claims something about THE WHOLE PANEL; `buildNodeInsights` knew
 * about TWO of its sections. One name, two questions, and the narrower one was
 * answering for the wider.
 *
 * ⚠ AND THE UNIFORMITY WAS NOT THE TELL, WHICH IS WHY THIS NEEDS A CONTRAST
 * PAIR. Driving ten nodes on the deployed build, NINE said "nothing refers to
 * this node" and one did not — so the feature was demonstrably alive, and a
 * sweep looking for an all-identical answer would have called it healthy. The
 * defect only appears when you check a node the panel is DEMONSTRABLY
 * discussing. Every case below therefore pins WHICH node it is about.
 */
import { describe, it, expect } from 'vitest'
import { buildNodeInsights } from '../nodeInsights'

const PCF = 'node_pcf'
const OTHER = 'node_other'

const finding = (id: string, headline: string, targetId?: string) => ({
  id,
  headline,
  ...(targetId === undefined ? {} : { targetId }),
})

const hinge = finding('insight:hinge', 'Platform Capability Fit is the hinge', PCF)
const flip = finding(
  'sensitivity:1',
  'If "Platform Capability Fit → the goal" changes significantly, "Status Quo" could become the better choice',
  PCF,
)

function build(extra: Parameters<typeof buildNodeInsights>[0]['mentionSections'] = []) {
  return buildNodeInsights({ interventions: [], drivers: [], mentionSections: extra })
}

describe('the strip’s empty state is a claim about the WHOLE panel', () => {
  it('⛔ THE WITNESSED CASE: a key insight naming the node is a mention', () => {
    const index = build([{ section: 'keyInsights', findings: [hinge] }])
    const row = index.get(PCF)
    // Bound by IDENTITY to the finding, never to a count another row satisfies.
    expect(row?.mentions.map(m => m.id)).toEqual(['insight:hinge'])
    expect(row?.mentions[0]?.headline).toBe('Platform Capability Fit is the hinge')
    expect(row?.mentions[0]?.section).toBe('keyInsights')
  })

  it('⛔ and so is a "what would change your mind" card', () => {
    const index = build([{ section: 'sensitivity', findings: [flip] }])
    expect(index.get(PCF)?.mentions.map(m => m.section)).toEqual(['sensitivity'])
  })

  it('BOTH SECTIONS AT ONCE, in section order, with no de-duplication across them', () => {
    const index = build([
      { section: 'keyInsights', findings: [hinge] },
      { section: 'sensitivity', findings: [flip] },
    ])
    expect(index.get(PCF)?.mentions.map(m => m.id)).toEqual(['insight:hinge', 'sensitivity:1'])
  })

  /*
   * ⭐ THE OPPOSITE-DIRECTION TWIN. A version that credited every node with
   * every mention would silence the empty state everywhere — a different defect,
   * and one the assertions above cannot see on their own.
   */
  it('⛔ SCOPED BY IDENTITY: a node the sections do not name gets NOTHING', () => {
    const index = build([
      { section: 'keyInsights', findings: [hinge] },
      { section: 'sensitivity', findings: [flip] },
    ])
    // PRECONDITION PINNED IN-TEST: the sections really did produce mentions, so
    // the empty result below is the scoping and not an index that built nothing.
    expect(index.get(PCF)?.mentions.length).toBe(2)
    expect(index.get(OTHER)?.mentions ?? []).toEqual([])
  })

  it('a finding with NO targetId names no node — it cannot be joined', () => {
    const index = build([
      { section: 'keyInsights', findings: [finding('insight:untargeted', 'Something general')] },
    ])
    expect(index.size).toBe(0)
  })

  it('one section naming a node twice tells the reader once', () => {
    const index = build([{ section: 'keyInsights', findings: [hinge, hinge] }])
    expect(index.get(PCF)?.mentions.length).toBe(1)
  })

  /*
   * ⚠ NOT CAPPED, and that is a different decision from `findings`. A finding
   * RENDERS a whole card, so its cap is a layout decision; a mention is one
   * headline pointing at a card already on screen. Capping these would put the
   * original defect back one notch quieter — "and 2 more" where it used to say
   * "nothing".
   */
  it('mentions are NOT capped — the cap belongs to findings, which render cards', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      finding(`insight:${i}`, `Insight ${i}`, PCF),
    )
    const index = build([{ section: 'keyInsights', findings: many }])
    expect(index.get(PCF)?.mentions.length).toBe(9)
    expect(index.get(PCF)?.withheldFindings).toBe(0)
  })

  it('BACK-COMPAT: a caller that passes no sections gets the old, narrower answer', () => {
    const index = buildNodeInsights({ interventions: [], drivers: [] })
    expect(index.size).toBe(0)
  })
})
