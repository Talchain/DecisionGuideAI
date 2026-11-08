/**
 * PL-21: the View is checked against core's vendored schema before it is installed (`validateView.ts`). Four kinds of response, each
 * refusal paired with a passing contrast: a scenario still drafting, a gated board, a past version, and malformed Views. The walker is
 * held to Ajv's verdict (the validator `client.spec.ts` already trusts for the goldens) on every vendored View and on mutants at every
 * depth, so it reads core's schema exactly as Ajv does, without Ajv's `new Function` or its 712 KB in the page.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020'
import { checkAgainst, SUPPORTED_KEYWORDS, validateView, type Checked, type SchemaNode } from '../validateView'

const here = (f: string) => new URL(f, import.meta.url)
const json = (f: string) => JSON.parse(readFileSync(here(f), 'utf8'))
const schema = json('../view.v3.json') as SchemaNode
const ajv = new Ajv2020({ strict: false }).compile(schema)
/** The goldens core froze and `client.spec.ts` holds valid. */
const GOLDEN = ['pricing', 'studio', 'bakery', 'european', 'app-launch', 's_ce285b3617bb', 'proposal'] as const
const golden = (n: (typeof GOLDEN)[number]) => json(`../golden/${n}.view.json`)

const refused = (r: Checked) => (r.ok ? { ok: true as const } : { ok: false as const, at: r.at })

describe('one contract: the walker reads the vendored core schema, with the type generator\'s keywords', () => {
  it('reads only the keywords scripts/olumi-view/gen-types.mjs accepts, and the vendored schema uses no other', () => {
    const gen = readFileSync(here('../../../scripts/olumi-view/gen-types.mjs'), 'utf8')
    const listed = gen.match(/const KEYWORDS = new Set\(\[([^\]]*)\]\)/)?.[1]
    expect(listed).toBeDefined()
    expect(new Set(listed!.split(',').map((s) => s.trim().replace(/^'|'$/g, '')))).toEqual(SUPPORTED_KEYWORDS)
    const used = new Set<string>()
    const walk = (n: unknown, inProps = false): void => {
      if (Array.isArray(n)) { n.forEach((x) => walk(x)); return }
      if (n === null || typeof n !== 'object') return
      for (const [k, v] of Object.entries(n)) {
        if (!inProps) used.add(k)
        walk(v, !inProps && k === 'properties')
      }
    }
    walk(schema)
    expect([...used].filter((k) => !SUPPORTED_KEYWORDS.has(k))).toEqual([])
    expect(used.has('additionalProperties')).toBe(true) // contrast: the walk sees keywords
  })

  it('reads its keywords as Ajv does where core\'s Views do not reach them yet: oneOf means exactly one, integer means whole', () => {
    expect(refused(checkAgainst({ oneOf: [{ type: 'string' }, { type: 'string' }] }, 'a'))).toEqual({ ok: false, at: '$' })
    expect(checkAgainst({ oneOf: [{ type: 'string' }, { type: 'number' }] }, 'a').ok).toBe(true)
    expect(refused(checkAgainst({ type: 'integer' }, 2.5))).toEqual({ ok: false, at: '$' })
    expect(checkAgainst({ type: 'integer' }, 2).ok).toBe(true)
    for (const [s, v] of [[{ oneOf: [{ type: 'string' }, { type: 'string' }] }, 'a'], [{ type: 'integer' }, 2.5], [{ type: 'integer' }, 2]] as const) {
      expect(checkAgainst(s, v).ok).toBe(new Ajv2020({ strict: false }).compile(s)(v))
    }
  })

  it('a keyword it does not read fails the check, never passes silently', () => {
    expect(refused(checkAgainst({ type: 'string', pattern: '^a' }, 'b'))).toEqual({ ok: false, at: '$' })
    expect(checkAgainst({ type: 'string' }, 'b').ok).toBe(true)
  })
})

describe('the walker agrees with Ajv', () => {
  const files: string[] = []
  const collect = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) collect(p)
      else if (/\.view3?\.json$/.test(f)) files.push(p)
    }
  }
  collect(fileURLToPath(here('../golden')))
  collect(fileURLToPath(here('../fixtures')))

  it('on every View vendored in golden/ and fixtures/ (valid and not)', () => {
    let valid = 0
    for (const f of files) {
      const v = JSON.parse(readFileSync(f, 'utf8'))
      const ours = validateView(v).ok
      expect({ f, ours }).toEqual({ f, ours: ajv(v) })
      if (ours) valid += 1
    }
    expect(files.length).toBeGreaterThanOrEqual(20)
    expect(valid).toBeGreaterThanOrEqual(GOLDEN.length) // both verdicts occur
    expect(valid).toBeLessThan(files.length)
  })

  it('on mutants at every depth of each golden: an unknown key, a dropped key, a wrong type', () => {
    let accepted = 0, rejected = 0
    for (const n of GOLDEN) {
      const base = golden(n)
      const spots: (string | number)[][] = []
      const walk = (x: unknown, path: (string | number)[]) => {
        if (Array.isArray(x)) { x.slice(0, 2).forEach((y, i) => walk(y, [...path, i])); return }
        if (x === null || typeof x !== 'object') return
        spots.push(path)
        for (const [k, v] of Object.entries(x)) walk(v, [...path, k])
      }
      walk(base, [])
      for (const path of spots.filter((_, i) => i % 3 === 0)) {
        for (const mutate of ['extra', 'drop', 'retype'] as const) {
          const v = structuredClone(base)
          const target = path.reduce((o: Record<string | number, unknown>, k) => o[k] as Record<string | number, unknown>, v)
          const keys = Object.keys(target)
          if (mutate === 'extra') target.zz_not_in_schema = true
          else if (keys.length === 0) continue
          else if (mutate === 'drop') delete target[keys[0]]
          else target[keys[keys.length - 1]] = typeof target[keys[keys.length - 1]] === 'string' ? 7 : 'seven'
          const ours = validateView(v).ok
          expect({ n, path: path.join('.'), mutate, ours }).toEqual({ n, path: path.join('.'), mutate, ours: ajv(v) })
          if (ours) accepted += 1; else rejected += 1
        }
      }
    }
    // Magnitude, not just presence: hundreds of mutants, and both verdicts among them (a dropped optional key, a retyped nullable).
    expect(rejected).toBeGreaterThan(300)
    expect(accepted).toBeGreaterThan(0)
  })
})

describe('a scenario still drafting (core API v1.24 `draft`, save first)', () => {
  const declares = Object.prototype.hasOwnProperty.call((schema.properties ?? {}) as object, 'draft')
  it('the vendored schema declares `draft` (core 043895af): without it every drafted scenario would be refused', () => {
    expect(declares).toBe(true)
  })
  for (const status of ['drafting', 'done', 'failed', 'lost'] as const) {
    it(`draft ${status}: accepted`, () => {
      const r = validateView({ ...golden('pricing'), draft: { status, reason: status === 'failed' ? 'Olumi could not finish the draft.' : null, at: '2026-11-08T02:00:00.000Z' } })
      expect(r).toEqual({ ok: true })
    })
  }
  it('a draft status core does not serve, or a draft without its time, is refused at the draft', () => {
    expect(refused(validateView({ ...golden('pricing'), draft: { status: 'paused', reason: null, at: '2026-11-08T02:00:00.000Z' } }))).toEqual({ ok: false, at: '$.draft.status' })
    expect(refused(validateView({ ...golden('pricing'), draft: { status: 'drafting', reason: null } }))).toEqual({ ok: false, at: '$.draft.at' })
    expect(validateView({ ...golden('pricing'), draft: null }).ok).toBe(true)
  })
})

describe('a gated board (the person has not given their view yet)', () => {
  it('gated, as core serves it: accepted; gated given as words: refused', () => {
    const v = golden('pricing')
    expect(v.gated).toBe(true)
    expect(validateView(v)).toEqual({ ok: true })
    expect(refused(validateView({ ...v, gated: 'yes' }))).toEqual({ ok: false, at: '$.gated' })
  })
  it('an ungated board with a held proposal: accepted', () => {
    const v = golden('proposal')
    expect([v.gated, v.proposal !== null]).toEqual([false, true])
    expect(validateView(v)).toEqual({ ok: true })
  })
})

describe('a past version (`view?at=n`)', () => {
  it('version 2 of a scenario: accepted; a version whose number is words: refused at the version', () => {
    const v = golden('s_ce285b3617bb')
    expect(v.version.n).toBe(2)
    expect(validateView(v)).toEqual({ ok: true })
    expect(refused(validateView({ ...v, version: { ...v.version, n: '2' } }))).toEqual({ ok: false, at: '$.version.n' })
    expect(validateView({ ...v, version: null }).ok).toBe(true)
  })
})

describe('malformed Views are refused, at the place they are wrong', () => {
  const v = () => golden('pricing')
  it('not a View at all', () => {
    for (const x of [null, [], 'olumi.view/3', 3]) expect(refused(validateView(x))).toEqual({ ok: false, at: '$' })
  })
  it('another schema', () => {
    expect(refused(validateView({ ...v(), schema: 'olumi.view/2' }))).toEqual({ ok: false, at: '$.schema' })
  })
  it('a missing top-level field', () => {
    const x = v(); delete x.session
    expect(refused(validateView(x))).toEqual({ ok: false, at: '$.session' })
  })
  it('a field this page does not know, three levels down', () => {
    const x = v()
    const c = x.model.cards.findIndex((k: { rows: unknown[] }) => k.rows.length > 0)
    expect(c).toBeGreaterThanOrEqual(0)
    x.model.cards[c].rows[0].zz_new = 1
    const r = validateView(x)
    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.at).toMatch(new RegExp(`^\\$\\.model\\.cards\\[${c}\\]\\.rows\\[0\\]`))
  })
  it('a nested field of the wrong kind: a card\'s label as a number', () => {
    const x = v(); x.model.cards[1].label = 42
    expect(refused(validateView(x))).toEqual({ ok: false, at: '$.model.cards[1].label' })
  })
  it('a link\'s removal in another shape than core\'s `{ record, part }`', () => {
    const x = golden('studio')
    const i = x.model.links.findIndex((l: { remove: unknown }) => l.remove !== null)
    expect(i).toBeGreaterThanOrEqual(0)
    x.model.links[i].remove = { record: x.model.links[i].remove.record }
    expect(refused(validateView(x))).toEqual({ ok: false, at: `$.model.links[${i}].remove.part` })
  })
})

describe('core PR 7 (links[].records, 06194550) is consumed when vendored, never added here', () => {
  it('this schema is the one before PR 7: a link carrying `records` is refused until core\'s schema with it is re-vendored', () => {
    const x = golden('pricing')
    x.model.links[0].records = ['r_1']
    expect(refused(validateView(x))).toEqual({ ok: false, at: '$.model.links[0].records' })
    expect(validateView(golden('pricing')).ok).toBe(true)
  })
})
