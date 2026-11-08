/**
 * The View is checked against core's own published schema before the page installs it (F6, plan row PL-21; PL review 8 Nov:
 * "validate nested View payloads before they are installed"). Until now `readView` checked only the top-level `schema` string and
 * then cast: a View missing a nested field, or carrying one of the wrong kind, was drawn as far as it went. With the check wired at
 * the entry (`client.ts` readView; held for the UI session, recovery-notes/arch-lane-c), such a View is refused and the person sees
 * plain words, never a half-drawn board (`store.ts` keeps what it last drew).
 *
 * One contract, never a fork: this walks the vendored copy of core `schema/view.v3.json` (`./view.v3.json`), the same file
 * `scripts/olumi-view/gen-types.mjs` turns into `types.ts`, with exactly the keywords that generator accepts. Change core's schema,
 * re-vendor it, and both the types and this check follow.
 *
 * A field this page does not know is IGNORED, never refused (UI session, 8 Nov): core adds fields before this page is re-vendored
 * (core n2c serves `strategy`, `badge.words`, `badge.icon`, `marks`), and skew must mean the page leaves out what it cannot draw,
 * not a blank board. Every field the schema declares is still checked: present when required, of its declared kind. One limit
 * on "unknown" (Codex check, 8 Nov): where a value may take one of several object shapes (`anyOf`/`oneOf`), a key another of those
 * shapes declares is not unknown. It is refused, so a value cannot pass as one shape while the page reads it as another (a chat
 * answer part carrying `cite` is drawn as a citation, ViewChat.tsx:62, whatever else it passed as). Core's own closure
 * (`additionalProperties: false`) is kept in `strict` mode. The spec holds both modes to Ajv. Deliberately stricter than Ajv: a
 * number must be finite (`1e400` parses to Infinity), and a boolean subschema (`true`/`false`) is not read; core's schema has none.
 *
 * Why not Ajv at run time: compiling a schema needs `new Function`, which the page's CSP refuses (`scripts/generate-validators.mjs`),
 * and Ajv's precompiled standalone code for this schema is 712 KB (72 KB gzipped). This walker is about 100 lines and reads the
 * schema as data. `__tests__/validateView.spec.ts` holds it to Ajv on every vendored View and on mutants, in both modes.
 */
import schemaJson from './view.v3.json'

/** One JSON Schema node, as core's schema writes them. */
export type SchemaNode = { readonly [keyword: string]: unknown }

/** Valid, or the first place it is not: a path like `$.model.cards[3].rows[0]` and what is wrong there (for the console, not for the person). */
export type Checked = { readonly ok: true } | { readonly ok: false; readonly at: string; readonly why: string }

/** Exactly `gen-types.mjs`'s KEYWORDS: a keyword outside this set in a re-vendored schema fails every check, never passes silently. */
export const SUPPORTED_KEYWORDS: ReadonlySet<string> = new Set(['$schema', 'type', 'properties', 'required', 'additionalProperties', 'items', 'anyOf', 'oneOf', 'const', 'enum'])

const OK: Checked = { ok: true }
const no = (at: string, why: string): Checked => ({ ok: false, at, why })
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const key = (at: string, k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? `${at}.${k}` : `${at}[${JSON.stringify(k)}]`)

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]))
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a), kb = Object.keys(b)
    return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]))
  }
  return false
}

function isType(v: unknown, t: unknown): boolean | null {
  switch (t) {
    case 'string': return typeof v === 'string'
    case 'number': return typeof v === 'number' && Number.isFinite(v)
    case 'integer': return Number.isInteger(v)
    case 'boolean': return typeof v === 'boolean'
    case 'null': return v === null
    case 'array': return Array.isArray(v)
    case 'object': return isObject(v)
    default: return null
  }
}

/** Of several branches' failures, the one that got furthest into the value: the most useful line to log. */
function deepest(fails: readonly Checked[], at: string, keyword: string): Checked {
  let best: Checked = no(at, `matches none of the schema's "${keyword}" shapes`), depth = -1
  for (const f of fails) if (!f.ok && f.at.length > depth) { best = f; depth = f.at.length }
  return best
}

/** `ignore`: a field the schema does not declare is left out of the check (the page's mode). `strict`: refused, as core's schema says. */
export type UnknownFields = 'ignore' | 'strict'

/** Where a value may take one of two or more object shapes: every key any of them declares (none is "unknown" there). */
function unionKeys(branches: readonly unknown[]): ReadonlySet<string> | undefined {
  const keys = new Set<string>()
  let shapes = 0
  for (const b of branches) if (isObject(b) && isObject(b.properties)) { shapes += 1; for (const k of Object.keys(b.properties)) keys.add(k) }
  return shapes > 1 ? keys : undefined
}

/** Checks `v` against one schema node. Every keyword present applies (JSON Schema's conjunction); unknown keywords fail. */
export function checkAgainst(s: SchemaNode, v: unknown, at = '$', fields: UnknownFields = 'strict', siblings?: ReadonlySet<string>): Checked {
  if (!isObject(s)) return no(at, 'the schema here is not an object, which this check does not read')
  for (const k of Object.keys(s)) if (!SUPPORTED_KEYWORDS.has(k)) return no(at, `the schema uses "${k}", which this check does not read`)

  if ('const' in s && !same(v, s.const)) return no(at, `is not ${JSON.stringify(s.const)}`)
  if (s.enum !== undefined) {
    if (!Array.isArray(s.enum)) return no(at, 'the schema\'s "enum" is not a list')
    if (!s.enum.some((e) => same(v, e))) return no(at, `is not one of ${JSON.stringify(s.enum)}`)
  }
  if (s.type !== undefined) {
    const types: unknown[] = Array.isArray(s.type) ? s.type : [s.type]
    const verdicts = types.map((t) => isType(v, t))
    if (verdicts.includes(null)) return no(at, `the schema's type ${JSON.stringify(s.type)} is not one this check reads`)
    if (!verdicts.includes(true)) return no(at, `is not ${types.join(' or ')}`)
  }
  if (s.anyOf !== undefined) {
    if (!Array.isArray(s.anyOf)) return no(at, 'the schema\'s "anyOf" is not a list')
    const fails: Checked[] = []
    let passed = false
    const shapes = unionKeys(s.anyOf)
    for (const branch of s.anyOf as SchemaNode[]) { const r = checkAgainst(branch, v, at, fields, shapes); if (r.ok) { passed = true; break } fails.push(r) }
    if (!passed) return deepest(fails, at, 'anyOf')
  }
  if (s.oneOf !== undefined) {
    if (!Array.isArray(s.oneOf)) return no(at, 'the schema\'s "oneOf" is not a list')
    const shapes = unionKeys(s.oneOf)
    const results = (s.oneOf as SchemaNode[]).map((branch) => checkAgainst(branch, v, at, fields, shapes))
    let passes = 0
    for (const r of results) if (r.ok) passes += 1
    if (passes === 0) return deepest(results, at, 'oneOf')
    if (passes > 1) return no(at, `matches ${passes} of the schema's "oneOf" shapes, not exactly one`)
  }
  if (Array.isArray(v) && s.items !== undefined) {
    if (!isObject(s.items)) return no(at, 'the schema\'s "items" is not one schema')
    for (let i = 0; i < v.length; i += 1) { const r = checkAgainst(s.items, v[i], `${at}[${i}]`, fields); if (!r.ok) return r }
  }
  if (isObject(v)) {
    if (s.required !== undefined) {
      if (!Array.isArray(s.required)) return no(at, 'the schema\'s "required" is not a list')
      for (const k of s.required as string[]) if (!Object.prototype.hasOwnProperty.call(v, k)) return no(key(at, k), 'is missing')
    }
    const props = (s.properties ?? {}) as Record<string, SchemaNode>
    if (!isObject(props)) return no(at, 'the schema\'s "properties" is not an object')
    const extra = s.additionalProperties
    for (const k of Object.keys(v)) {
      if (Object.prototype.hasOwnProperty.call(props, k)) { const r = checkAgainst(props[k], v[k], key(at, k), fields); if (!r.ok) return r; continue }
      if (extra === false) {
        if (fields === 'strict') return no(key(at, k), 'is not in the schema')
        if (siblings?.has(k)) return no(key(at, k), 'belongs to another of the shapes the schema allows here')
        continue
      }
      if (isObject(extra)) { const r = checkAgainst(extra, v[k], key(at, k), fields); if (!r.ok) return r }
    }
  }
  return OK
}

const VIEW_SCHEMA_NODE = schemaJson as unknown as SchemaNode

/** The View as core served it, checked against the vendored core schema; fields it does not declare are ignored unless `strict`. */
export const validateView = (v: unknown, fields: UnknownFields = 'ignore'): Checked => checkAgainst(VIEW_SCHEMA_NODE, v, '$', fields)
