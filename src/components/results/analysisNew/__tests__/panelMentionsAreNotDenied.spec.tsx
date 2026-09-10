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
import { buildNodeInsights, mentionSectionsFrom } from '../nodeInsights'

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

/**
 * ⛔⛔ THE TWO SECTIONS THE FIRST FIX OMITTED, AND THE MECHANISM THAT STOPS A
 * THIRD OMISSION.
 *
 * The first fix listed `keyInsights` and `sensitivity` under a comment claiming
 * it covered "every other section". The panel renders FOUR sections of
 * `AnalysisNewFinding[]`, and the two left out both carry real node
 * `targetId`s — `drivers` from `d.matchedNodeId ?? d.factorKey`, `uncertainty`
 * from `u.affectedNodes[0]`.
 *
 * ⚠ THE COMPLETENESS GUARD IS NOT IN THIS FILE, AND THAT IS DELIBERATE. A test
 * listing four sections is a MIRROR of the list it is checking, and it would go
 * stale the same way the comment did (CLAUDE.md trap 12: a derived guard proves
 * agreement and can never prove completeness). Completeness is enforced by the
 * TYPE: `mentionSectionsFrom` takes `Record<AnalysisNewFindingSectionKey, …>`,
 * a union derived from `AnalysisNewViewModel`, so a missing section is a
 * COMPILE error and a new finding-bearing section REDs every caller. What the
 * cases below pin is the behaviour that type cannot state: that each section's
 * rows are joined, and in what ORDER the reader meets them.
 */
describe('every finding-bearing section reaches the index', () => {
  const driverRow = finding('driver:f_reporting', 'Regulatory reporting load', PCF)
  const gapRow = finding('uncertainty:EVIDENCE_GAP', 'Churn assumption is unevidenced', PCF)

  it('⛔ a DRIVERS row names the node — the rank-4 case the glance cap drops', () => {
    const index = build([{ section: 'drivers', findings: [driverRow] }])
    expect(index.get(PCF)?.mentions.map((m) => m.id)).toEqual(['driver:f_reporting'])
    expect(index.get(PCF)?.mentions[0]?.section).toBe('drivers')
    // ⚠ AND `driverLabel` STAYS NULL, which is the whole point of the case.
    // The glance list is capped at three and this node was not in it, so the
    // mention is the ONLY thing standing between the reader and a denial.
    expect(index.get(PCF)?.driverLabel).toBeNull()
  })

  it('⛔ an UNCERTAINTY row names the node', () => {
    const index = build([{ section: 'uncertainty', findings: [gapRow] }])
    expect(index.get(PCF)?.mentions.map((m) => m.section)).toEqual(['uncertainty'])
  })

  /**
   * ⚠ ORDER IS THE READER'S READING ORDER, and it is a decision rather than an
   * accident: the mount writes its `Record` top to bottom down the panel, and
   * `mentionSectionsFrom` preserves that key order. A pointer list in DOM order
   * is walkable; an arbitrary one sends the reader hunting.
   */
  it('the section rows arrive in the order the caller wrote them', () => {
    const sections = mentionSectionsFrom({
      sensitivity: [flip],
      keyInsights: [hinge],
      drivers: [driverRow],
      uncertainty: [gapRow],
    })
    expect(sections.map((s) => s.section)).toEqual([
      'sensitivity',
      'keyInsights',
      'drivers',
      'uncertainty',
    ])

    // END TO END through the builder, so this is the mount's own path and not
    // a shape assertion about an intermediate value.
    const index = buildNodeInsights({ interventions: [], drivers: [], mentionSections: sections })
    expect(index.get(PCF)?.mentions.map((m) => m.id)).toEqual([
      'sensitivity:1',
      'insight:hinge',
      'driver:f_reporting',
      'uncertainty:EVIDENCE_GAP',
    ])
  })

  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN FOR THE WIDENING. Two more sections means two
   * more chances to credit a node with a mention it never earned, which would
   * silence the empty state everywhere and be a worse defect than the denial.
   */
  it('⛔ SCOPED BY IDENTITY across all four sections at once', () => {
    const index = buildNodeInsights({
      interventions: [],
      drivers: [],
      mentionSections: mentionSectionsFrom({
        sensitivity: [flip],
        keyInsights: [hinge],
        drivers: [driverRow],
        uncertainty: [gapRow],
      }),
    })
    // PRECONDITION PINNED IN-TEST: all four really did join, so the absence
    // below is the scoping and not an index that built nothing.
    expect(index.get(PCF)?.mentions.length).toBe(4)
    expect(index.get(OTHER)?.mentions ?? []).toEqual([])
  })

  /**
   * ⚠ A REAL PRODUCER STATE, NOT A DEFENSIVE CASE. A long non-threshold
   * uncertainty or sensitivity row is built with `headline: ''` on purpose, so
   * it does not print its own sentence twice — and it still carries
   * `affectedNodes`, so it still names a node. The join must not quietly drop
   * it: a dropped mention is the denial coming back for that row.
   */
  it('a finding with an EMPTY headline is still a mention', () => {
    const index = build([
      { section: 'uncertainty', findings: [finding('uncertainty:LONG', '', PCF)] },
    ])
    expect(index.get(PCF)?.mentions.map((m) => m.id)).toEqual(['uncertainty:LONG'])
    expect(index.get(PCF)?.mentions[0]?.headline).toBe('')
  })
})
