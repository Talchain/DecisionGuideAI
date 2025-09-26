#!/usr/bin/env npx tsx
/**
 * Pilot Notes Capture Tool
 *
 * Captures pilot feedback without any sensitive data or payloads.
 * Usage: npx tsx tools/pilot-notes.ts "Your note here"
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const REPORTS_DIR = join(PROJECT_ROOT, 'artifacts', 'reports');
const NOTES_FILE = join(REPORTS_DIR, 'pilot-notes.md');

function ensureReportsDir(): void {
  try {
    mkdirSync(REPORTS_DIR, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }
}

function initializeNotesFile(): void {
  if (!existsSync(NOTES_FILE)) {
    const header = `# Pilot Notes

Feedback and observations from pilot demos. No personal data or sensitive content.

Generated: ${new Date().toISOString()}

---

`;
    writeFileSync(NOTES_FILE, header);
    console.log('📝 Initialized pilot notes file');
  }
}

function addNote(noteText: string): void {
  const timestamp = new Date().toISOString();
  const noteEntry = `**${timestamp}**: ${noteText}\n\n`;

  // Read existing content
  let existingContent = '';
  if (existsSync(NOTES_FILE)) {
    existingContent = readFileSync(NOTES_FILE, 'utf8');
  }

  // Insert note after the header (after first ---)
  const headerEndIndex = existingContent.indexOf('---\n\n');
  if (headerEndIndex !== -1) {
    const insertPosition = headerEndIndex + 5; // After "---\n\n"
    const updatedContent =
      existingContent.slice(0, insertPosition) +
      noteEntry +
      existingContent.slice(insertPosition);
    writeFileSync(NOTES_FILE, updatedContent);
  } else {
    // Fallback: append to end
    writeFileSync(NOTES_FILE, existingContent + noteEntry);
  }

  console.log(`✅ Note added: "${noteText}"`);
}

function validateNote(noteText: string): boolean {
  // Check for potential sensitive data patterns
  const sensitivePatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // Credit card pattern
    /\b(?:api_key|token|password|secret|key)[:=]\s*[A-Za-z0-9+/=]+/i, // API keys
    /@[A-Za-z0-9]+/g, // @ mentions
  ];

  const lowerNote = noteText.toLowerCase();

  // Check for sensitive keywords
  const sensitiveKeywords = [
    'personal', 'private', 'confidential', 'internal',
    'salary', 'revenue', 'profit', 'customer',
    'password', 'secret', 'token', 'api_key'
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(noteText)) {
      console.error('❌ Note contains potential sensitive data (pattern match)');
      return false;
    }
  }

  for (const keyword of sensitiveKeywords) {
    if (lowerNote.includes(keyword)) {
      console.warn(`⚠️  Note contains potentially sensitive keyword: "${keyword}"`);
      console.warn('   Please ensure no personal/business data is included');
    }
  }

  return true;
}

function printUsage(): void {
  console.log(`
📝 Pilot Notes Capture Tool

Usage: npx tsx tools/pilot-notes.ts "Your note here"

Examples:
  npx tsx tools/pilot-notes.ts "Great response to stream cancellation demo"
  npx tsx tools/pilot-notes.ts "Questions about integration complexity"
  npx tsx tools/pilot-notes.ts "Stream performance was excellent"

Safe to capture:
  ✅ Feature feedback ("loved the real-time aspect")
  ✅ Questions asked ("how does cancellation work?")
  ✅ Performance observations ("stream was fast")
  ✅ Technical feedback ("UI was intuitive")

Never capture:
  ❌ Names or personal info
  ❌ Company-specific scenarios
  ❌ Actual business data
  ❌ API keys or tokens

Notes are saved to: ${NOTES_FILE}
`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    return;
  }

  const noteText = args.join(' ').trim();

  if (!noteText) {
    console.error('❌ Empty note provided');
    printUsage();
    return;
  }

  if (noteText.length > 500) {
    console.error('❌ Note too long (max 500 characters)');
    return;
  }

  if (!validateNote(noteText)) {
    console.error('❌ Note validation failed - contains potentially sensitive data');
    return;
  }

  ensureReportsDir();
  initializeNotesFile();
  addNote(noteText);

  console.log(`📁 Notes file: ${NOTES_FILE}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}