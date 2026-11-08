/**
 * PL-21: the View is checked against core's vendored schema before it is installed (`validateView.ts`). Four kinds of response, each
 * refusal paired with a passing contrast: a scenario still drafting, a gated board, a past version, and malformed Views. The page's
 * mode ignores fields the schema does not declare (UI session, 8 Nov: skew must not blank the board) and checks every field it does.
 * The walker is held to Ajv (the validator `client.spec.ts` already trusts) in both modes, on every vendored View and on mutants at
 * every depth: `strict` against core's schema as written; the page's mode against the same schema with its closure lifted, except
 * that inside a union of object shapes a key a sibling shape declares stays refused (`propertyNames`, in Ajv's own reading).
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
const ajvStrict = new Ajv2020({ strict: false }).compile(schema)
/**
 * What the page's mode means, written as a schema Ajv reads: every `additionalProperties: false` lifted, except that an object shape
 * inside an `anyOf`/`oneOf` of two or more object shapes refuses the keys its siblings declare and it does not.
 */
type Node = Record<string, unknown>
const isNode = (n: unknown): n is Node => n !== null && typeof n === 'object' && !Array.isArray(n)
function opened(n: unknown, siblingOnly: string[] | null = null): unknown {
  if (Array.isArray(n)) return n.map((x) => opened(x))
  if (!isNode(n)) return n
  const out: Node = {}
  for (const [k, v] of Object.entries(n)) {
    if (k === 'additionalProperties' && v === false) continue
    if ((k === 'anyOf' || k === 'oneOf') && Array.isArray(v)) {
      const shapes = v.filter((b) => isNode(b) && isNode(b.properties))
      const all = new Set(shapes.flatMap((b) => Object.keys((b as Node).properties as Node)))
      out[k] = v.map((b) => (shapes.length > 1 && shapes.includes(b) ? opened(b, [...all].filter((x) => !Object.keys((b as Node).properties as Node).includes(x))) : opened(b)))
      continue
    }
    out[k] = opened(v)
  }
  if (siblingOnly !== null && siblingOnly.length > 0) out.propertyNames = { not: { enum: siblingOnly } }
  return out
}
const ajvOpen = new Ajv2020({ strict: false }).compile(opened(schema) as object)
const MODES = [['strict', ajvStrict], ['ignore', ajvOpen]] as const
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
  it('the ignore-mode oracle holds for this schema: every object shape inside a union is closed (Codex round 2 nit)', () => {
    let sites = 0
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) { n.forEach(walk); return }
      if (!isNode(n)) return
      for (const k of ['anyOf', 'oneOf'] as const) {
        const shapes = Array.isArray(n[k]) ? (n[k] as unknown[]).filter((b) => isNode(b) && isNode(b.properties)) : []
        if (shapes.length > 1) { sites += 1; for (const b of shapes) expect((b as Node).additionalProperties).toBe(false) }
      }
      Object.values(n).forEach(walk)
    }
    walk(schema)
    expect(sites).toBeGreaterThanOrEqual(8) // 7 object anyOfs + the tagged row oneOf at core 6192ad6b
  })

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

  for (const [mode, ajv] of MODES) {
    it(`${mode}: on every View vendored in golden/ and fixtures/ (valid and not)`, () => {
      let valid = 0
      for (const f of files) {
        const v = JSON.parse(readFileSync(f, 'utf8'))
        const ours = validateView(v, mode).ok
        expect({ f, ours }).toEqual({ f, ours: ajv(v) })
        if (ours) valid += 1
      }
      expect(files.length).toBeGreaterThanOrEqual(20)
      expect(valid).toBeGreaterThanOrEqual(GOLDEN.length) // both verdicts occur
      expect(valid).toBeLessThan(files.length)
    })
  }

  for (const [mode, ajv] of MODES) it(`${mode}: on mutants at every depth of each golden: an unknown key, a dropped key, a wrong type`, () => {
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
          const ours = validateView(v, mode).ok
          expect({ n, path: path.join('.'), mutate, ours }).toEqual({ n, path: path.join('.'), mutate, ours: ajv(v) })
          if (ours) accepted += 1; else rejected += 1
        }
      }
    }
    // Magnitude, not just presence: hundreds of mutants, and both verdicts among them (a dropped optional key, a retyped nullable).
    expect(rejected).toBeGreaterThan(mode === 'strict' ? 300 : 100)
    expect(accepted).toBeGreaterThan(mode === 'strict' ? 0 : 100) // the page's mode accepts every unknown-key mutant
  })
})

/**
 * `draft` (core API v1.24, save first) is checked exactly as far as the vendored schema declares it. Before core's schema with it is
 * vendored, a drafted scenario is still drawn (the field is ignored); after, a draft of the wrong shape is refused at the draft.
 */
describe('a scenario still drafting', () => {
  const declares = Object.prototype.hasOwnProperty.call((schema.properties ?? {}) as object, 'draft')
  const drafted = (draft: unknown) => ({ ...golden('pricing'), draft })
  for (const status of ['drafting', 'done', 'failed', 'lost'] as const) {
    it(`draft ${status}, as core serves it: accepted`, () => {
      expect(validateView(drafted({ status, reason: status === 'failed' ? 'Olumi could not finish the draft.' : null, at: '2026-11-08T02:00:00.000Z' }))).toEqual({ ok: true })
    })
  }
  it(`a draft of a shape core does not serve: ${declares ? 'refused at the draft' : 'ignored until core\'s schema declaring `draft` is vendored'}`, () => {
    const paused = refused(validateView(drafted({ status: 'paused', reason: null, at: '2026-11-08T02:00:00.000Z' })))
    const timeless = refused(validateView(drafted({ status: 'drafting', reason: null })))
    expect([paused, timeless]).toEqual(declares ? [{ ok: false, at: '$.draft.status' }, { ok: false, at: '$.draft.at' }] : [{ ok: true }, { ok: true }])
    const pausedStrict = refused(validateView(drafted({ status: 'paused', reason: null, at: '2026-11-08T02:00:00.000Z' }), 'strict'))
    expect(pausedStrict).toEqual({ ok: false, at: declares ? '$.draft.status' : '$.draft' })
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
  it('three levels down: a field this page does not know is ignored, a known field of the wrong kind is refused there', () => {
    const x = v()
    const c = x.model.cards.findIndex((k: { rows: unknown[] }) => k.rows.length > 0)
    expect(c).toBeGreaterThanOrEqual(0)
    x.model.cards[c].rows[0].zz_new = 1
    expect(validateView(x)).toEqual({ ok: true })
    expect(refused(validateView(x, 'strict'))).toEqual({ ok: false, at: `$.model.cards[${c}].rows[0].zz_new` })
    x.model.cards[c].rows[0].kind = 7
    expect(refused(validateView(x))).toEqual({ ok: false, at: `$.model.cards[${c}].rows[0].kind` })
  })
  it('a nested field of the wrong kind: a card\'s heading as a number', () => {
    const x = v(); x.model.cards[1].heading = 42
    expect(refused(validateView(x))).toEqual({ ok: false, at: '$.model.cards[1].heading' })
    expect(refused(validateView(x, 'strict'))).toEqual({ ok: false, at: '$.model.cards[1].heading' })
  })
  it('a link\'s removal in another shape than core\'s `{ record, part }`', () => {
    const x = golden('studio')
    const i = x.model.links.findIndex((l: { remove: unknown }) => l.remove !== null)
    expect(i).toBeGreaterThanOrEqual(0)
    x.model.links[i].remove = { record: x.model.links[i].remove.record }
    expect(refused(validateView(x))).toEqual({ ok: false, at: `$.model.links[${i}].remove.part` })
  })
})

/**
 * Core PR 7 (06194550) adds `links[].records`, required. It is consumed by re-vendoring core's schema with PR 7's merge, never
 * written into this page. These rows bind the mechanism, not PR 7's absence; like client.spec.ts, they assume the goldens are
 * re-vendored from the same core as the schema (a golden older than its schema lacks the newly required field).
 */
describe('a link is checked by the schema core vendored, field by field', () => {
  it('a link field the schema does not declare is ignored (refused only in strict); a declared link field of the wrong kind is refused', () => {
    const x = golden('pricing')
    x.model.links[0].zz_not_a_link_field = ['r_1']
    expect(validateView(x)).toEqual({ ok: true })
    expect(refused(validateView(x, 'strict'))).toEqual({ ok: false, at: '$.model.links[0].zz_not_a_link_field' })
    x.model.links[0].title = 7
    expect(refused(validateView(x))).toEqual({ ok: false, at: '$.model.links[0].title' })
  })
})

/**
 * Skew: core serves a field before this page's schema declares it (n2c's `strategy`, `marks`, a badge's `words` and `icon`, before
 * the re-vendor). Bound by names no schema declares, never by a real field's current absence, so the row holds after any re-vendor.
 */
describe('a core newer than this page (skew) still draws what the page knows', () => {
  it('fields this schema does not declare, at the top, on a card and on its badge, are ignored, not refused', () => {
    const declared = (n: unknown, k: string) => isNode(n) && isNode(n.properties) && Object.prototype.hasOwnProperty.call(n.properties, k)
    expect(declared(schema, 'zz_core_added_later')).toBe(false)
    const x = { ...golden('pricing'), zz_core_added_later: { key: 'growth' } }
    const b = x.model.cards.findIndex((k: { badge: unknown }) => k.badge !== null && k.badge !== undefined)
    expect(b).toBeGreaterThanOrEqual(0)
    x.model.cards[b].zz_core_added_later = []
    Object.assign(x.model.cards[b].badge, { zz_words_later: 'two records', zz_icon_later: '◆' })
    expect(validateView(x)).toEqual({ ok: true })
    expect(validateView(x, 'strict').ok).toBe(false)
  })
})

describe('where a value may take one of several shapes, it cannot pass as one while the page reads it as another (Codex, 8 Nov)', () => {
  const union = { anyOf: [
    { type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false },
    { type: 'object', properties: { b: { type: 'number' } }, required: ['b'], additionalProperties: false },
  ] }
  it('a key a sibling shape declares is refused there; a key no shape declares is ignored', () => {
    expect(refused(checkAgainst(union, { a: 'x', b: 'bad' }, '$', 'ignore'))).toEqual({ ok: false, at: '$.b' })
    expect(checkAgainst(union, { a: 'x', z: 1 }, '$', 'ignore').ok).toBe(true)
    expect(checkAgainst(union, { b: 2 }, '$', 'ignore').ok).toBe(true)
  })
  it('a chat answer part with text and a cite of the wrong kind is refused (ViewChat draws any part with `cite` as a citation)', () => {
    const x = golden('proposal')
    expect(Array.isArray(x.chat[0].answer.answer)).toBe(true)
    expect(validateView(x)).toEqual({ ok: true })
    x.chat[0].answer.answer = [{ text: 'hello', cite: 7 }]
    expect(refused(validateView(x))).toEqual({ ok: false, at: '$.chat[0].answer.answer[0].cite' })
  })
  it('a boolean subschema is not read: refused, never passed through', () => {
    expect(refused(checkAgainst({ type: 'array', items: true as unknown as SchemaNode }, [1]))).toEqual({ ok: false, at: '$' })
    expect(refused(checkAgainst({ type: 'object', properties: { a: true } }, { a: 1 }))).toEqual({ ok: false, at: '$.a' })
  })
})
