#!/usr/bin/env node
// J1 stack material, generated fresh on every run and never committed:
//   1. an ES256 signing key for the local Supabase, so user JWTs are asymmetric and
//      CEE's JWKS-only verifier (sujwt.ts, ES256/RS256 allowlist) accepts them exactly
//      as it does on staging;
//   2. the CA + leaf certificate the LLM replay server presents for the provider hosts.
// usage: gen-tls-and-keys.mjs <out dir>

import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const out = process.argv[2]
if (!out) { console.error('usage: gen-tls-and-keys.mjs <out dir>'); process.exit(2) }
fs.mkdirSync(out, { recursive: true })

const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' })
const jwk = privateKey.export({ format: 'jwk' })
const kid = crypto.randomUUID()
fs.writeFileSync(path.join(out, 'signing_keys.json'), JSON.stringify([
  { ...jwk, kid, alg: 'ES256', use: 'sig', key_ops: ['sign', 'verify'], ext: true },
], null, 2))

const o = (...args) => execFileSync('openssl', args, { cwd: out, stdio: ['ignore', 'ignore', 'inherit'] })
o('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=J1 journey LLM boundary CA',
  '-keyout', 'ca.key', '-out', 'ca.pem')
fs.writeFileSync(path.join(out, 'leaf.ext'),
  'subjectAltName=DNS:api.openai.com,DNS:api.anthropic.com\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n')
o('req', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=api.openai.com', '-keyout', 'leaf.key', '-out', 'leaf.csr')
o('x509', '-req', '-in', 'leaf.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-days', '2',
  '-extfile', 'leaf.ext', '-out', 'leaf.pem')
console.log(`[stack] signing key ${kid} (ES256) and LLM-boundary TLS material written to ${out}`)
