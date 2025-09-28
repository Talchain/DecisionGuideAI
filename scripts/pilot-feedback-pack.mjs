#!/usr/bin/env node

/**
 * Pilot Feedback Pack Generator
 * Creates a zip file containing feedback template and survey for distribution
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const pilotDir = join(rootDir, 'artifacts', 'pilot');
const releaseDir = join(rootDir, 'artifacts', 'release');

/**
 * Ensure required directories exist
 */
function ensureDirectories() {
  if (!existsSync(releaseDir)) {
    mkdirSync(releaseDir, { recursive: true });
    console.log('=Á Created release directory');
  }

  if (!existsSync(pilotDir)) {
    console.error('L Pilot directory not found at:', pilotDir);
    process.exit(1);
  }
}

/**
 * Check if feedback files exist
 */
function validateFeedbackFiles() {
  const requiredFiles = [
    'feedback-template.md',
    'quick-survey.md'
  ];

  const missingFiles = [];

  for (const file of requiredFiles) {
    const filePath = join(pilotDir, file);
    if (!existsSync(filePath)) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    console.error('L Missing required files:');
    missingFiles.forEach(file => console.error(`   - ${file}`));
    return false;
  }

  console.log(' All feedback files present');
  return true;
}

/**
 * Create the feedback pack zip file
 */
function createFeedbackPack() {
  const outputPath = join(releaseDir, 'pilot-feedback-pack.zip');

  console.log('=æ Creating pilot feedback pack...');

  try {
    // Change to pilot directory and create zip
    const zipCommand = `cd "${pilotDir}" && zip -r "${outputPath}" feedback-template.md quick-survey.md`;

    execSync(zipCommand, { stdio: 'pipe' });

    console.log(' Pilot feedback pack created successfully');
    console.log('=Í Location:', outputPath);

    // Show file size
    const stats = execSync(`ls -lh "${outputPath}" | awk '{print $5}'`, { encoding: 'utf8' });
    console.log('=Ï Size:', stats.trim());

    return outputPath;
  } catch (error) {
    console.error('L Failed to create feedback pack:', error.message);
    return null;
  }
}

/**
 * Print summary of pack contents
 */
function printSummary(packPath) {
  console.log('\n=Ë Feedback Pack Contents:');
  console.log('================================');
  console.log('1. feedback-template.md - Non-PII feedback collection form');
  console.log('2. quick-survey.md - 7 Likert items + 3 short answer questions');
  console.log('');
  console.log('<¯ Purpose: Collect structured pilot feedback without personal data');
  console.log('=Ê Format: Markdown files for easy printing/digital distribution');
  console.log('= Privacy: No PII collection, participant IDs only');
  console.log('');
  console.log('=ä Distribution Instructions:');
  console.log('1. Extract zip file');
  console.log('2. Print or share markdown files with pilot participants');
  console.log('3. Assign participant IDs (P-001, P-002, etc.)');
  console.log('4. Collect completed forms');
  console.log('5. Digitise responses for analysis');
  console.log('');
  console.log('( Ready for pilot distribution!');
}

/**
 * Main execution
 */
function main() {
  console.log('=€ Pilot Feedback Pack Generator');
  console.log('=================================\n');

  // Ensure directories exist
  ensureDirectories();

  // Validate feedback files
  if (!validateFeedbackFiles()) {
    console.error('\nL Cannot create feedback pack without all required files');
    process.exit(1);
  }

  // Create the pack
  const packPath = createFeedbackPack();

  if (packPath) {
    printSummary(packPath);
    console.log('\n Path:', packPath);
  } else {
    console.error('\nL Feedback pack creation failed');
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createFeedbackPack };