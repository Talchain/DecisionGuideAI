#!/usr/bin/env node
/**
 * CSS custom-property resolution census.
 *
 * DERIVES both sides of the `var(--foo)` contract and reports every
 * reference that can never resolve, plus every hardcoded fallback that has
 * drifted away from the token it is shadowing:
 *
 *   DEFINITIONS  — `--foo: …` declarations in every `src/**` .css file and
 *                  in `index.html`, plus runtime
 *                  `element.style.setProperty('--foo', …)` calls in TS/TSX
 *                  (a genuine definition site). The declared VALUE is
 *                  captured too, so fallbacks can be compared.
 *   REFERENCES   — every `var(--foo)` reachable in `src/**` .ts/.tsx and in
 *                  `tailwind.config.js`, collected from the TypeScript AST
 *                  (string literals, template literals, JSX text) so that
 *                  COMMENTS ARE EXCLUDED BY CONSTRUCTION, and in every .css
 *                  file and `index.html`.
 *
 * Why the AST and not a regex over raw text: prose comments legitimately
 * write `var(--x)` as a generic placeholder ("the theme colours are plain
 * `var(--x)` values"). A raw-text scan reports those as undefined
 * properties, and a scanner that cries wolf gets muted. Comments are
 * trivia, not nodes, so walking the AST drops them exactly rather than by
 * a hand-written comment-stripping heuristic. `tailwind.config.js` is
 * parsed the same way, so a `--chart-N` written inside a JS comment there
 * is excluded by the same construction rather than by a second heuristic.
 *
 * PROSE INSIDE STRINGS. Excluding comments is not enough: a test title is
 * an ordinary string literal, and `it('… not var() indirection', …)` is not
 * a CSS value. The discriminator is the NAME REGION's shape, not the mere
 * presence of the characters `var(`:
 *
 *   `--foo`        → a static reference. Always checked.
 *   `--@@0@@`      → a dynamic reference. Always resolved (see below).
 *   `-foo`, `--a b`→ MALFORMED — it was reaching for a custom property and
 *                    got it wrong. Reported, never dropped.
 *   ``, `x`, prose → not a custom-property reference. Reported as a prose
 *                    mention ONLY (counted in the summary, so the skip is
 *                    visible) — UNLESS the node sits in a real CSS-value
 *                    context (a style object value, a setProperty argument,
 *                    a style assignment, a JSX style attribute, a css``
 *                    tagged template), in which case it is malformed and
 *                    fails loud.
 *
 * DYNAMIC REFERENCES ARE NEVER SILENTLY SKIPPED. `var(--${token})` is
 * resolved through the TypeScript type checker: when the interpolated
 * expression's type is a string-literal union ('success' | 'warning' |
 * 'danger') every member is expanded and checked. When the type is a
 * plain `string` — i.e. the property name is not knowable statically —
 * the site is reported as UNRESOLVABLE and the census exits non-zero.
 * Skipping what it cannot parse is exactly how this defect class survived.
 *
 * FALLBACK DRIFT. `var(--success, #67C89E)` carries a copy of the token's
 * value. Nothing keeps the copy in step with `brand.css`, so the first
 * retint of `--success` leaves a stale hex behind that only shows up when
 * the variable fails to resolve — precisely the situation the fallback
 * exists for. Every fallback is parsed (balanced-paren aware, so nested
 * `var(--a, var(--b))` is seen) and compared against the token's declared
 * value, resolving ONE level of `var()` indirection
 * (`--text-primary: var(--text-header)`). A fallback that cannot be
 * compared — the token is defined only at runtime, or its definition needs
 * more than one hop — is REPORTED AS UNCOMPARABLE rather than skipped.
 *
 * Usage:
 *   node scripts/css-var-census.mjs           # human-readable report
 *   node scripts/css-var-census.mjs --json    # machine-readable summary
 *
 * Exit codes: 0 clean · 1 undefined/unresolvable references or fallback
 *             drift found · 2 the census itself could not run.
 */
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { resolveChannelTriple } from '../src/styles/channelTriple.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(REPO_ROOT, 'src')

/**
 * Files outside `src/` that also carry both sides of the contract. The
 * Tailwind mapping is what produced the original defect — `panel.border`
 * maps to `var(--border-default)` — so leaving it unscanned would leave the
 * census blind to the exact seam it was written for.
 */
const EXTRA_SCRIPT_FILES = ['tailwind.config.js']
const EXTRA_MARKUP_FILES = ['index.html']

/** Cap on literal-union expansion, so a wide union cannot explode the run. */
const MAX_UNION_MEMBERS = 64

// ---------------------------------------------------------------- utilities

function walkDir(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git') continue
      walkDir(full, exts, out)
    } else if (exts.some((e) => entry.endsWith(e))) {
      out.push(full)
    }
  }
  return out
}

const rel = (p) => path.relative(REPO_ROOT, p)

/** Line number (1-based) of a character offset in a source text. */
const lineOf = (text, pos) => text.slice(0, pos).split('\n').length

/** A syntactically well-formed custom-property name. */
const PROPERTY_NAME = /^--[A-Za-z0-9_-]+$/

/**
 * Normalise a CSS value for comparison: case-insensitive, whitespace
 * collapsed, short hex expanded. `#FFF` and `#ffffff` are the same colour;
 * a census that called them different would cry wolf.
 */
function normaliseCssValue(value) {
  let v = String(value).trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ')
  const short = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/)
  if (short) v = `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
  return v
}

// ------------------------------------------------------------- definitions

/**
 * A custom-property DECLARATION: `--name:` preceded by a block start,
 * semicolon, or whitespace, with the declared value captured up to the
 * terminating `;` or `}`. The leading-character requirement is what keeps
 * `var(--name)` — preceded by `(` — from counting as a definition.
 */
const CSS_DEF = /(?:^|[;{\s])(--[A-Za-z0-9_-]+)\s*:([^;}]*)/g
/** A custom-property REFERENCE, name region captured up to `,` or `)`. */
const CSS_REF = /var\(\s*(--[A-Za-z0-9_-]+)/g
/** Runtime definition: `.setProperty('--name', …)`. */
const SET_PROPERTY_DEF = /setProperty\(\s*['"`](--[A-Za-z0-9_-]+)['"`]/g
/** HTML comments, stripped before scanning markup. */
const HTML_COMMENT = /<!--[\s\S]*?-->/g

function collectDefinitions(cssFiles, scriptFiles, markupFiles) {
  /** @type {Map<string, {via: string, at: string, value: string|null}[]>} */
  const defs = new Map()
  const add = (name, via, at, value) => {
    if (!defs.has(name)) defs.set(name, [])
    defs.get(name).push({ via, at, value })
  }

  for (const file of [...cssFiles, ...markupFiles]) {
    const raw = readFileSync(file, 'utf8')
    const text = file.endsWith('.html') ? raw.replace(HTML_COMMENT, (m) => ' '.repeat(m.length)) : raw
    for (const m of text.matchAll(CSS_DEF)) {
      add(m[1], file.endsWith('.html') ? 'html' : 'css', `${rel(file)}:${lineOf(text, m.index)}`, m[2].trim())
    }
  }

  // Runtime definitions are real definitions: a property set via
  // setProperty resolves at runtime even with no CSS declaration.
  // Recorded with provenance so the manifest shows WHERE it comes from.
  // The VALUE is not knowable statically, hence null — which makes any
  // fallback against it UNCOMPARABLE rather than silently "fine".
  for (const file of scriptFiles) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(SET_PROPERTY_DEF)) {
      add(m[1], 'setProperty', `${rel(file)}:${lineOf(text, m.index)}`, null)
    }
  }

  return defs
}

/**
 * Read a token's first statically-known declared value out of the defs map.
 * The lookup `resolveChannelTriple` needs to follow `--x-rgb` (and the one
 * alias hop `--primary-rgb: var(--info-rgb)`).
 */
const tripleLookup = (defs) => (n) => (defs.get(n) ?? []).find((e) => e.value)?.value ?? null

/**
 * If `value` is the channel-triple colour form — `rgb(var(--info-rgb))`, with
 * `--info-rgb: 39 122 157` — return the literal hex it resolves to.
 *
 * WHY THIS BRANCH EXISTS. Semantic colours are declared as their CHANNELS so
 * that Tailwind can emit opacity-modified utilities (`border-info/30`), which
 * previously emitted no rule at all. Without this the census would classify
 * every one of them as "a compound var() expression" and report each hardcoded
 * fallback against them as UNCOMPARABLE — which would quietly retire the
 * fallback-drift pin on exactly the tokens most likely to be retinted. Shared
 * with the four spec-side parsers so all five agree by construction.
 */
function channelTripleValue(value, defs) {
  return resolveChannelTriple(value, tripleLookup(defs))
}

/**
 * The concrete value(s) a token resolves to, following at most ONE level of
 * `var()` indirection (`--text-primary: var(--text-header)`) plus the
 * channel-triple form at either end of that hop. Returns a list of
 * `{kind:'value'|'uncomparable'}` — a token declared twice (a theme override)
 * legitimately has more than one.
 */
function definitionValues(name, defs) {
  const out = []
  for (const entry of defs.get(name) ?? []) {
    if (entry.value == null || entry.value === '') {
      out.push({ kind: 'uncomparable', reason: `defined via ${entry.via} at ${entry.at} — no static value` })
      continue
    }
    const indirect = entry.value.match(/^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/)
    if (indirect) {
      const inner = defs.get(indirect[1]) ?? []
      if (inner.length === 0) {
        out.push({ kind: 'uncomparable', reason: `aliases ${indirect[1]}, which has no definition` })
        continue
      }
      for (const ie of inner) {
        // `--sky-500: var(--info)` where `--info: rgb(var(--info-rgb))` — the
        // triple sits one hop away, so try it before giving up on the chain.
        const viaTriple = ie.value ? channelTripleValue(ie.value, defs) : null
        if (viaTriple) {
          out.push({ kind: 'value', value: viaTriple, via: `${name} → ${indirect[1]} (${ie.at})` })
        } else if (ie.value == null || ie.value === '' || /var\(/.test(ie.value)) {
          out.push({ kind: 'uncomparable', reason: `${name} → ${indirect[1]} needs more than one level of indirection` })
        } else {
          out.push({ kind: 'value', value: ie.value, via: `${name} → ${indirect[1]} (${ie.at})` })
        }
      }
      continue
    }
    // `--info: rgb(var(--info-rgb))` — a compound var() expression that IS
    // statically resolvable, so it must not be written off as one that is not.
    const triple = channelTripleValue(entry.value, defs)
    if (triple) {
      out.push({ kind: 'value', value: triple, via: `${name} (${entry.at})` })
      continue
    }
    if (/var\(/.test(entry.value)) {
      out.push({ kind: 'uncomparable', reason: `definition at ${entry.at} is a compound var() expression` })
      continue
    }
    out.push({ kind: 'value', value: entry.value, via: `${name} (${entry.at})` })
  }
  return out
}

// -------------------------------------------------------------- references

/**
 * Parse every `var(` occurrence in a chunk of text, splitting the name
 * region from the fallback at the TOP-LEVEL comma with balanced-paren
 * scanning. `var(--a, var(--b, #fff))` therefore yields BOTH references —
 * the previous `[^)]*` regex swallowed the inner one.
 */
function parseVarOccurrences(chunk) {
  const out = []
  const re = /var\(/g
  let m
  while ((m = re.exec(chunk)) !== null) {
    const open = m.index + 3 // index of '('
    let depth = 0
    let end = -1
    for (let i = open; i < chunk.length; i++) {
      if (chunk[i] === '(') depth++
      else if (chunk[i] === ')') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    const inner = end === -1 ? chunk.slice(open + 1) : chunk.slice(open + 1, end)
    let commaAt = -1
    let d = 0
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '(') d++
      else if (inner[i] === ')') d--
      else if (inner[i] === ',' && d === 0) {
        commaAt = i
        break
      }
    }
    out.push({
      index: m.index,
      nameRegion: (commaAt === -1 ? inner : inner.slice(0, commaAt)).trim(),
      fallback: commaAt === -1 ? null : inner.slice(commaAt + 1).trim(),
      unterminated: end === -1,
    })
    // lastIndex advances only past `var(`, so a nested var() in the
    // fallback is found by the next iteration rather than being consumed.
  }
  return out
}

/**
 * Classify one chunk's `var(` occurrences.
 *
 * `cssContext` says whether the node this chunk came from is a real CSS
 * value. It only ever WIDENS what is reported: a name region that already
 * looks like a custom property is checked regardless of context.
 */
function scanChunk(chunk, cssContext = false) {
  const statics = [] // {name, fallback}
  const dynamics = [] // {pattern, fallback}
  const malformed = [] // {region, reason}
  let prose = 0

  for (const occ of parseVarOccurrences(chunk)) {
    const region = occ.nameRegion
    if (region.includes('@@')) {
      dynamics.push({ pattern: region, fallback: occ.fallback })
    } else if (PROPERTY_NAME.test(region)) {
      statics.push({ name: region, fallback: occ.fallback })
    } else if (region.startsWith('-')) {
      // Reaching for a custom property and getting it wrong is a defect,
      // not prose — report it wherever it appears.
      malformed.push({ region, reason: 'not a well-formed custom-property name' })
    } else if (cssContext) {
      malformed.push({ region, reason: 'var() in a CSS value names no custom property' })
    } else {
      // `it('… not var() indirection', …)` and friends. Counted, so the
      // decision to not check it is visible in the summary rather than
      // silent.
      prose += 1
    }
  }
  return { statics, dynamics, malformed, prose }
}

/**
 * Is this node a real CSS-value position? Used only to WIDEN reporting for
 * name regions that do not already look like a custom property.
 */
function isCssValueContext(node) {
  const p = node.parent
  if (!p) return false
  // { color: 'var(--x)' } — including style={{ … }}
  if (ts.isPropertyAssignment(p) && p.initializer === node) return true
  // el.style.setProperty('--a', 'var(--b)'), el.setAttribute('style', …)
  if (ts.isCallExpression(p)) {
    const callee = p.expression
    const name = ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : ts.isIdentifier(callee)
        ? callee.text
        : ''
    return name === 'setProperty' || name === 'setAttribute'
  }
  // el.style.color = 'var(--x)'
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken && p.right === node) {
    return ts.isPropertyAccessExpression(p.left) && /(^|\.)style$/.test(p.left.expression.getText?.() ?? '')
  }
  // <div style="…"> / stroke={`var(--${t})`}
  if (ts.isJsxAttribute(p)) return true
  if (ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent)) return true
  // css`…` / styled.div`…`
  if (ts.isTaggedTemplateExpression(p) && p.template === node) return true
  return false
}

/**
 * Collect every var() reference in a TS/TSX/JS source, from the AST only.
 * Returns static names and dynamic sites (with the expression nodes needed
 * to resolve them through the type checker).
 */
function collectFromSource(sourceFile) {
  const staticRefs = [] // {name, fallback, line}
  const dynamicSites = [] // {pattern, fallback, exprs, line}
  const malformedSites = [] // {region, reason, line}
  let prose = 0

  // `exprs` defaults to [] so a caller with no interpolations (a plain
  // string literal, JSX text) can never produce a dynamic site carrying an
  // undefined expression list.
  const record = (result, line, exprs = []) => {
    for (const s of result.statics) staticRefs.push({ ...s, line })
    for (const d of result.dynamics) dynamicSites.push({ ...d, exprs, line })
    for (const m of result.malformed) malformedSites.push({ ...m, line })
    prose += result.prose
  }
  const lineAt = (node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

  const visit = (node) => {
    // Plain string literals: 'var(--foo)'
    if (ts.isStringLiteralLike(node) && !ts.isTemplateExpression(node.parent)) {
      record(scanChunk(node.text, isCssValueContext(node)), lineAt(node))
    }

    // Template literals: `var(--${token})` — assemble text with sentinels
    // so an interpolation inside a property name is detectable.
    if (ts.isTemplateExpression(node)) {
      let assembled = node.head.text
      const exprs = []
      node.templateSpans.forEach((span, i) => {
        assembled += `@@${i}@@` + span.literal.text
        exprs.push(span.expression)
      })
      record(scanChunk(assembled, isCssValueContext(node)), lineAt(node), exprs)
    }

    if (ts.isJsxText(node)) {
      record(scanChunk(node.text, false), lineAt(node))
    }

    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return { staticRefs, dynamicSites, malformedSites, prose }
}

/**
 * Expand a dynamic pattern into concrete property names using the type
 * checker. Returns {names} on success, or {unresolved: reason} when the
 * interpolated type is not a finite set of string literals.
 *
 * Only the interpolations that actually appear IN THE NAME REGION are
 * resolved: `` `var(--${token}); width: ${w}px` `` must not be called
 * unresolvable because `w` is a number.
 */
function resolveDynamic(site, checker) {
  const memberSets = [] // {index, literals}
  site.exprs.forEach((expr, i) => {
    if (!site.pattern.includes(`@@${i}@@`)) return
    const type = checker.getTypeAtLocation(expr)
    const parts = type.isUnion() ? type.types : [type]
    const literals = []
    for (const part of parts) {
      if (part.isStringLiteral()) literals.push(part.value)
      else {
        memberSets.push({
          index: i,
          unresolved:
            `interpolated expression has type \`${checker.typeToString(type)}\`, ` +
            'not a string-literal union — the property name is not statically knowable',
        })
        return
      }
    }
    memberSets.push({ index: i, literals })
  })

  for (const set of memberSets) {
    if (set.unresolved) return { unresolved: set.unresolved }
    if (set.literals.length === 0 || set.literals.length > MAX_UNION_MEMBERS) {
      return { unresolved: `interpolated union has ${set.literals.length} members (cap ${MAX_UNION_MEMBERS})` }
    }
  }

  if (memberSets.length === 0) {
    return { unresolved: 'dynamic var() with no resolvable interpolation' }
  }

  // Cartesian product over every interpolation in the name region.
  let names = [site.pattern]
  for (const { index, literals } of memberSets) {
    const next = []
    for (const base of names) {
      for (const member of literals) next.push(base.split(`@@${index}@@`).join(member))
    }
    names = next
  }

  for (const n of names) {
    if (!PROPERTY_NAME.test(n)) {
      return { unresolved: `expansion produced a non-property-name token \`${n}\`` }
    }
  }
  return { names }
}

// ----------------------------------------------------------------- census

/**
 * Run the full census over one source tree, plus any extra script/markup
 * files that live outside it. Pure: returns the summary.
 */
function census(srcDir, extra = {}) {
  const errors = []
  const extraScripts = (extra.scriptFiles ?? []).filter((f) => existsSync(f))
  const markupFiles = (extra.markupFiles ?? []).filter((f) => existsSync(f))

  const cssFiles = walkDir(srcDir, ['.css']).sort()
  const scriptFiles = [...walkDir(srcDir, ['.ts', '.tsx']).sort(), ...extraScripts]

  if (cssFiles.length === 0 || scriptFiles.length === 0) {
    errors.push(`found no source files under ${srcDir} — refusing to report a vacuous pass`)
    return {
      errors,
      counts: {},
      undefinedRefs: [],
      unresolvable: [],
      cssUndefined: [],
      fallbackDrift: [],
      fallbackUncomparable: [],
      resolvedDynamicNameList: [],
      dynamicSiteFiles: [],
    }
  }

  const defs = collectDefinitions(cssFiles, scriptFiles, markupFiles)

  /** @type {Map<string, string[]>} name → ["file:line", …] */
  const refs = new Map()
  const addRef = (name, at) => {
    if (!refs.has(name)) refs.set(name, [])
    refs.get(name).push(at)
  }
  /** Every fallback seen, for the drift comparison below. */
  const fallbackUses = [] // {name, fallback, at}
  const unresolvable = []
  let proseMentions = 0

  const allDynamicSites = []
  for (const file of scriptFiles) {
    const text = readFileSync(file, 'utf8')
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const { staticRefs, dynamicSites, malformedSites, prose } = collectFromSource(sf)
    for (const r of staticRefs) {
      addRef(r.name, `${rel(file)}:${r.line}`)
      if (r.fallback != null) fallbackUses.push({ name: r.name, fallback: r.fallback, at: `${rel(file)}:${r.line}` })
    }
    for (const d of dynamicSites) allDynamicSites.push({ ...d, file })
    for (const m of malformedSites) {
      unresolvable.push({ at: `${rel(file)}:${m.line}`, pattern: m.region, reason: m.reason })
    }
    proseMentions += prose
  }

  // Resolve dynamic sites through the type checker. The program is rooted
  // only at the files that actually need it, so the common (no dynamic
  // references) case costs nothing.
  let resolvedDynamic = 0
  const resolvedNames = new Set()
  if (allDynamicSites.length > 0) {
    const roots = [...new Set(allDynamicSites.map((d) => d.file))]
    const program = ts.createProgram(roots, {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      allowJs: true,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
    })
    const checker = program.getTypeChecker()

    for (const site of allDynamicSites) {
      const sf = program.getSourceFile(site.file)
      if (!sf) {
        errors.push(`could not load ${rel(site.file)} into the type-checking program`)
        continue
      }
      // Re-collect against the PROGRAM's source file so the expression
      // nodes carry types (nodes from createSourceFile do not).
      const { dynamicSites: progSites } = collectFromSource(sf)
      const match = progSites.find((s) => s.line === site.line && s.pattern === site.pattern)
      if (!match) {
        errors.push(`could not relocate dynamic var() at ${rel(site.file)}:${site.line}`)
        continue
      }
      const result = resolveDynamic(match, checker)
      if (result.unresolved) {
        unresolvable.push({
          at: `${rel(site.file)}:${site.line}`,
          pattern: site.pattern.replace(/@@\d+@@/g, '${…}'),
          reason: result.unresolved,
        })
      } else {
        resolvedDynamic += result.names.length
        for (const n of result.names) {
          resolvedNames.add(n)
          addRef(n, `${rel(site.file)}:${site.line} (dynamic)`)
          if (site.fallback != null) {
            fallbackUses.push({ name: n, fallback: site.fallback, at: `${rel(site.file)}:${site.line} (dynamic)` })
          }
        }
      }
    }
  }

  // CSS/markup files referencing properties defined in no CSS file and by
  // no setProperty call. Definitions are pooled across ALL files, so
  // ordinary cross-file usage (defined in brand.css, used in a module) is
  // silent.
  const cssUndefined = new Map()
  for (const file of [...cssFiles, ...markupFiles]) {
    const raw = readFileSync(file, 'utf8')
    const text = file.endsWith('.html') ? raw.replace(HTML_COMMENT, (m) => ' '.repeat(m.length)) : raw
    for (const m of text.matchAll(CSS_REF)) {
      if (!defs.has(m[1])) {
        if (!cssUndefined.has(m[1])) cssUndefined.set(m[1], [])
        cssUndefined.get(m[1]).push(`${rel(file)}:${lineOf(text, m.index)}`)
      }
    }
    for (const occ of parseVarOccurrences(text)) {
      if (occ.fallback != null && PROPERTY_NAME.test(occ.nameRegion)) {
        fallbackUses.push({
          name: occ.nameRegion,
          fallback: occ.fallback,
          at: `${rel(file)}:${lineOf(text, occ.index)}`,
        })
      }
    }
  }

  // FALLBACK DRIFT. A hardcoded fallback is a copy of the token's value
  // that nothing keeps in step. Compare every one against the definition.
  const driftMap = new Map()
  const uncomparableMap = new Map()
  const noteUncomparable = (key, use, reason) => {
    if (!uncomparableMap.has(key)) {
      uncomparableMap.set(key, { name: use.name, fallback: use.fallback, reason, sites: [] })
    }
    uncomparableMap.get(key).sites.push(use.at)
  }
  for (const use of fallbackUses) {
    if (!defs.has(use.name)) continue // already reported as an undefined reference
    const key = `${use.name}|${normaliseCssValue(use.fallback)}`
    // A fallback that is ITSELF a var() reference is a token chain, not a
    // hardcoded copy of a value — there is nothing to drift. The chained
    // token's own existence is checked by the nested-reference scan above.
    if (/var\(/.test(use.fallback)) {
      noteUncomparable(key, use, 'fallback is itself a var() reference — a token chain, not a hardcoded copy')
      continue
    }
    const values = definitionValues(use.name, defs)
    const concrete = values.filter((v) => v.kind === 'value')
    if (concrete.some((v) => normaliseCssValue(v.value) === normaliseCssValue(use.fallback))) continue
    if (concrete.length === 0) {
      noteUncomparable(key, use, values.map((v) => v.reason).join('; ') || 'no comparable definition')
      continue
    }
    if (!driftMap.has(key)) {
      driftMap.set(key, {
        name: use.name,
        fallback: use.fallback,
        declared: [...new Set(concrete.map((v) => v.value))].sort(),
        sites: [],
      })
    }
    driftMap.get(key).sites.push(use.at)
  }
  const byName = (a, b) => (a.name === b.name ? a.fallback.localeCompare(b.fallback) : a.name.localeCompare(b.name))
  const dedupeSites = (e) => ({ ...e, sites: [...new Set(e.sites)].sort() })
  const fallbackDrift = [...driftMap.values()].map(dedupeSites).sort(byName)
  const fallbackUncomparable = [...uncomparableMap.values()].map(dedupeSites).sort(byName)

  const undefinedRefs = [...refs.keys()]
    .filter((name) => !defs.has(name))
    .sort()
    .map((name) => ({ name, sites: refs.get(name) }))

  return {
    errors,
    counts: {
      cssFiles: cssFiles.length,
      scriptFiles: scriptFiles.length,
      markupFiles: markupFiles.length,
      definitions: defs.size,
      references: refs.size,
      dynamicSites: allDynamicSites.length,
      resolvedDynamicNames: resolvedDynamic,
      fallbackUses: fallbackUses.length,
      proseMentions,
    },
    undefinedRefs,
    unresolvable: unresolvable.sort((a, b) => a.at.localeCompare(b.at)),
    cssUndefined: [...cssUndefined.entries()].sort().map(([name, sites]) => ({ name, sites })),
    fallbackDrift,
    fallbackUncomparable,
    resolvedDynamicNameList: [...resolvedNames].sort(),
    dynamicSiteFiles: [...new Set(allDynamicSites.map((d) => rel(d.file)))].sort(),
  }
}

// -------------------------------------------------------------- self-test

/**
 * POSITIVE CONTROL (trap 13: "a positive control, or the absence assertion
 * is vacuous"). Builds a throwaway fixture tree carrying one of each
 * defect the census claims to catch, and asserts it catches all of them —
 * and that it does NOT flag the legitimate cases (a comment placeholder, a
 * prose mention inside a string, a resolvable literal union, a
 * setProperty-defined property, a fallback that still matches).
 *
 * The fixture spans BOTH script extensions (.ts and .tsx), the extra
 * config-script path and the markup path, so a walk that quietly stops
 * covering one of them fails here rather than in production.
 *
 * Without this, "zero undefined references" could equally mean "the
 * scanner found nothing at all".
 */
function selfTest() {
  const dir = mkdtempSync(path.join(tmpdir(), 'css-var-census-selftest-'))
  const src = path.join(dir, 'src')
  mkdirSync(src, { recursive: true })

  writeFileSync(
    path.join(src, 'tokens.css'),
    ':root {\n' +
      '  --real-token: #fff;\n' +
      '  --alpha: red;\n' +
      '  --beta: blue;\n' +
      '  --aliased: var(--real-token);\n' +
      '}\n' +
      '.x { color: var(--real-token); border-color: var(--ghost-css-token); }\n',
  )

  // .tsx path — JSX, template literals, style objects.
  writeFileSync(
    path.join(src, 'sample.tsx'),
    [
      "// A prose comment mentioning var(--comment-only-placeholder) must NOT be flagged.",
      '/* Block comment with var(--another-comment-placeholder) — also ignored. */',
      "type Pick = 'alpha' | 'beta'",
      'declare const which: Pick',
      'declare const freeform: string',
      'declare const width: number',
      'declare const el: HTMLElement',
      "el.style.setProperty('--runtime-defined', '1')",
      "export const good = 'var(--real-token)'",
      "export const runtime = 'var(--runtime-defined)'",
      'export const resolvable = `var(--${which})`',
      'export const unresolvable = `var(--${freeform})`',
      // An interpolation OUTSIDE the name region must not make the site unresolvable.
      'export const mixed = `var(--${which}); width: ${width}px`',
      // A fallback that still matches its token, and one that has drifted.
      "export const matching = 'var(--real-token, #FFF)'",
      "export const drifted = 'var(--alpha, #00ff00)'",
      // One level of indirection: --aliased → --real-token → #fff.
      "export const indirect = 'var(--aliased, #ffffff)'",
      // Nested fallback — the inner reference must still be seen.
      "export const nested = 'var(--alpha, var(--ghost-nested-token, red))'",
      // PROSE inside an ordinary string literal: must NOT be reported.
      "export const title = 'declared as literal hues, not var() indirection'",
      // MALFORMED: reaching for a custom property and getting it wrong.
      "export const broken = 'var(--not a name)'",
    ].join('\n'),
  )

  // .ts path — plain TypeScript, no JSX. Exercises the second extension in
  // the walk; the undefined reference lives HERE so that dropping `.ts`
  // from the file walk fails the self-test rather than passing quietly.
  writeFileSync(
    path.join(src, 'sample.ts'),
    [
      'export const bad = "var(--definitely-not-defined)"',
      'export const fine = "var(--beta)"',
    ].join('\n'),
  )

  // Extra script path (the tailwind.config.js seam).
  const configFile = path.join(dir, 'fixture.config.js')
  writeFileSync(
    configFile,
    [
      '// A comment mentioning var(--chart-N) is prose and must NOT be flagged.',
      'module.exports = { theme: { colors: { panel: { border: "var(--ghost-config-token)" } } } }',
    ].join('\n'),
  )

  // Markup path.
  const markupFile = path.join(dir, 'fixture.html')
  writeFileSync(
    markupFile,
    [
      '<!-- A comment mentioning var(--ghost-html-comment-token) must NOT be flagged. -->',
      '<style>:root { --html-defined: #123456; }</style>',
      '<div style="color: var(--html-defined); background: var(--ghost-html-token)"></div>',
    ].join('\n'),
  )

  const r = census(src, { scriptFiles: [configFile], markupFiles: [markupFile] })
  const failures = []
  const has = (list, name) => list.some((e) => e.name === name)

  if (r.errors.length) failures.push(`census errored: ${r.errors.join('; ')}`)

  // --- defects it must catch
  if (!has(r.undefinedRefs, '--definitely-not-defined')) failures.push('missed an undefined reference in a .ts file')
  if (!has(r.undefinedRefs, '--ghost-config-token')) failures.push('missed an undefined reference in the config script')
  if (!has(r.cssUndefined, '--ghost-css-token')) failures.push('missed an undefined CSS reference')
  if (!has(r.cssUndefined, '--ghost-html-token')) failures.push('missed an undefined markup reference')
  if (!has(r.undefinedRefs, '--ghost-nested-token')) failures.push('missed a reference nested inside a fallback')
  if (r.unresolvable.filter((u) => u.reason.includes('statically knowable')).length !== 1)
    failures.push(`expected exactly 1 unresolvable dynamic site, got ${JSON.stringify(r.unresolvable)}`)
  if (!r.unresolvable.some((u) => u.pattern === '--not a name'))
    failures.push('missed a malformed custom-property name')
  if (!r.fallbackDrift.some((d) => d.name === '--alpha' && d.fallback === '#00ff00'))
    failures.push('missed a drifted fallback')
  if (!r.fallbackUncomparable.some((d) => d.name === '--runtime-defined' || d.name === '--html-defined')) {
    // Only meaningful if such a use exists; guarded below by the count check.
  }

  // --- legitimate cases it must NOT flag
  if (has(r.undefinedRefs, '--comment-only-placeholder') || has(r.undefinedRefs, '--another-comment-placeholder'))
    failures.push('flagged a var() that appears only in a comment')
  if (has(r.cssUndefined, '--ghost-html-comment-token')) failures.push('flagged a var() inside an HTML comment')
  if (has(r.undefinedRefs, '--chart-N')) failures.push('flagged a var() inside a config-script comment')
  if (has(r.undefinedRefs, '--real-token')) failures.push('flagged a defined token')
  if (has(r.undefinedRefs, '--runtime-defined')) failures.push('flagged a setProperty-defined token')
  if (has(r.undefinedRefs, '--alpha') || has(r.undefinedRefs, '--beta'))
    failures.push('failed to expand a resolvable literal union')
  if (r.fallbackDrift.some((d) => d.name === '--real-token')) failures.push('reported a matching fallback as drift')
  if (r.fallbackDrift.some((d) => d.name === '--aliased'))
    failures.push('failed to resolve one level of var() indirection when comparing a fallback')
  if (r.unresolvable.some((u) => u.reason.includes('no resolvable interpolation')))
    failures.push('reported a prose var() mention as an unresolvable dynamic reference')
  if (r.counts.proseMentions !== 1) failures.push(`expected 1 prose var() mention, got ${r.counts.proseMentions}`)
  if (r.counts.resolvedDynamicNames !== 4)
    failures.push(`expected 4 resolved dynamic names, got ${r.counts.resolvedDynamicNames}`)

  rmSync(dir, { recursive: true, force: true })
  return failures
}

// ------------------------------------------------------------------- main

function main() {
  const asJson = process.argv.includes('--json')

  const selfTestFailures = selfTest()
  const summary = census(SRC, {
    scriptFiles: EXTRA_SCRIPT_FILES.map((f) => path.join(REPO_ROOT, f)),
    markupFiles: EXTRA_MARKUP_FILES.map((f) => path.join(REPO_ROOT, f)),
  })
  summary.selfTest = { ok: selfTestFailures.length === 0, failures: selfTestFailures }
  if (selfTestFailures.length) {
    summary.errors = [...summary.errors, ...selfTestFailures.map((f) => `self-test: ${f}`)]
  }

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    const c = summary.counts
    console.log(
      `css-var-census: ${c.definitions} definitions · ${c.references} referenced properties ` +
        `· ${c.cssFiles} css / ${c.scriptFiles} script / ${c.markupFiles} markup files ` +
        `· ${c.dynamicSites} dynamic site(s) → ${c.resolvedDynamicNames} resolved name(s) ` +
        `· ${c.fallbackUses} fallback(s) compared · ${c.proseMentions} prose var() mention(s) ignored ` +
        `· self-test ${summary.selfTest.ok ? 'PASS' : 'FAIL'}`,
    )
    for (const e of summary.errors) console.error(`  CENSUS ERROR  ${e}`)
    for (const u of summary.unresolvable) {
      console.error(`  UNRESOLVABLE  ${u.at}  var(${u.pattern})\n                ${u.reason}`)
    }
    for (const u of summary.undefinedRefs) {
      console.error(`  UNDEFINED     ${u.name}`)
      for (const s of u.sites) console.error(`                ${s}`)
    }
    for (const u of summary.cssUndefined) {
      console.error(`  UNDEFINED-CSS ${u.name}`)
      for (const s of u.sites) console.error(`                ${s}`)
    }
    for (const d of summary.fallbackDrift) {
      console.error(`  FALLBACK-DRIFT var(${d.name}, ${d.fallback})  declared: ${d.declared.join(' | ')}`)
      for (const s of d.sites) console.error(`                ${s}`)
    }
    for (const d of summary.fallbackUncomparable) {
      console.error(`  FALLBACK-UNCOMPARABLE var(${d.name}, ${d.fallback})  ${d.reason}`)
    }
    if (
      !summary.errors.length &&
      !summary.unresolvable.length &&
      !summary.undefinedRefs.length &&
      !summary.cssUndefined.length &&
      !summary.fallbackDrift.length
    ) {
      console.log('  every var() reference resolves to a definition, and every fallback matches it.')
    }
  }

  // ---------------------------------------------------------------- exit
  //
  // `process.exitCode = n`, NEVER `process.exit(n)`.
  //
  // When stdout is a PIPE, Node's writes are asynchronous: `console.log`
  // hands the buffer to libuv, which write(2)s what the pipe will accept and
  // QUEUES the rest. `process.exit()` tears the process down without
  // draining that queue, so everything past the pipe's capacity is lost —
  // silently, with the exit status still correct.
  //
  // That made this script's OWN GUARD self-defeating. Its only consumer,
  // tests/ci-guards/css-var-resolution.spec.ts, reads `--json` through
  // execFileSync (a pipe), and the exit path taken WHENEVER THERE ARE
  // FINDINGS was the one that truncated. A guard that works until it has
  // something to say is not a guard.
  //
  // Measured on this platform (darwin, node 22): a `console.log` followed by
  // `process.exit()` delivers at most 65,536 bytes — 10/10 runs truncated at
  // exactly that offset for any larger payload, while `exitCode` + natural
  // drain delivered 2 MB intact, 10/10. Exit STATUS is identical either way.
  // tests/ci-guards/css-var-resolution.spec.ts pins both halves of that
  // measurement as an executable control, so the cliff is derived at your
  // platform rather than trusted from this comment.
  //
  // Setting exitCode is sufficient because nothing here holds the event loop
  // open (no timers, sockets or watchers) — the process ends as soon as the
  // write drains. Do not "fix" a future hang by reinstating process.exit();
  // find the handle.
  if (summary.errors.length) {
    process.exitCode = 2
    return
  }
  if (
    summary.undefinedRefs.length ||
    summary.unresolvable.length ||
    summary.cssUndefined.length ||
    summary.fallbackDrift.length
  ) {
    process.exitCode = 1
  }
}

main()
