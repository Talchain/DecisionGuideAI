#!/usr/bin/env node
/**
 * CSS custom-property resolution census.
 *
 * DERIVES both sides of the `var(--foo)` contract and reports every
 * reference that can never resolve:
 *
 *   DEFINITIONS  — `--foo: …` declarations in every `src/**` .css file,
 *                  plus runtime `element.style.setProperty('--foo', …)`
 *                  calls in TS/TSX (a genuine definition site).
 *   REFERENCES   — every `var(--foo)` reachable in `src/**` .ts/.tsx,
 *                  collected from the TypeScript AST (string literals,
 *                  template literals, JSX text) so that COMMENTS ARE
 *                  EXCLUDED BY CONSTRUCTION, and in every .css file.
 *
 * Why the AST and not a regex over raw text: prose comments legitimately
 * write `var(--x)` as a generic placeholder ("the theme colours are plain
 * `var(--x)` values"). A raw-text scan reports those as undefined
 * properties, and a scanner that cries wolf gets muted. Comments are
 * trivia, not nodes, so walking the AST drops them exactly rather than by
 * a hand-written comment-stripping heuristic.
 *
 * DYNAMIC REFERENCES ARE NEVER SILENTLY SKIPPED. `var(--${token})` is
 * resolved through the TypeScript type checker: when the interpolated
 * expression's type is a string-literal union ('success' | 'warning' |
 * 'danger') every member is expanded and checked. When the type is a
 * plain `string` — i.e. the property name is not knowable statically —
 * the site is reported as UNRESOLVABLE and the census exits non-zero.
 * Skipping what it cannot parse is exactly how this defect class survived.
 *
 * Usage:
 *   node scripts/css-var-census.mjs           # human-readable report
 *   node scripts/css-var-census.mjs --json    # machine-readable summary
 *
 * Exit codes: 0 clean · 1 undefined/unresolvable references found ·
 *             2 the census itself could not run.
 */
import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(REPO_ROOT, 'src')

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

// ------------------------------------------------------------- definitions

/**
 * A custom-property DECLARATION: `--name:` preceded by a block start,
 * semicolon, or whitespace. The leading-character requirement is what
 * keeps `var(--name)` — preceded by `(` — from counting as a definition.
 */
const CSS_DEF = /(?:^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g
/** A custom-property REFERENCE, name region captured up to `,` or `)`. */
const CSS_REF = /var\(\s*(--[A-Za-z0-9_-]+)/g
/** Runtime definition: `.setProperty('--name', …)`. */
const SET_PROPERTY_DEF = /setProperty\(\s*['"`](--[A-Za-z0-9_-]+)['"`]/g

function collectDefinitions(cssFiles, tsFiles) {
  /** @type {Map<string, {via: string, at: string}[]>} */
  const defs = new Map()
  const add = (name, via, at) => {
    if (!defs.has(name)) defs.set(name, [])
    defs.get(name).push({ via, at })
  }

  for (const file of cssFiles) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(CSS_DEF)) {
      add(m[1], 'css', `${rel(file)}:${lineOf(text, m.index)}`)
    }
  }

  // Runtime definitions are real definitions: a property set via
  // setProperty resolves at runtime even with no CSS declaration.
  // Recorded with provenance so the manifest shows WHERE it comes from.
  for (const file of tsFiles) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(SET_PROPERTY_DEF)) {
      add(m[1], 'setProperty', `${rel(file)}:${lineOf(text, m.index)}`)
    }
  }

  return defs
}

// -------------------------------------------------------------- references

/**
 * Scan one text chunk (a string-literal body, a template's assembled text,
 * or JSX text) for `var(…)` and classify each hit.
 *
 * Placeholders for template interpolations are encoded as @@<i>@@
 * so that a name region containing one is recognisably dynamic.
 */
function scanChunk(chunk) {
  const statics = []
  const dynamics = []
  const RE = /var\(\s*([^)]*)/g
  for (const m of chunk.matchAll(RE)) {
    const nameRegion = m[1].split(',')[0].trim()
    if (nameRegion.includes('@@')) {
      dynamics.push(nameRegion)
    } else {
      const named = nameRegion.match(/^(--[A-Za-z0-9_-]+)$/)
      if (named) statics.push(named[1])
      else dynamics.push(nameRegion) // malformed / unexpected — never dropped
    }
  }
  return { statics, dynamics }
}

/**
 * Collect every var() reference in a TS/TSX source, from the AST only.
 * Returns static names and dynamic sites (with the expression nodes needed
 * to resolve them through the type checker).
 */
function collectFromSource(sourceFile) {
  const staticRefs = [] // {name, line}
  const dynamicSites = [] // {pattern, exprs, line}

  const visit = (node) => {
    // Plain string literals: 'var(--foo)'
    if (ts.isStringLiteralLike(node) && !ts.isTemplateExpression(node.parent)) {
      const { statics, dynamics } = scanChunk(node.text)
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
      for (const n of statics) staticRefs.push({ name: n, line })
      for (const p of dynamics) dynamicSites.push({ pattern: p, exprs: [], line })
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
      const { statics, dynamics } = scanChunk(assembled)
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
      for (const n of statics) staticRefs.push({ name: n, line })
      for (const p of dynamics) dynamicSites.push({ pattern: p, exprs, line })
    }

    if (ts.isJsxText(node)) {
      const { statics, dynamics } = scanChunk(node.text)
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
      for (const n of statics) staticRefs.push({ name: n, line })
      for (const p of dynamics) dynamicSites.push({ pattern: p, exprs: [], line })
    }

    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return { staticRefs, dynamicSites }
}

/**
 * Expand a dynamic pattern into concrete property names using the type
 * checker. Returns {names} on success, or {unresolved: reason} when the
 * interpolated type is not a finite set of string literals.
 */
function resolveDynamic(site, checker) {
  const memberSets = []
  for (const expr of site.exprs) {
    const type = checker.getTypeAtLocation(expr)
    const parts = type.isUnion() ? type.types : [type]
    const literals = []
    for (const part of parts) {
      if (part.isStringLiteral()) literals.push(part.value)
      else {
        return {
          unresolved:
            `interpolated expression has type \`${checker.typeToString(type)}\`, ` +
            'not a string-literal union — the property name is not statically knowable',
        }
      }
    }
    if (literals.length === 0 || literals.length > MAX_UNION_MEMBERS) {
      return { unresolved: `interpolated union has ${literals.length} members (cap ${MAX_UNION_MEMBERS})` }
    }
    memberSets.push(literals)
  }

  if (memberSets.length === 0) {
    return { unresolved: 'dynamic var() with no resolvable interpolation' }
  }

  // Cartesian product over every interpolation in the name region.
  let names = [site.pattern]
  memberSets.forEach((members, i) => {
    const next = []
    for (const base of names) {
      for (const member of members) next.push(base.split(`@@${i}@@`).join(member))
    }
    names = next
  })

  for (const n of names) {
    if (!/^--[A-Za-z0-9_-]+$/.test(n)) {
      return { unresolved: `expansion produced a non-property-name token \`${n}\`` }
    }
  }
  return { names }
}

// ----------------------------------------------------------------- census

/** Run the full census over one source tree. Pure: returns the summary. */
function census(srcDir) {
  const errors = []

  const cssFiles = walkDir(srcDir, ['.css']).sort()
  const tsFiles = walkDir(srcDir, ['.ts', '.tsx']).sort()

  if (cssFiles.length === 0 || tsFiles.length === 0) {
    errors.push(`found no source files under ${srcDir} — refusing to report a vacuous pass`)
    return { errors, counts: {}, undefinedRefs: [], unresolvable: [], cssUndefined: [] }
  }

  const defs = collectDefinitions(cssFiles, tsFiles)

  /** @type {Map<string, string[]>} name → ["file:line", …] */
  const refs = new Map()
  const addRef = (name, at) => {
    if (!refs.has(name)) refs.set(name, [])
    refs.get(name).push(at)
  }

  const allDynamicSites = []
  for (const file of tsFiles) {
    const text = readFileSync(file, 'utf8')
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const { staticRefs, dynamicSites } = collectFromSource(sf)
    for (const r of staticRefs) addRef(r.name, `${rel(file)}:${r.line}`)
    for (const d of dynamicSites) allDynamicSites.push({ ...d, file })
  }

  // Resolve dynamic sites through the type checker. The program is rooted
  // only at the files that actually need it, so the common (no dynamic
  // references) case costs nothing.
  const unresolvable = []
  let resolvedDynamic = 0
  if (allDynamicSites.length > 0) {
    const roots = [...new Set(allDynamicSites.map((d) => d.file))]
    const program = ts.createProgram(roots, {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      allowJs: false,
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
        for (const n of result.names) addRef(n, `${rel(site.file)}:${site.line} (dynamic)`)
      }
    }
  }

  // CSS files referencing properties defined in no CSS file and by no
  // setProperty call. Definitions are pooled across ALL files, so ordinary
  // cross-file usage (defined in brand.css, used in a module) is silent.
  const cssUndefined = new Map()
  for (const file of cssFiles) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(CSS_REF)) {
      if (!defs.has(m[1])) {
        if (!cssUndefined.has(m[1])) cssUndefined.set(m[1], [])
        cssUndefined.get(m[1]).push(`${rel(file)}:${lineOf(text, m.index)}`)
      }
    }
  }

  const undefinedRefs = [...refs.keys()]
    .filter((name) => !defs.has(name))
    .sort()
    .map((name) => ({ name, sites: refs.get(name) }))

  return {
    errors,
    counts: {
      cssFiles: cssFiles.length,
      tsFiles: tsFiles.length,
      definitions: defs.size,
      references: refs.size,
      dynamicSites: allDynamicSites.length,
      resolvedDynamicNames: resolvedDynamic,
    },
    undefinedRefs,
    unresolvable,
    cssUndefined: [...cssUndefined.entries()].sort().map(([name, sites]) => ({ name, sites })),
  }
}

// -------------------------------------------------------------- self-test

/**
 * POSITIVE CONTROL (trap 13: "a positive control, or the absence assertion
 * is vacuous"). Builds a throwaway fixture tree carrying one of each
 * defect the census claims to catch, and asserts it catches all of them —
 * and that it does NOT flag the legitimate cases (a comment placeholder, a
 * resolvable literal union, a setProperty-defined property).
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
    ':root {\n  --real-token: #fff;\n  --alpha: red;\n  --beta: blue;\n}\n' +
      '.x { color: var(--real-token); border-color: var(--ghost-css-token); }\n',
  )
  writeFileSync(
    path.join(src, 'sample.tsx'),
    [
      "// A prose comment mentioning var(--comment-only-placeholder) must NOT be flagged.",
      '/* Block comment with var(--another-comment-placeholder) — also ignored. */',
      "type Pick = 'alpha' | 'beta'",
      'declare const which: Pick',
      'declare const freeform: string',
      'declare const el: HTMLElement',
      "el.style.setProperty('--runtime-defined', '1')",
      "export const good = 'var(--real-token)'",
      "export const runtime = 'var(--runtime-defined)'",
      "export const bad = 'var(--definitely-not-defined)'",
      'export const resolvable = `var(--${which})`',
      'export const unresolvable = `var(--${freeform})`',
    ].join('\n'),
  )

  const r = census(src)
  const failures = []
  const has = (list, name) => list.some((e) => e.name === name)

  if (r.errors.length) failures.push(`census errored: ${r.errors.join('; ')}`)
  if (!has(r.undefinedRefs, '--definitely-not-defined')) failures.push('missed an undefined TS reference')
  if (!has(r.cssUndefined, '--ghost-css-token')) failures.push('missed an undefined CSS reference')
  if (r.unresolvable.length !== 1) failures.push(`expected 1 unresolvable site, got ${r.unresolvable.length}`)
  if (has(r.undefinedRefs, '--comment-only-placeholder') || has(r.undefinedRefs, '--another-comment-placeholder'))
    failures.push('flagged a var() that appears only in a comment')
  if (has(r.undefinedRefs, '--real-token')) failures.push('flagged a defined token')
  if (has(r.undefinedRefs, '--runtime-defined')) failures.push('flagged a setProperty-defined token')
  if (has(r.undefinedRefs, '--alpha') || has(r.undefinedRefs, '--beta'))
    failures.push('failed to expand a resolvable literal union')
  if (r.counts.resolvedDynamicNames !== 2)
    failures.push(`expected 2 resolved dynamic names, got ${r.counts.resolvedDynamicNames}`)

  rmSync(dir, { recursive: true, force: true })
  return failures
}

// ------------------------------------------------------------------- main

function main() {
  const asJson = process.argv.includes('--json')

  const selfTestFailures = selfTest()
  const summary = census(SRC)
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
        `· ${c.cssFiles} css / ${c.tsFiles} ts files · ${c.dynamicSites} dynamic site(s) ` +
        `→ ${c.resolvedDynamicNames} resolved name(s) · self-test ${summary.selfTest.ok ? 'PASS' : 'FAIL'}`,
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
    if (
      !summary.errors.length &&
      !summary.unresolvable.length &&
      !summary.undefinedRefs.length &&
      !summary.cssUndefined.length
    ) {
      console.log('  every var() reference resolves to a definition.')
    }
  }

  if (summary.errors.length) process.exit(2)
  if (summary.undefinedRefs.length || summary.unresolvable.length || summary.cssUndefined.length) process.exit(1)
}

main()
