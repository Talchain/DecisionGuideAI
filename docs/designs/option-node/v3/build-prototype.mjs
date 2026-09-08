// Run from the repository: node docs/designs/option-node/v3/build-prototype.mjs
// No network, package installation or production writes.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Module, { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as Lucide from 'lucide-react'
import ts from 'typescript'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const require = createRequire(import.meta.url)
function loadDomain(relative) {
  const file = path.join(root, relative)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const mod = new Module(file)
  mod.filename = file
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  mod.require = require
  mod._compile(source, file)
  return mod.exports
}
const { VALUE_PROVENANCE_ICON } = loadDomain('src/canvas/domain/valueProvenanceIcon.ts')
const { classifyNodeProvenance, VALUE_PROVENANCE_LABEL } = loadDomain('src/canvas/domain/valueProvenance.ts')
const svg = (component) => renderToStaticMarkup(React.createElement(component, {
  size: 14, strokeWidth: 1.8, 'aria-hidden': true, focusable: false,
}))
const icons = Object.fromEntries(
  ['MessageSquare', 'Zap', 'MoreHorizontal', 'PanelRight', 'Pencil', 'X', 'ArrowUp', 'RotateCcw', 'Minus', 'Plus']
    .map(name => [name, svg(Lucide[name])]),
)
for (const [kind, component] of Object.entries(VALUE_PROVENANCE_ICON)) icons['origin-' + kind] = svg(component)
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'src/canvas/starters/data/headcount-allocation.draft.json'), 'utf8'))
const options = fixture.nodes.filter(n => ['opt_eng', 'opt_status_quo'].includes(n.id)).map(n => {
  const origin = classifyNodeProvenance(n.provenance)
  return {
    ...n,
    originKind: origin?.kind ?? null,
    originLabel: origin ? VALUE_PROVENANCE_LABEL[origin.kind] : null,
    changes: Object.entries(n.interventions).map(([id, detail]) => ({
      id, label: fixture.nodes.find(f => f.id === id)?.label ?? id, value: detail.value,
    })),
  }
})
const cssSource = fs.readFileSync(path.join(root, 'src/styles/brand.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const cssStart = cssSource.indexOf(':root {')
const brandRoot = cssSource.slice(cssStart, cssSource.indexOf('}', cssStart) + 1).replace(/[ \t]+$/gm, '')
if (!brandRoot.includes('--option-rgb: 170 167 228')) throw new Error('Expected option token not found; inspect the brand source before rebuilding.')
const data = JSON.stringify({ options, icons }).replace(/</g, '\\u003c')
const template = fs.readFileSync(path.join(here, 'prototype.template.html'), 'utf8')
fs.writeFileSync(path.join(here, 'olumi-option-node-v3.html'), template.replace('/* BRAND_ROOT */', brandRoot).replace('/* PROTOTYPE_DATA */', data))
console.log('Built offline V3 prototype from current brand tokens, provenance classifier/registry and captured starter.')
