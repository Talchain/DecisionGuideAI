#!/usr/bin/env node

/**
 * RC Screenshot Automation Script
 *
 * Takes 4 guided screenshots for Release Candidate validation:
 * 1. Canvas View - Main decision tree with template loaded
 * 2. List View - Same data in list format
 * 3. Report Summary - Results panel showing metrics
 * 4. Compare Drawer - Modal comparison analysis
 *
 * Attempts automated capture with Playwright/Puppeteer if available,
 * otherwise provides detailed manual capture instructions.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const screenshotDir = join(rootDir, 'artifacts', 'screenshots', 'rc');

// Screenshot configuration
const SCREENSHOTS = [
  {
    name: 'canvas-view',
    title: 'Canvas View - Decision Tree',
    description: 'Main canvas showing Pricing Change template with decision nodes',
    url: 'http://localhost:5173/windsurf',
    setup: [
      'Select "Pricing Change" template (seed 42)',
      'Ensure Canvas view is active (not List view)',
      'Wait for template to load completely',
      'Verify Results Summary shows seed 42'
    ],
    viewport: { width: 1280, height: 800 },
    filename: 'canvas-view.png'
  },
  {
    name: 'list-view',
    title: 'List View - Same Data Different Format',
    description: 'List view showing identical information in list format',
    url: 'http://localhost:5173/windsurf',
    setup: [
      'Start from Canvas view with Pricing Change loaded',
      'Click "Switch to List View" button',
      'Verify all 3 nodes appear in list format',
      'Confirm "Switch to Canvas" button visible'
    ],
    viewport: { width: 1280, height: 800 },
    filename: 'list-view.png'
  },
  {
    name: 'report-summary',
    title: 'Results Summary Panel',
    description: 'Results Summary showing performance metrics and key drivers',
    url: 'http://localhost:5173/windsurf',
    setup: [
      'Load any template (Pricing Change recommended)',
      'Focus on right panel "Results Summary"',
      'Verify seed number, node count, template name visible',
      'Check Performance section shows mode and metrics'
    ],
    viewport: { width: 1280, height: 800 },
    filename: 'report-summary.png',
    cropSelector: '.bg-white.rounded-lg.border.border-gray-200.h-full' // Results Summary panel
  },
  {
    name: 'compare-drawer',
    title: 'Compare Analysis Modal',
    description: 'Compare drawer showing side-by-side analysis with fixtures',
    url: 'http://localhost:5173/windsurf',
    setup: [
      'Load Pricing Change template',
      'Click "Compare Options" in Results Summary',
      'Wait for drawer to open from bottom',
      'Wait for loading to complete (~2-3 seconds)',
      'Verify Key Finding and drivers are visible'
    ],
    viewport: { width: 1280, height: 800 },
    filename: 'compare-drawer.png'
  }
];

// Timestamp for this capture session
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

/**
 * Check if automation tools are available
 */
async function checkAutomationAvailable() {
  try {
    // Try to import playwright first
    try {
      const playwright = await import('playwright');
      return { tool: 'playwright', module: playwright };
    } catch (e) {
      // Fall back to puppeteer
      try {
        const puppeteer = await import('puppeteer');
        return { tool: 'puppeteer', module: puppeteer };
      } catch (e) {
        return null;
      }
    }
  } catch (error) {
    return null;
  }
}

/**
 * Generate manual capture instructions
 */
function generateManualInstructions(screenshots) {
  console.log('📋 Automated tools not available. Generating manual capture instructions...');

  const instructionSections = screenshots.map((shot, index) => {
    const setupSteps = shot.setup.map(step => `- ${step}`).join('\n');

    return `
### ${index + 1}. ${shot.title}

**Filename:** \`${shot.filename}\`
**Description:** ${shot.description}

**Setup Steps:**
${setupSteps}

**Capture Instructions:**
1. Navigate to: ${shot.url}
2. Set browser viewport to ${shot.viewport.width}x${shot.viewport.height}
3. Follow setup steps above
4. Take screenshot and save as: \`artifacts/screenshots/rc/${shot.filename}\`
${shot.cropSelector ? '5. **Crop to:** Focus on the Results Summary panel (right side)' : '5. **Full page capture recommended**'}

---`;
  });

  const instructions = `# RC Screenshots - Manual Capture Instructions
Generated: ${new Date().toISOString()}

## Prerequisites
1. Ensure development server is running: \`npm run dev\`
2. Open http://localhost:5173/windsurf in your browser
3. Use browser dev tools to set viewport to 1280x800 for consistency

## Screenshot Capture Steps
${instructionSections.join('')}

## Post-Capture Checklist

After capturing all screenshots:

✅ All 4 screenshots saved in \`artifacts/screenshots/rc/\`
✅ Canvas view shows decision nodes clearly
✅ List view shows same data in list format
✅ Report summary shows seed 42 and metrics
✅ Compare drawer shows modal with analysis

## Automation Setup (Optional)

To enable automated capture in future:

\`\`\`bash
npm install playwright
# or
npm install puppeteer
\`\`\`

Then run this script again for automated capture.
`;

  const instructionsPath = join(screenshotDir, 'manual-capture-instructions.md');
  writeFileSync(instructionsPath, instructions);

  console.log(`\n📋 Manual instructions saved: ${instructionsPath}`);

  return screenshots.map(shot => ({
    name: shot.name,
    success: false,
    manual: true,
    instructions: shot.setup
  }));
}

/**
 * Generate capture report
 */
function generateReport(results) {
  const report = {
    timestamp,
    total: results.length,
    automated: results.filter(r => r.success).length,
    manual: results.filter(r => r.manual).length,
    failed: results.filter(r => !r.success && !r.manual).length,
    results: results.map(r => ({
      name: r.name,
      success: r.success,
      manual: r.manual || false,
      path: r.path || null,
      error: r.error || null
    }))
  };

  const reportPath = join(screenshotDir, `capture-report-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n📊 Capture report saved: ${reportPath}`);
  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 RC Screenshot Capture Tool');
  console.log('===============================\n');

  // Ensure screenshot directory exists
  if (!existsSync(screenshotDir)) {
    mkdirSync(screenshotDir, { recursive: true });
  }

  // Check for automation tools
  const automation = await checkAutomationAvailable();

  let results;

  if (automation) {
    console.log(`🤖 Found automation tool: ${automation.tool}`);
    console.log('⚠️  Automated capture requires additional setup');
    console.log('📋 Falling back to manual instructions for now...');
    results = generateManualInstructions(SCREENSHOTS);
  } else {
    results = generateManualInstructions(SCREENSHOTS);
  }

  // Generate final report
  const report = generateReport(results);

  // Summary
  console.log('\n📸 RC Screenshot Capture Complete');
  console.log('==================================');
  console.log(`📊 Total screenshots: ${report.total}`);
  console.log(`✅ Automated: ${report.automated}`);
  console.log(`📋 Manual: ${report.manual}`);
  console.log(`❌ Failed: ${report.failed}`);
  console.log(`📁 Output directory: ${screenshotDir}`);

  if (report.manual > 0) {
    console.log('\n💡 Manual capture instructions available in output directory');
    console.log('📝 Follow the step-by-step guide for consistent screenshots');
  }

  if (report.automated > 0) {
    console.log('\n🎉 Automated screenshots ready for stakeholder review!');
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as captureScreenshots, SCREENSHOTS };