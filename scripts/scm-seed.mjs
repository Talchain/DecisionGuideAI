#!/usr/bin/env node

/**
 * SCM-lite Seeder
 * Seeds starter templates into SCM-lite when SCM_ENABLE=1 and SCM_WRITES=1
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base API URL (can be overridden by environment)
const API_BASE = process.env.SCM_API_BASE || 'http://localhost:3001';

/**
 * Make HTTP request
 */
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return { data, headers: response.headers };
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Unable to connect to SCM API. Is the server running?');
    }
    throw error;
  }
}

/**
 * Read JSON file
 */
async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
}

/**
 * Check if template already exists in SCM
 */
async function templateExists(scenarioId) {
  try {
    const { data } = await makeRequest('/scm/versions');
    return data.versions.some(version => version.scenarioId === scenarioId);
  } catch (error) {
    console.warn(`Warning: Could not check existing versions: ${error.message}`);
    return false;
  }
}

/**
 * Commit template to SCM
 */
async function commitTemplate(templateData, templateName) {
  try {
    console.log(`📋 Committing ${templateName} template...`);

    const { data, headers } = await makeRequest('/scm/commit', {
      method: 'POST',
      body: JSON.stringify({
        scenario: templateData,
        message: `Add ${templateName} starter template`,
        author: 'SCM Seeder'
      })
    });

    if (headers.get('X-SCM-Writes-Disabled')) {
      console.log(`   ⚠️  ${templateName}: writes disabled (SCM_WRITES=0), simulated only`);
      return { success: true, simulated: true, versionId: data.versionId };
    } else {
      console.log(`   ✅ ${templateName}: committed as version ${data.versionId}`);
      return { success: true, simulated: false, versionId: data.versionId };
    }

  } catch (error) {
    console.error(`   ❌ ${templateName}: failed to commit - ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main seeding function
 */
async function seedTemplates() {
  console.log('🌱 SCM-lite Template Seeder');
  console.log('===========================\n');

  const templatesDir = path.join(__dirname, '..', 'artifacts', 'scm', 'templates');
  const templates = [
    { file: 'pricing-change.json', name: 'Pricing Change' },
    { file: 'feature-launch.json', name: 'Feature Launch' },
    { file: 'build-vs-buy.json', name: 'Build vs Buy' }
  ];

  console.log(`📁 Templates directory: ${templatesDir}`);
  console.log(`🌐 SCM API: ${API_BASE}`);
  console.log(`🔧 Environment: SCM_ENABLE=${process.env.SCM_ENABLE || '0'}, SCM_WRITES=${process.env.SCM_WRITES || '0'}\n`);

  const results = [];

  for (const template of templates) {
    const templatePath = path.join(templatesDir, template.file);

    try {
      // Check if file exists
      await fs.access(templatePath);

      // Read template data
      const templateData = await readJsonFile(templatePath);

      // Check if already exists
      const exists = await templateExists(templateData.scenarioId);
      if (exists) {
        console.log(`📋 ${template.name}: already exists in SCM, skipping`);
        results.push({ template: template.name, status: 'exists' });
        continue;
      }

      // Commit template
      const result = await commitTemplate(templateData, template.name);
      results.push({
        template: template.name,
        status: result.success ? (result.simulated ? 'simulated' : 'committed') : 'failed',
        versionId: result.versionId,
        error: result.error
      });

    } catch (error) {
      console.error(`❌ ${template.name}: ${error.message}`);
      results.push({ template: template.name, status: 'error', error: error.message });
    }
  }

  // Summary
  console.log('\n📊 Seeding Summary');
  console.log('==================');

  const committed = results.filter(r => r.status === 'committed').length;
  const simulated = results.filter(r => r.status === 'simulated').length;
  const existing = results.filter(r => r.status === 'exists').length;
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;

  console.log(`✅ Committed: ${committed}`);
  console.log(`🔄 Simulated: ${simulated}`);
  console.log(`📋 Already existed: ${existing}`);
  console.log(`❌ Failed: ${failed}`);

  if (committed > 0 || simulated > 0) {
    console.log('\n🎉 Template seeding completed successfully!');

    if (simulated > 0) {
      console.log('💡 To persist templates, set SCM_WRITES=1 in your environment');
    }

    console.log('\n🔍 View seeded templates:');
    console.log('   node scripts/olumi-scm.mjs list');
    console.log('   node scripts/olumi-scm.mjs get <version-id>');

  } else if (existing === templates.length) {
    console.log('\n📋 All templates already exist in SCM');

  } else {
    console.log('\n❌ Template seeding completed with errors');
    console.log('💡 Check that SCM_ENABLE=1 and the server is running');
    process.exit(1);
  }
}

/**
 * Help command
 */
function showHelp() {
  console.log(`
SCM-lite Template Seeder

Usage:
  node scripts/scm-seed.mjs [--help]

Description:
  Seeds starter templates into SCM-lite for common decision scenarios.
  Requires SCM_ENABLE=1 and optionally SCM_WRITES=1 for persistence.

Templates:
  • Pricing Change: Evaluate pricing strategy changes
  • Feature Launch: Assess new feature readiness
  • Build vs Buy: Compare in-house vs external solutions

Environment Variables:
  SCM_ENABLE      Enable SCM functionality (default: 0)
  SCM_WRITES      Enable SCM writes (default: 0, read-only mode)
  SCM_API_BASE    SCM API base URL (default: http://localhost:3001)

Examples:
  # Enable SCM and seed templates (read-only)
  SCM_ENABLE=1 node scripts/scm-seed.mjs

  # Enable SCM with writes and seed templates (persistent)
  SCM_ENABLE=1 SCM_WRITES=1 node scripts/scm-seed.mjs

  # View seeded templates
  node scripts/olumi-scm.mjs list
`);
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  await seedTemplates();
}

main().catch(console.error);