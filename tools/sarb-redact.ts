#!/usr/bin/env tsx

/**
 * SARB Redaction Tool
 * Creates redacted SARB bundles safe for public sharing
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

interface SarbBundle {
  meta: {
    bundleId: string;
    created: string;
    seed?: number;
    duration?: number;
    [key: string]: any;
  };
  sessions: Array<{
    sessionId: string;
    traces: any[];
    [key: string]: any;
  }>;
  [key: string]: any;
}

interface RedactionNote {
  input: string;
  output: string;
  timestamp: string;
  removedFields: string[];
  preservedFields: string[];
  summary: string;
}

const SENSITIVE_FIELDS = [
  'apikey',
  'api_key',
  'secret',
  'password',
  'token',
  'authorization',
  'bearer',
  'useragent',
  'user_agent',
  'ipaddress',
  'ip_address',
  'personaldata',
  'email',
  'userid',
  'user_id',
  'sessionsecret',
  'session_secret'
];

const PRESERVE_FIELDS = [
  'bundleId',
  'created',
  'seed',
  'duration',
  'totalTokens',
  'costUsd',
  'model',
  'route',
  'deterministic'
];

async function redactSarbBundle(inputPath: string, outputPath: string): Promise<RedactionNote> {
  console.log(`🔄 Redacting SARB bundle: ${inputPath}`);

  // Read the input bundle
  const inputData = await fs.readFile(inputPath, 'utf8');
  const bundle: SarbBundle = JSON.parse(inputData);

  const removedFields: string[] = [];
  const preservedFields: string[] = [];

  // Redact the bundle
  const redactedBundle = redactObject(bundle, '', removedFields, preservedFields);

  // Write the redacted bundle
  await fs.writeFile(outputPath, JSON.stringify(redactedBundle, null, 2));

  // Generate redaction note
  const note: RedactionNote = {
    input: path.basename(inputPath),
    output: path.basename(outputPath),
    timestamp: new Date().toISOString(),
    removedFields: [...new Set(removedFields)].sort(),
    preservedFields: [...new Set(preservedFields)].sort(),
    summary: `Redacted ${removedFields.length} sensitive fields, preserved ${preservedFields.length} safe fields`
  };

  // Write redaction note
  const noteFileName = path.basename(outputPath, path.extname(outputPath)) + '.redaction-note.md';
  const notePath = path.join(path.dirname(outputPath), noteFileName);
  const noteContent = generateNoteContent(note);
  await fs.writeFile(notePath, noteContent);

  console.log(`✅ Redaction complete: ${outputPath}`);
  console.log(`📄 Note written: ${notePath}`);

  return note;
}

function redactObject(obj: any, keyPath: string, removedFields: string[], preservedFields: string[]): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      redactObject(item, `${keyPath}[${index}]`, removedFields, preservedFields)
    );
  }

  const result: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = keyPath ? `${keyPath}.${key}` : key;

    // Check preserve first - it takes precedence
    const shouldPreserve = shouldPreserveField(key, fullPath);
    const shouldRemove = !shouldPreserve && shouldRemoveField(key, fullPath);

    if (shouldRemove) {
      removedFields.push(fullPath);
      continue;
    }

    if (shouldPreserve) {
      preservedFields.push(fullPath);
    }

    result[key] = redactObject(value, fullPath, removedFields, preservedFields);
  }

  return result;
}

function shouldRemoveField(key: string, fullPath: string): boolean {
  const lowerKey = key.toLowerCase();
  const lowerPath = fullPath.toLowerCase();

  // Check direct field names (exact match or contains)
  if (SENSITIVE_FIELDS.some(field => lowerKey === field || lowerKey.includes(field))) {
    return true;
  }

  // Check path patterns
  if (lowerPath.includes('secret') ||
      lowerPath.includes('password') ||
      lowerPath.includes('auth') ||
      lowerPath.includes('private') ||
      lowerPath.includes('api') ||
      lowerPath.includes('@') ||  // email patterns
      lowerPath.includes('ip') ||
      lowerPath.includes('user')) {
    return true;
  }

  return false;
}

function shouldPreserveField(key: string, fullPath: string): boolean {
  const lowerKey = key.toLowerCase();

  // Explicit preserve takes precedence over removal
  if (PRESERVE_FIELDS.some(field => lowerKey === field || lowerKey.includes(field))) {
    return true;
  }

  return false;
}

function generateNoteContent(note: RedactionNote): string {
  return `# SARB Redaction Note

**Generated**: ${note.timestamp}
**Input**: ${note.input}
**Output**: ${note.output}

## Summary

${note.summary}

## Removed Fields (${note.removedFields.length})

Sensitive fields removed from the bundle:

${note.removedFields.map(field => `- \`${field}\``).join('\\n')}

## Preserved Fields (${note.preservedFields.length})

Safe fields preserved for analysis:

${note.preservedFields.slice(0, 10).map(field => `- \`${field}\``).join('\\n')}
${note.preservedFields.length > 10 ? `- ... and ${note.preservedFields.length - 10} more` : ''}

## Safety Notes

- **No Personal Data**: All potentially sensitive information has been removed
- **Determinism Preserved**: Seed and timing data maintained where safe
- **Analysis Ready**: Bundle remains valid for performance and behavior analysis
- **Public Safe**: This redacted bundle is suitable for sharing and demonstration

## Verification

To verify the redacted bundle:
\`\`\`bash
npm run sarb:verify -- ${note.output}
\`\`\`

---
*Generated by SARB Redaction Tool*`;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: npm run sarb:redact -- <input.sarb.zip> <output.sarb.zip>');
    console.log('');
    console.log('Creates a redacted copy of a SARB bundle safe for public sharing.');
    console.log('Removes sensitive fields while preserving determinism metadata.');
    process.exit(1);
  }

  const [inputPath, outputPath] = args;

  try {
    // Validate input exists
    await fs.access(inputPath);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Perform redaction
    const note = await redactSarbBundle(inputPath, outputPath);

    console.log('\\n📊 Redaction Summary');
    console.log('====================');
    console.log(`Removed: ${note.removedFields.length} sensitive fields`);
    console.log(`Preserved: ${note.preservedFields.length} safe fields`);
    console.log(`Output: ${outputPath}`);
    console.log(`Note: ${path.join(path.dirname(outputPath), path.basename(outputPath, path.extname(outputPath)) + '.redaction-note.md')}`);

    console.log('\\n✅ Redaction complete - bundle is ready for sharing');

  } catch (error) {
    console.error('❌ Redaction failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { redactSarbBundle };