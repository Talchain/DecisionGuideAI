#!/usr/bin/env node
/**
 * Generate Pre-compiled Ajv Validators
 *
 * This script generates standalone validator functions from JSON schemas,
 * eliminating the need for runtime `new Function()` calls that violate CSP.
 *
 * Usage:
 *   node scripts/generate-validators.mjs                 # write to src/generated
 *   node scripts/generate-validators.mjs --out-dir DIR   # write elsewhere
 *
 * Output: <out-dir>/validators.js (ESM module with validator functions)
 *         <out-dir>/validators.d.ts
 *
 * ⚠ THE OUTPUT MUST BE A PURE FUNCTION OF ITS INPUTS. `npm run build` is
 * `generate:validators && vite build`, and `src/generated/validators.js` is
 * COMMITTED (it has to be: `src/poc/io/validate.ts` imports it, and that import
 * is reached from vitest — `src/poc/io/__tests__/schema.spec.ts` — where no
 * generation step runs. The file exists precisely to avoid a CSP-violating
 * runtime `new Function`, so it cannot be gitignored and built on demand).
 *
 * So anything non-deterministic in here dirties the working tree on every
 * build. Until 2026-08-29 the header carried `Generated at: <ISO clock>`, and
 * every production build left `M src/generated/validators.js` behind — a diff
 * whose entire content was that timestamp. That made `git status` unusable as a
 * "did I change anything" signal during verification (this estate leans on it
 * hard: mutation harnesses assert a clean tree before and after every mutant),
 * and it invited the churn being staged into unrelated commits.
 *
 * The stamp was dropped rather than made content-derived. It carried nothing a
 * git commit does not already carry, the emitted module embeds the whole schema
 * verbatim (so a schema change is visible in the diff itself), and a hash over
 * "the source schemas" would NOT move on an Ajv upgrade or an options change —
 * asserting a freshness it cannot back. The honest staleness signal is
 * `scripts/ci/assert-validators-deterministic.mjs`, which regenerates and
 * compares: it reds on drift from ANY cause, and it is derived rather than
 * hand-maintained.
 *
 * `pnpm run ci:guard:validators-deterministic` holds this closed in the `build`
 * job of the required "Staging Gate" check. Do not reintroduce a clock, a PID,
 * a random value, or an environment-dependent path into the emitted bytes.
 */

import Ajv from 'ajv'
import standaloneCode from 'ajv/dist/standalone/index.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

// ============================================================================
// Schema Definitions (imported inline to avoid TypeScript compilation issues)
// ============================================================================

const samStateSchema = {
  $id: 'poc/samState.schema.v1',
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          label: { type: 'string' },
        },
        required: ['id'],
      },
      minItems: 0,
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
          label: { type: 'string' },
        },
        required: ['from', 'to'],
      },
      minItems: 0,
    },
    renames: {
      type: 'object',
      additionalProperties: { type: 'string' },
      properties: {},
      required: [],
    },
  },
  required: ['schemaVersion', 'nodes', 'edges'],
}

// ============================================================================
// Ajv Configuration
// ============================================================================

const ajv = new Ajv({
  code: { source: true, esm: true },
  allErrors: true,
  removeAdditional: 'all',
  coerceTypes: true,
})

// ============================================================================
// Compile Schemas
// ============================================================================

console.log('Compiling JSON schemas...')

// Add schemas and compile validators
ajv.addSchema(samStateSchema, 'validateSamState')

// Generate standalone code with named exports
const moduleCode = standaloneCode(ajv, {
  validateSamState: 'poc/samState.schema.v1',
})

// ============================================================================
// Add TypeScript Declaration Header
// ============================================================================

// NO CLOCK, NO PID, NO RANDOMNESS, NO ABSOLUTE PATHS in this header. See the
// module docstring: the output is committed, so a varying byte here dirties the
// tree on every build. `pnpm run ci:guard:validators-deterministic` reds if one
// comes back.
const header = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * Generated by: scripts/generate-validators.mjs
 *
 * These validators are pre-compiled from JSON schemas to avoid
 * runtime code generation (new Function) that violates CSP.
 *
 * To regenerate: npm run generate:validators
 *
 * There is deliberately no generation timestamp here: this file is committed,
 * and a clock-derived byte made every production build leave the working tree
 * dirty. Git carries the provenance; the regenerate-and-compare guard carries
 * the staleness signal.
 */

/* eslint-disable */
// @ts-nocheck
`

const fullCode = header + moduleCode

// ============================================================================
// Write Output
// ============================================================================

// `--out-dir DIR` exists so the determinism guard can generate into two throwaway
// directories and compare, WITHOUT writing over the committed artefact. It runs
// this script as a real subprocess — the same entry point the build invokes —
// rather than importing a refactored library version of it, so what the guard
// proves deterministic is what the build actually runs.
const outDirArgIndex = process.argv.indexOf('--out-dir')
if (outDirArgIndex !== -1 && !process.argv[outDirArgIndex + 1]) {
  console.error('--out-dir requires a directory path')
  process.exit(2)
}
const outputDir =
  outDirArgIndex === -1
    ? path.join(ROOT, 'src', 'generated')
    : path.resolve(process.argv[outDirArgIndex + 1])
const outputPath = path.join(outputDir, 'validators.js')
const dtsPath = path.join(outputDir, 'validators.d.ts')

// Create output directory
fs.mkdirSync(outputDir, { recursive: true })

// Write JavaScript module
fs.writeFileSync(outputPath, fullCode)
console.log(`Generated: ${path.relative(ROOT, outputPath)}`)

// Write TypeScript declarations
const declarations = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * TypeScript declarations for pre-compiled Ajv validators.
 * Generated by: scripts/generate-validators.mjs
 */

import type { ValidateFunction, ErrorObject } from 'ajv'

export interface SamNode {
  id: string
  x?: number
  y?: number
  label?: string
}

export interface SamEdge {
  id?: string
  from: string
  to: string
  label?: string
}

export interface SamState {
  schemaVersion: 1
  nodes: SamNode[]
  edges: SamEdge[]
  renames?: Record<string, string>
}

export declare const validateSamState: ValidateFunction<SamState>
`

fs.writeFileSync(dtsPath, declarations)
console.log(`Generated: ${path.relative(ROOT, dtsPath)}`)

console.log('\n✅ Validator generation complete!')
console.log('   Pre-compiled validators eliminate runtime new Function() calls')
console.log('   CSP can now safely exclude "unsafe-eval"')
