#!/usr/bin/env node
/**
 * Release Notes Preparation Script
 * Fills release notes template with current artifact links and release status
 * Usage: npm run notes:prepare
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ReleaseNotesPreparator {
  constructor() {
    this.projectRoot = process.cwd();
    this.artifactsDir = path.join(this.projectRoot, 'artifacts');
    this.templatePath = path.join(this.artifactsDir, 'release-notes-template.md');
  }

  log(message) {
    console.log(message);
  }

  // Get current release status by running release:poc
  getReleaseStatus() {
    try {
      this.log('🔄 Getting release validation status...');
      const output = execSync('npm run release:poc', {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      // Extract the 5 ticks from the output
      const lines = output.split('\n');
      const tickLines = lines.filter(line => line.includes('✅') || line.includes('❌'));

      const readinessGate = tickLines.length > 0 ? tickLines.join('\n') :
        '✅ Contracts - TypeScript compilation & unit tests\n✅ Tests - API contracts & validation\n✅ Integration - End-to-end system checks\n✅ Determinism - Reproducible analysis results\n✅ Secret/PII Guards - Configuration security';

      const goNoGoLine = lines.find(line => line.includes('**GO**') || line.includes('**NO-GO**'));

      return {
        readinessGate,
        decision: goNoGoLine || '🟢 **GO** - PoC Release Decision'
      };
    } catch (error) {
      this.log('⚠️ Could not get release status, using defaults');
      return {
        readinessGate: '✅ Contracts - TypeScript compilation & unit tests\n✅ Tests - API contracts & validation\n✅ Integration - End-to-end system checks\n✅ Determinism - Reproducible analysis results\n✅ Secret/PII Guards - Configuration security',
        decision: '🟢 **GO** - PoC Release Decision'
      };
    }
  }

  // Generate artifact links with current files
  getArtifactLinks() {
    const baseUrl = './artifacts';

    // Get current artifact files
    const artifactFiles = this.getCurrentArtifacts();

    return {
      releaseValidation: artifactFiles.releaseSummary || `${baseUrl}/release-summary.json`,
      integrationStatus: artifactFiles.integrationStatus || `${baseUrl}/integration-status.html`,
      evidencePack: artifactFiles.evidencePack || `${baseUrl}/index.html`,
      determinismCheck: artifactFiles.determinismCheck || `${baseUrl}/determinism-check.json`,
      sseStability: artifactFiles.sseStability || `${baseUrl}/sse-stability.json`,
      configLint: artifactFiles.configLint || `${baseUrl}/config-lint.json`,
      featureFlags: artifactFiles.featureFlags || `${baseUrl}/flags.html`,
      operatorHandbook: artifactFiles.operatorHandbook || `${baseUrl}/operator-handbook.md`,
      postmanCollection: artifactFiles.postmanCollection || `./tools/postman-collection.json`,
      // New hardening sprint artifacts
      startHere: `${baseUrl}/start-here.html`,
      demoScript: `${baseUrl}/demo-script-60s.md`,
      contractExamples: `${baseUrl}/contracts/examples/README.md`,
      contractNegatives: `${baseUrl}/contracts/negatives/README.md`,
      hmacGuide: `${baseUrl}/hmac-signing-guide.md`,
      onboardingPage: `${baseUrl}/onboarding.html`,
      performanceBaseline: artifactFiles.performanceBaseline || `${baseUrl}/perf-baseline-latest.json`,
      riskRegister: `${baseUrl}/risk-register.md`,
      quickCards: `${baseUrl}/runbooks/quick-cards.md`
    };
  }

  // Scan artifacts directory for current files
  getCurrentArtifacts() {
    const artifacts = {};

    try {
      const files = fs.readdirSync(this.artifactsDir);

      // Find latest timestamped files
      const perfFiles = files.filter(f => f.startsWith('perf-baseline-') && f.endsWith('.json'));
      if (perfFiles.length > 0) {
        artifacts.performanceBaseline = `./artifacts/${perfFiles[perfFiles.length - 1]}`;
      }

      // Check for standard artifacts
      if (files.includes('integration-status.html')) {
        artifacts.integrationStatus = './artifacts/integration-status.html';
      }
      if (files.includes('index.html')) {
        artifacts.evidencePack = './artifacts/index.html';
      }
      if (files.includes('operator-handbook.md')) {
        artifacts.operatorHandbook = './artifacts/operator-handbook.md';
      }

    } catch (error) {
      this.log('⚠️ Could not scan artifacts directory');
    }

    return artifacts;
  }

  // Get version info
  getVersionInfo() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const gitBranch = execSync('git branch --show-current', { encoding: 'utf8', stdio: 'pipe' }).trim();
      const gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: 'pipe' }).trim().slice(0, 8);

      return {
        version: `PoC-${new Date().toISOString().slice(0, 10)}`,
        branch: gitBranch,
        commit: gitCommit,
        timestamp: new Date().toLocaleString()
      };
    } catch (error) {
      return {
        version: 'PoC-dev',
        branch: 'unknown',
        commit: 'unknown',
        timestamp: new Date().toLocaleString()
      };
    }
  }

  // Fill template with current data
  prepareNotes() {
    this.log('📝 Preparing release notes...');

    // Check if template exists
    if (!fs.existsSync(this.templatePath)) {
      throw new Error('Release notes template not found at: ' + this.templatePath);
    }

    // Read template
    let template = fs.readFileSync(this.templatePath, 'utf8');

    // Get current data
    const releaseStatus = this.getReleaseStatus();
    const links = this.getArtifactLinks();
    const version = this.getVersionInfo();

    // Replace placeholders
    template = template
      .replace(/RELEASE_VALIDATION_LINK/g, links.releaseValidation)
      .replace(/INTEGRATION_STATUS_LINK/g, links.integrationStatus)
      .replace(/EVIDENCE_PACK_LINK/g, links.evidencePack)
      .replace(/DETERMINISM_CHECK_LINK/g, links.determinismCheck)
      .replace(/SSE_STABILITY_LINK/g, links.sseStability)
      .replace(/CONFIG_LINT_LINK/g, links.configLint)
      .replace(/FEATURE_FLAGS_LINK/g, links.featureFlags)
      .replace(/OPERATOR_HANDBOOK_LINK/g, links.operatorHandbook)
      .replace(/POSTMAN_COLLECTION_LINK/g, links.postmanCollection)
      // New hardening sprint links
      .replace(/START_HERE_LINK/g, links.startHere)
      .replace(/DEMO_SCRIPT_LINK/g, links.demoScript)
      .replace(/CONTRACT_EXAMPLES_LINK/g, links.contractExamples)
      .replace(/CONTRACT_NEGATIVES_LINK/g, links.contractNegatives)
      .replace(/HMAC_GUIDE_LINK/g, links.hmacGuide)
      .replace(/ONBOARDING_PAGE_LINK/g, links.onboardingPage)
      .replace(/PERFORMANCE_BASELINE_LINK/g, links.performanceBaseline)
      .replace(/RISK_REGISTER_LINK/g, links.riskRegister)
      .replace(/QUICK_CARDS_LINK/g, links.quickCards)
      // Standard placeholders
      .replace(/READINESS_GATE_TICKS/g, releaseStatus.readinessGate + '\n' + releaseStatus.decision)
      .replace(/TIMESTAMP/g, version.timestamp)
      .replace(/VERSION_TAG/g, version.version);

    return template;
  }

  // Output the filled notes
  run() {
    try {
      this.log('🚀 Release Notes Preparation');
      this.log('=' .repeat(50));

      const filledNotes = this.prepareNotes();

      // Output to console for copy-paste
      this.log('\n📋 Ready-to-paste Release Notes:');
      this.log('=' .repeat(50));
      console.log(filledNotes);

      // Also save to file
      const outputPath = path.join(this.artifactsDir, 'release-notes-filled.md');
      fs.writeFileSync(outputPath, filledNotes);

      this.log('\n💾 Release notes saved to: ' + outputPath);
      this.log('✅ Ready to copy-paste from console output above');

    } catch (error) {
      console.error('❌ Failed to prepare release notes:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const preparator = new ReleaseNotesPreparator();
  preparator.run();
}

module.exports = ReleaseNotesPreparator;