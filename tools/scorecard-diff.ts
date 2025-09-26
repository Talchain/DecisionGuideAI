#!/usr/bin/env tsx
/**
 * Scorecard Diff Tool for DecisionGuide AI
 *
 * Compares current integration scorecard against previous version
 * and generates a human-readable diff summary for PR comments
 *
 * Usage: npm run scorecard:diff
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const ARTIFACTS_DIR = join(PROJECT_ROOT, 'artifacts');

interface ScorecardItem {
  id: string;
  name: string;
  owner: string;
  ownerName: string;
  priority: string;
  status: string;
  layer_map: any;
  evidence: any;
  missing: string[];
  acceptance: string;
  links: string[];
  howToFinish?: string;
}

interface ScorecardData {
  generatedAt: string;
  totals: {
    byStatus: { [status: string]: number };
    coveragePercent: number;
    total: number;
    verified: number;
  };
  items: ScorecardItem[];
}

interface ScorecardChange {
  type: 'new' | 'status_change' | 'regression' | 'blocked' | 'removed';
  item: ScorecardItem;
  oldStatus?: string;
  newStatus?: string;
  reason?: string;
}

interface ScorecardDiff {
  timestamp: string;
  hasChanges: boolean;
  coverageChange: number;
  totalChange: number;
  changes: ScorecardChange[];
  summary: string;
}

class ScorecardDiffer {

  async generateDiff(): Promise<ScorecardDiff> {
    console.log('📊 Integration Scorecard Diff Generator');
    console.log('=' .repeat(45));

    const current = this.loadCurrentScorecard();

    if (!current) {
      console.log('❌ No current scorecard found. Run: npm run scorecard:generate first');
      process.exit(1);
    }

    const previous = this.loadPreviousScorecard();

    if (!previous) {
      const diff = this.createInitialDiff(current);
      await this.saveDiff(diff);
      this.printSummary(diff);
      return diff;
    }

    const diff = this.compareScoreCards(current, previous);
    await this.saveDiff(diff);

    this.printSummary(diff);
    return diff;
  }

  private loadCurrentScorecard(): ScorecardData | null {
    const currentPath = join(ARTIFACTS_DIR, 'integration-scorecard.json');

    if (!existsSync(currentPath)) {
      console.log('❌ No current scorecard found. Run: npm run scorecard:generate');
      return null;
    }

    try {
      const content = readFileSync(currentPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.log('❌ Failed to parse current scorecard');
      return null;
    }
  }

  private loadPreviousScorecard(): ScorecardData | null {
    // Look for backup copy from previous run
    const previousPath = join(ARTIFACTS_DIR, 'integration-scorecard.previous.json');

    if (!existsSync(previousPath)) {
      console.log('📋 No previous scorecard found - this appears to be the first run');
      return null;
    }

    try {
      const content = readFileSync(previousPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.log('⚠️  Could not parse previous scorecard');
      return null;
    }
  }

  private createInitialDiff(current: ScorecardData): ScorecardDiff {
    const newItems = current.items.map(item => ({
      type: 'new' as const,
      item,
      reason: 'Initial scorecard generation'
    }));

    return {
      timestamp: new Date().toISOString(),
      hasChanges: true,
      coverageChange: current.totals.coveragePercent,
      totalChange: current.totals.total,
      changes: newItems,
      summary: `Initial scorecard: ${current.totals.coveragePercent}% coverage (${current.totals.verified}/${current.totals.total} verified)`
    };
  }

  private compareScoreCards(current: ScorecardData, previous: ScorecardData): ScorecardDiff {
    const changes: ScorecardChange[] = [];

    // Create lookup maps
    const currentMap = new Map(current.items.map(item => [item.id, item]));
    const previousMap = new Map(previous.items.map(item => [item.id, item]));

    // Find new items
    for (const [id, item] of currentMap) {
      if (!previousMap.has(id)) {
        changes.push({
          type: 'new',
          item,
          reason: 'New integration added'
        });
      }
    }

    // Find removed items
    for (const [id, item] of previousMap) {
      if (!currentMap.has(id)) {
        changes.push({
          type: 'removed',
          item,
          reason: 'Integration removed from registry'
        });
      }
    }

    // Find status changes
    for (const [id, currentItem] of currentMap) {
      const previousItem = previousMap.get(id);
      if (!previousItem) continue;

      if (currentItem.status !== previousItem.status) {
        const isRegression = this.isRegression(previousItem.status, currentItem.status);
        const isBlocked = currentItem.status === 'BLOCKED';

        changes.push({
          type: isBlocked ? 'blocked' : isRegression ? 'regression' : 'status_change',
          item: currentItem,
          oldStatus: previousItem.status,
          newStatus: currentItem.status,
          reason: this.getChangeReason(previousItem, currentItem)
        });
      }
    }

    const coverageChange = current.totals.coveragePercent - previous.totals.coveragePercent;
    const totalChange = current.totals.total - previous.totals.total;

    return {
      timestamp: new Date().toISOString(),
      hasChanges: changes.length > 0 || coverageChange !== 0,
      coverageChange,
      totalChange,
      changes,
      summary: this.generateSummary(current, previous, changes, coverageChange)
    };
  }

  private isRegression(oldStatus: string, newStatus: string): boolean {
    const statusPriority = {
      'VERIFIED_E2E': 5,
      'WIRED_LIVE': 4,
      'WIRED_SIM': 3,
      'SCAFFOLDING': 2,
      'NOT_STARTED': 1,
      'BLOCKED': 0
    };

    const oldPriority = statusPriority[oldStatus] || 0;
    const newPriority = statusPriority[newStatus] || 0;

    return newPriority < oldPriority;
  }

  private getChangeReason(previousItem: ScorecardItem, currentItem: ScorecardItem): string {
    // Analyze evidence changes to infer reason
    const oldEvidenceCount = this.countEvidence(previousItem.evidence);
    const newEvidenceCount = this.countEvidence(currentItem.evidence);

    if (newEvidenceCount > oldEvidenceCount) {
      return 'Additional evidence detected';
    }
    if (newEvidenceCount < oldEvidenceCount) {
      return 'Evidence files removed or relocated';
    }

    // Check specific changes
    if (currentItem.status === 'BLOCKED') {
      return 'Integration blocked (see details)';
    }
    if (currentItem.status === 'VERIFIED_E2E' && previousItem.status !== 'VERIFIED_E2E') {
      return 'E2E verification completed';
    }
    if (currentItem.status.includes('WIRED') && !previousItem.status.includes('WIRED')) {
      return 'Routes/endpoints added';
    }

    return 'Status updated based on evidence changes';
  }

  private countEvidence(evidence: any): number {
    return Object.values(evidence).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  }

  private generateSummary(current: ScorecardData, previous: ScorecardData, changes: ScorecardChange[], coverageChange: number): string {
    const newItems = changes.filter(c => c.type === 'new').length;
    const statusChanges = changes.filter(c => c.type === 'status_change').length;
    const regressions = changes.filter(c => c.type === 'regression').length;
    const blocked = changes.filter(c => c.type === 'blocked').length;

    if (changes.length === 0 && coverageChange === 0) {
      return `No changes - coverage remains ${current.totals.coveragePercent}%`;
    }

    const parts: string[] = [];

    if (coverageChange !== 0) {
      const direction = coverageChange > 0 ? '↑' : '↓';
      parts.push(`Coverage ${direction} ${Math.abs(coverageChange)}% (${current.totals.coveragePercent}%)`);
    }

    if (newItems > 0) parts.push(`${newItems} new`);
    if (statusChanges > 0) parts.push(`${statusChanges} improved`);
    if (regressions > 0) parts.push(`${regressions} regressions`);
    if (blocked > 0) parts.push(`${blocked} blocked`);

    return parts.join(', ');
  }

  private async saveDiff(diff: ScorecardDiff): Promise<void> {
    const diffPath = join(ARTIFACTS_DIR, 'integration-scorecard-diff.md');
    const markdown = this.generateDiffMarkdown(diff);

    writeFileSync(diffPath, markdown);
    console.log(`💾 Saved diff: ${diffPath}`);

    // Also backup current scorecard for next comparison
    const current = this.loadCurrentScorecard();
    if (current) {
      const backupPath = join(ARTIFACTS_DIR, 'integration-scorecard.previous.json');
      writeFileSync(backupPath, JSON.stringify(current, null, 2));
      console.log(`💾 Backed up current scorecard for future comparisons`);
    }
  }

  private generateDiffMarkdown(diff: ScorecardDiff): string {
    const lines = [
      '# Integration Scorecard Changes',
      '',
      `**Generated**: ${diff.timestamp}`,
      `**Summary**: ${diff.summary}`,
      ''
    ];

    if (!diff.hasChanges) {
      lines.push('No changes detected in integration status.');
      return lines.join('\n');
    }

    // New items
    const newItems = diff.changes.filter(c => c.type === 'new');
    if (newItems.length > 0) {
      lines.push('## ✨ New Integrations', '');
      newItems.forEach(change => {
        lines.push(`- **${change.item.name}** (${change.item.priority})`);
        lines.push(`  - Status: ${change.item.status}`);
        lines.push(`  - Owner: ${change.item.ownerName}`);
        lines.push('');
      });
    }

    // Status improvements
    const improvements = diff.changes.filter(c => c.type === 'status_change');
    if (improvements.length > 0) {
      lines.push('## 📈 Status Improvements', '');
      improvements.forEach(change => {
        lines.push(`- **${change.item.name}**`);
        lines.push(`  - ${change.oldStatus} → ${change.newStatus}`);
        lines.push(`  - ${change.reason}`);
        lines.push(`  - Owner: ${change.item.ownerName}`);
        lines.push('');
      });
    }

    // Regressions
    const regressions = diff.changes.filter(c => c.type === 'regression');
    if (regressions.length > 0) {
      lines.push('## 📉 Regressions', '');
      regressions.forEach(change => {
        lines.push(`- **${change.item.name}** ⚠️`);
        lines.push(`  - ${change.oldStatus} → ${change.newStatus}`);
        lines.push(`  - ${change.reason}`);
        lines.push(`  - Owner: ${change.item.ownerName}`);
        lines.push('');
      });
    }

    // Blocked items
    const blocked = diff.changes.filter(c => c.type === 'blocked');
    if (blocked.length > 0) {
      lines.push('## 🚫 Blocked Items', '');
      blocked.forEach(change => {
        lines.push(`- **${change.item.name}** 🔴`);
        lines.push(`  - Previously: ${change.oldStatus}`);
        lines.push(`  - ${change.reason}`);
        lines.push(`  - Owner: ${change.item.ownerName}`);
        lines.push('');
      });
    }

    // Removed items
    const removed = diff.changes.filter(c => c.type === 'removed');
    if (removed.length > 0) {
      lines.push('## 🗑️ Removed Integrations', '');
      removed.forEach(change => {
        lines.push(`- **${change.item.name}**`);
        lines.push(`  - ${change.reason}`);
        lines.push('');
      });
    }

    lines.push('---');
    lines.push('*Generated by Integration Scorecard Diff Tool*');

    return lines.join('\n');
  }

  private printSummary(diff: ScorecardDiff): void {
    console.log('\n📊 Scorecard Diff Summary');
    console.log('=' .repeat(30));
    console.log(`Changes: ${diff.hasChanges ? 'Yes' : 'No'}`);
    console.log(`Summary: ${diff.summary}`);

    if (diff.changes.length > 0) {
      console.log('\n📋 Change Breakdown:');
      const byType = diff.changes.reduce((acc, change) => {
        acc[change.type] = (acc[change.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(byType).forEach(([type, count]) => {
        const icon = type === 'new' ? '✨' : type === 'status_change' ? '📈' :
                     type === 'regression' ? '📉' : type === 'blocked' ? '🚫' : '🗑️';
        console.log(`   ${icon} ${type}: ${count}`);
      });
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const differ = new ScorecardDiffer();
  differ.generateDiff().catch(error => {
    console.error('Scorecard diff failed:', error);
    process.exit(1);
  });
}

export { ScorecardDiffer };