#!/usr/bin/env tsx
/**
 * UI Kick-start Pack for DecisionGuide AI
 * Creates a single zip with everything Windsurf needs, no servers required
 * Usage: npm run ui:kickstart
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, cpSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const ARTIFACTS_DIR = join(PROJECT_ROOT, 'artifacts');

class UIKickstartPacker {
  private timestamp: string;
  private packDir: string;

  constructor() {
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '-' +
                    new Date().getTime().toString().slice(-6);
    this.packDir = `/tmp/claude/ui-kickstart-${this.timestamp}`;
  }

  log(message: string): void {
    console.log(message);
  }

  async createKickstartPack(): Promise<string> {
    this.log('📦 UI Kick-start Pack Generator');
    this.log('=' .repeat(40));

    // 1. Create temporary directory structure
    await this.setupPackDirectory();

    // 2. Copy essential files
    await this.copyUIFixtures();
    await this.copyUIViewModels();
    await this.copyGeneratedTypes();
    await this.copySampleReports();
    await this.copyTranscripts();

    // 3. Create integration README
    await this.createIntegrationReadme();

    // 4. Create the zip file
    const zipPath = await this.createZipFile();

    // 5. Clean up
    await this.cleanup();

    this.log(`\n✅ UI Kick-start Pack created: ${zipPath}`);
    return zipPath;
  }

  private async setupPackDirectory(): Promise<void> {
    this.log('🏗️  Setting up pack directory...');

    execSync(`mkdir -p ${this.packDir}`);
    execSync(`mkdir -p ${this.packDir}/ui-fixtures`);
    execSync(`mkdir -p ${this.packDir}/ui-viewmodels`);
    execSync(`mkdir -p ${this.packDir}/types`);
    execSync(`mkdir -p ${this.packDir}/samples`);
    execSync(`mkdir -p ${this.packDir}/transcripts`);
  }

  private async copyUIFixtures(): Promise<void> {
    this.log('📋 Copying UI fixtures...');

    const uiFixturesDir = join(ARTIFACTS_DIR, 'ui-fixtures');
    if (existsSync(uiFixturesDir)) {
      cpSync(uiFixturesDir, join(this.packDir, 'ui-fixtures'), { recursive: true });
    }
  }

  private async copyUIViewModels(): Promise<void> {
    this.log('🏗️  Copying UI view models...');

    const uiViewModelsDir = join(ARTIFACTS_DIR, 'ui-viewmodels');
    if (existsSync(uiViewModelsDir)) {
      cpSync(uiViewModelsDir, join(this.packDir, 'ui-viewmodels'), { recursive: true });
    }
  }

  private async copyGeneratedTypes(): Promise<void> {
    this.log('📝 Copying generated types...');

    const typesDir = join(ARTIFACTS_DIR, 'types');
    if (existsSync(typesDir)) {
      // Copy all TypeScript definition files
      const typeFiles = ['README.md', 'ui-models.d.ts', 'report-v1.d.ts', 'sse-events.d.ts'];

      typeFiles.forEach(file => {
        const srcPath = join(typesDir, file);
        const destPath = join(this.packDir, 'types', file);

        if (existsSync(srcPath)) {
          cpSync(srcPath, destPath);
        }
      });
    }
  }

  private async copySampleReports(): Promise<void> {
    this.log('📊 Copying sample reports...');

    const sampleReports = [
      'report-v1-sample.json',
      'sample-report.json',
      'sample-report.export.json',
      'contracts/examples/report-v1-payload.json'
    ];

    sampleReports.forEach(reportPath => {
      const srcPath = join(ARTIFACTS_DIR, reportPath);
      const fileName = basename(reportPath);
      const destPath = join(this.packDir, 'samples', fileName);

      if (existsSync(srcPath)) {
        cpSync(srcPath, destPath);
      }
    });
  }

  private async copyTranscripts(): Promise<void> {
    this.log('📜 Copying sample transcript...');

    const transcriptsDir = join(ARTIFACTS_DIR, 'transcripts');
    if (existsSync(transcriptsDir)) {
      // Copy the framework test transcript as an example
      const frameworkTranscript = join(transcriptsDir, 'framework-test.html');
      if (existsSync(frameworkTranscript)) {
        cpSync(frameworkTranscript, join(this.packDir, 'transcripts', 'sample-transcript.html'));
      }
    }
  }

  private async createIntegrationReadme(): Promise<void> {
    this.log('📖 Creating integration README...');

    const readmeContent = `# UI Kick-start Pack for DecisionGuide AI

**Generated**: ${new Date().toISOString()}
**Version**: ${this.timestamp}

This pack contains everything you need to integrate DecisionGuide AI locally without running servers.

## 🚀 Quick Start

### 1. Stream Integration (SSE)

Use the UI fixtures to wire up Server-Sent Events (SSE) streaming:

\`\`\`typescript
// Example: Wire up stream events with fixtures
import { sseFixtures } from './ui-fixtures/1-happy-path/sse-events.json';

// Stream events locally using fixtures
const mockStream = new EventSource('/dev/null'); // Replace with mock
sseFixtures.forEach((event, index) => {
  setTimeout(() => {
    const mockEvent = new MessageEvent('message', {
      data: JSON.stringify(event)
    });
    mockStream.dispatchEvent(mockEvent);
  }, index * 1000); // 1 second intervals
});
\`\`\`

### 2. Jobs Integration

Wire up background jobs using the jobs fixtures:

\`\`\`typescript
// Example: Mock jobs progress
import { jobsProgress } from './ui-fixtures/5-jobs-progress-cancel/jobs-state.json';

// Simulate job progress updates
const mockJobUpdate = (jobId: string) => {
  const states = jobsProgress.timeline;
  let currentStep = 0;

  const interval = setInterval(() => {
    if (currentStep >= states.length) {
      clearInterval(interval);
      return;
    }

    // Update your job UI with states[currentStep]
    updateJobUI(jobId, states[currentStep]);
    currentStep++;
  }, 2000);
};
\`\`\`

### 3. Report Integration

Use the sample Report v1 JSON for UI development:

\`\`\`typescript
// Example: Load sample report
import sampleReport from './samples/report-v1-sample.json';
import type { ReportV1 } from './types/report-v1';

const report: ReportV1 = sampleReport;

// Use report data to populate your UI
const renderReport = (report: ReportV1) => {
  return {
    title: report.decision.title,
    options: report.decision.options,
    analysis: report.analysis,
    recommendation: report.recommendation
  };
};
\`\`\`

## 📂 Directory Structure

### \`ui-fixtures/\`
Ready-to-use UI fixture data for different scenarios:
- **1-happy-path/**: Normal analysis flow
- **2-resume-last-event-id/**: Resuming interrupted streams
- **3-mid-stream-cancel/**: Handling cancellation
- **4-error-stream/**: Error handling
- **5-jobs-progress-cancel/**: Background job management

### \`ui-viewmodels/\`
Pre-computed view models for different UI states and components.

### \`types/\`
Generated TypeScript definitions:
- **ui-models.d.ts**: UI component types
- **report-v1.d.ts**: Report format types
- **sse-events.d.ts**: Server-Sent Event types

### \`samples/\`
Sample data files:
- **report-v1-sample.json**: Complete report example
- **sample-report.json**: Basic report structure
- **report-v1-payload.json**: API payload example

### \`transcripts/\`
- **sample-transcript.html**: Complete analysis transcript

## 🛠️ Integration Steps

### Step 1: Type Safety
1. Import types from \`./types/\` directory
2. Use \`ReportV1\`, \`SSEEvent\`, and \`UIModels\` interfaces

### Step 2: Mock Data
1. Use fixtures from \`./ui-fixtures/\` for realistic UI states
2. Load sample reports from \`./samples/\` for development data

### Step 3: Stream Simulation
1. Use SSE fixtures to simulate real-time updates
2. Wire up cancel/resume functionality using fixture patterns

### Step 4: Jobs UI
1. Implement progress indicators using jobs fixtures
2. Handle cancellation and error states

## 🚨 Important Flags (Keep OFF by default)

All powerful features are disabled by default:

\`\`\`typescript
// Default configuration - safe for development
const config = {
  // Rate limiting: OFF by default
  ENABLE_RATE_LIMITING: false,

  // Caching: OFF by default
  ENABLE_CACHE: false,

  // Usage tracking: OFF by default
  ENABLE_USAGE_TRACKING: false,

  // Monitoring: OFF by default
  ENABLE_MONITORING: false,

  // Secret hygiene: OFF by default (blocking)
  ENABLE_SECRET_HYGIENE_BLOCKING: false,

  // SLOs: OFF by default
  ENABLE_SLOS: false
};
\`\`\`

## 📋 Development Checklist

- [ ] Import TypeScript types
- [ ] Wire up SSE streaming with fixtures
- [ ] Implement jobs progress UI
- [ ] Load and display sample reports
- [ ] Test cancellation flows
- [ ] Handle error states
- [ ] Verify no secrets are logged
- [ ] Keep powerful features OFF

## 🔗 Related Files

- **UI Fixtures README**: \`./ui-fixtures/README.md\`
- **Types Documentation**: \`./types/README.md\`
- **Sample Transcript**: \`./transcripts/sample-transcript.html\`

## 📞 Support

This is a self-contained development pack. All data is static and safe for local development.

**No servers required** • **No secrets included** • **Offline development ready**

---
*Generated by DecisionGuide AI UI Kick-start Pack Generator*`;

    writeFileSync(join(this.packDir, 'README.md'), readmeContent);
  }

  private async createZipFile(): Promise<string> {
    this.log('🗜️  Creating zip file...');

    const zipFileName = `ui-kickstart-${this.timestamp}.zip`;
    const zipPath = join(ARTIFACTS_DIR, zipFileName);

    // Create zip using system zip command
    execSync(`cd ${dirname(this.packDir)} && zip -r ${zipPath} ${basename(this.packDir)}`, {
      stdio: 'pipe'
    });

    return zipPath;
  }

  private async cleanup(): Promise<void> {
    this.log('🧹 Cleaning up temporary files...');
    execSync(`rm -rf ${this.packDir}`);
  }

  async printPackSummary(zipPath: string): Promise<void> {
    // Get zip contents and size
    const zipSize = execSync(`du -h "${zipPath}" | cut -f1`, { encoding: 'utf-8' }).trim();
    const zipContents = execSync(`unzip -l "${zipPath}" | wc -l`, { encoding: 'utf-8' }).trim();

    console.log('\n📦 UI Kick-start Pack Summary');
    console.log('=' .repeat(35));
    console.log(`File: ${basename(zipPath)}`);
    console.log(`Size: ${zipSize}`);
    console.log(`Files: ~${zipContents} entries`);
    console.log(`Path: ${relative(PROJECT_ROOT, zipPath)}`);

    console.log('\n📋 Contents:');
    console.log('   • UI fixtures (5 scenarios)');
    console.log('   • UI view models');
    console.log('   • Generated TypeScript types');
    console.log('   • Sample Report v1 JSON');
    console.log('   • Sample transcript');
    console.log('   • Integration README with exact steps');

    console.log('\n🎯 Ready for Windsurf integration (no servers required)');
  }
}

// Run the packer if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const packer = new UIKickstartPacker();
  packer.createKickstartPack().then(zipPath => {
    packer.printPackSummary(zipPath);
  }).catch(error => {
    console.error('UI Kick-start pack creation failed:', error);
    process.exit(1);
  });
}

export { UIKickstartPacker };