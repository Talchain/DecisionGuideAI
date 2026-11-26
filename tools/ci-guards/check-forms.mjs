#!/usr/bin/env node
// Static S7 conformance check. --list prints matching paths and never writes the registry.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import ts from 'typescript'

const ROOT = process.cwd()
const REGISTRY = 'docs/Design/system/forms.json'
const LINK_STYLES = 'src/olumiView/v12/links/styles.ts'
const SCOPE = ['src/olumiView', 'src/olumiCore', 'src/canvas']
const EXCLUDED = new Set(['__tests__', '__fixtures__', 'fixtures'])
const under = (file, dir) => file === dir || file.startsWith(dir + '/')
const isScript = (file) => /\.[cm]?[jt]sx?$/.test(file)
const isLookCss = (file) => /^src\/olumiView\/look\/[^/]+\.css$/.test(file)

async function* walk(root, dir) {
  let entries
  try {
    entries = await fs.readdir(path.join(root, dir), { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : Number(a.name > b.name)))
  for (const entry of entries) {
    const file = dir + '/' + entry.name
    if (entry.isDirectory() && !EXCLUDED.has(entry.name)) yield* walk(root, file)
    if (entry.isFile() && !/\.(spec|test)\./.test(entry.name)) yield file
  }
}

function unwrap(node) {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)
    || ts.isSatisfiesExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node))) {
    node = node.expression
  }
  return node
}

function* alternatives(node) {
  node = unwrap(node)
  if (!node) return
  if (ts.isConditionalExpression(node)) {
    yield* alternatives(node.whenTrue)
    yield* alternatives(node.whenFalse)
  } else if (ts.isBinaryExpression(node) && [
    ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken,
  ].includes(node.operatorToken.kind)) {
    if (node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) yield* alternatives(node.left)
    yield* alternatives(node.right)
  } else {
    yield node
  }
}

function attributeValue(attribute) {
  const value = attribute.initializer
  return value && ts.isJsxExpression(value) ? value.expression : value
}

function literalText(node) {
  if (node && (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node))) return node.text
}

function tag(node) {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText()
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText()
}

function* componentReturns(node) {
  if (ts.isReturnStatement(node)) {
    yield* alternatives(node.expression)
    return
  }
  if (ts.isFunctionLike(node)) return
  for (const child of node.getChildren()) yield* componentReturns(child)
}

function componentRoots(source, file) {
  const name = path.basename(file, path.extname(file))
  const declarations = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [statement])
  const component = declarations.find((node) => node.name?.getText() === name)
    ?? declarations.find((node) => ts.isExportAssignment(node)
      || node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword))
  const render = component && unwrap(component.initializer ?? component.expression ?? component)
  if (!render?.body) return []
  const roots = ts.isBlock(render.body) ? [...componentReturns(render.body)] : [...alternatives(render.body)]
  return roots.filter((root) => ![
    ts.SyntaxKind.NullKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.VoidExpression,
  ].includes(root.kind) && !(ts.isIdentifier(root) && root.text === 'undefined'))
}

function scaleImport(file, specifier, directory) {
  let target = specifier
  if (specifier.startsWith('.')) target = path.posix.join(path.posix.dirname(file), specifier)
  if (specifier.startsWith('@/')) target = 'src/' + specifier.slice(2)
  if (specifier.startsWith('/src/')) target = specifier.slice(1)
  return under(target, directory)
}

function scanScript(file, code, registry, chart, report, checkDash) {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true)
  const lineAt = (offset) => source.getLineAndCharacterOfPosition(offset).line + 1
  const lineOf = (node) => lineAt(node.getStart(source))
  const { primitives } = registry
  const ids = new Set([...registry.faces, ...registry.charts.map(({ id }) => id), ...registry.lines, ...registry.tabs])
  const skipSvg = file.split('/').some((part) => primitives.svg.excluded_directories.includes(part))
  const classPrefix = new RegExp(`(?:^|[\\s.])(?:${primitives.class_prefixes.join('|')})`)
  let primitive
  let linkTable

  function checkDashValues(value) {
    for (const candidate of alternatives(value)) {
      const literal = literalText(candidate)
      if (literal !== undefined) checkDash(lineOf(candidate), literal)
    }
  }

  function visit(node, insideSvg) {
    const name = tag(node)
    if (!skipSvg && insideSvg && primitives.svg.elements.includes(name)) primitive ??= lineOf(node)

    let specifier
    if (ts.isImportDeclaration(node)) specifier = literalText(node.moduleSpecifier)
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      specifier = literalText(node.moduleReference.expression)
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      specifier = literalText(node.arguments[0])
    }
    if (specifier !== undefined && scaleImport(file, specifier, primitives.import_path)) primitive ??= lineOf(node)

    if (ts.isJsxAttribute(node)) {
      const attribute = node.name.getText()
      const value = attributeValue(node)
      if (attribute === 'data-form') {
        for (const candidate of alternatives(value)) {
          if (ts.isStringLiteralLike(candidate) && !ids.has(candidate.text)) {
            report(file, lineOf(candidate), 'form-id', `unregistered data-form ${JSON.stringify(candidate.text)}`)
          }
        }
      }
      if (attribute === 'strokeDasharray' || attribute === 'stroke-dasharray') checkDashValues(value)
    }
    if (ts.isPropertyAssignment(node)) {
      const property = node.name.text
      if (property === 'strokeDasharray' || property === 'stroke-dasharray'
        || (file === LINK_STYLES && property === 'dash')) checkDashValues(node.initializer)
    }
    if (ts.isVariableDeclaration(node) && file === LINK_STYLES) {
      if (node.name.getText() === 'LINK_STYLES') linkTable = unwrap(node.initializer)
      if (node.name.getText() === 'DOUBT_DASH') checkDashValues(node.initializer)
    }
    if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
      if (classPrefix.test(node.text)) primitive ??= lineOf(node)
      // Inline stylesheets can be stored in a string (DraftingModelMark).
      const css = node.getText(source).replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\r\n]/g, ' '))
      for (const match of css.matchAll(/(?:^|[{;])\s*(stroke-dasharray)\s*:\s*([^;}`]+)(?=[;}])/gi)) {
        if (!match[2].includes('${')) {
          checkDash(lineAt(node.getStart(source) + match.index + match[0].indexOf(match[1])), match[2])
        }
      }
    }
    ts.forEachChild(node, (child) => visit(child, insideSvg || name === 'svg'))
  }
  visit(source, false)

  if (chart) {
    const roots = componentRoots(source, file)
    if (!roots.length) report(file, 1, 'chart-root', `expected a component root with data-form="${chart.id}"`)
    for (const root of roots) {
      const element = ts.isJsxElement(root) ? root.openingElement : root
      const hasId = element.attributes?.properties.some((attribute) =>
        ts.isJsxAttribute(attribute) && attribute.name.getText() === 'data-form'
        && literalText(unwrap(attributeValue(attribute))) === chart.id)
      if (!hasId) report(file, lineOf(root), 'chart-root', `expected data-form="${chart.id}" on the component root`)
    }
  }

  if (file === LINK_STYLES) {
    const keys = new Set()
    if (linkTable && ts.isObjectLiteralExpression(linkTable)) {
      for (const property of linkTable.properties) {
        const key = property.name?.text ?? literalText(property.name?.expression)
        if (key === undefined) {
          report(file, lineOf(property), 'link-role', 'LINK_STYLES keys must be static')
          continue
        }
        keys.add(key)
        if (!Object.hasOwn(registry.link_roles, key)) {
          report(file, lineOf(property), 'link-role', `LINK_STYLES key ${JSON.stringify(key)} is missing from link_roles`)
        }
      }
    } else {
      report(file, 1, 'link-role', 'expected a static LINK_STYLES object')
    }
    for (const [key, id] of Object.entries(registry.link_roles)) {
      if (!keys.has(key)) report(file, 1, 'link-role', `link_roles key ${JSON.stringify(key)} is missing from LINK_STYLES`)
      if (!registry.lines.includes(id)) report(REGISTRY, 1, 'link-role', `link_roles key ${JSON.stringify(key)} names unregistered line ${JSON.stringify(id)}`)
    }
  }
  return primitive
}

async function scan(root, list) {
  const registry = JSON.parse(await fs.readFile(path.join(root, REGISTRY), 'utf8'))
  const charts = new Map(registry.charts.filter(({ component }) => component !== null)
    .map((chart) => [chart.component, chart]))
  const renderers = new Set(registry.renderers)
  const legacy = new Set(registry.legacy.map(({ file }) => file))
  const dashes = new Set(registry.dashes.map(({ value }) => value))
  const seen = new Set()
  const matches = []
  const breaches = []
  const report = (file, line, rule, message) => {
    if (!list) breaches.push(`${file}:${line} ${rule} ${message}`)
  }

  for (const dir of SCOPE) {
    for await (const file of walk(root, dir)) {
      if (!isScript(file) && !file.endsWith('.css')) continue
      seen.add(file)
      const code = await fs.readFile(path.join(root, file), 'utf8')
      const checkDash = (line, value) => {
        const dash = value.trim().replace(/\s+/g, ' ')
        if (!dashes.has(dash)) report(file, line, 'stroke-dasharray', `unregistered dash ${JSON.stringify(dash)}`)
      }
      let primitive
      if (isScript(file)) {
        primitive = scanScript(file, code, registry, charts.get(file), report, checkDash)
      } else {
        const stylesheet = postcss.parse(code, { from: file })
        stylesheet.walkRules((rule) => {
          if (registry.primitives.class_prefixes.some((prefix) => rule.selector.includes('.' + prefix))) {
            primitive ??= rule.source.start.line
          }
        })
        if (isLookCss(file)) {
          stylesheet.walkDecls(/^stroke-dasharray$/i, (declaration) => {
            if (!/\b(?:var|env|calc)\(/i.test(declaration.value)) {
              checkDash(declaration.source.start.line, declaration.value)
            }
          })
        }
      }
      if (primitive !== undefined) {
        matches.push(file)
        if (!renderers.has(file) && !legacy.has(file)) {
          report(file, primitive, 'chart-primitive', 'drawing primitive outside renderers and legacy')
        }
      }
    }
  }
  for (const file of charts.keys()) {
    if (!seen.has(file)) report(file, 1, 'chart-root', 'registered chart component file is missing')
  }
  if (!seen.has(LINK_STYLES) && Object.keys(registry.link_roles).length) {
    report(LINK_STYLES, 1, 'link-role', 'registered LINK_STYLES file is missing')
  }

  if (list) {
    for (const file of matches.sort()) console.log(file)
  } else if (breaches.length) {
    for (const breach of breaches) console.error(breach)
    process.exitCode = 1
  } else {
    console.log('Forms conformance passed')
  }
}

async function main(args) {
  let root = ROOT
  let list = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--list') list = true
    else if (args[i] === '--root' && args[i + 1] && !args[i + 1].startsWith('--')) root = path.resolve(args[++i])
    else throw new Error('Usage: check-forms.mjs [--root <dir>] [--list]')
  }
  await scan(root, list)
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
