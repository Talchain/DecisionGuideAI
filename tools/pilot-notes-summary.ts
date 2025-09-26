#!/usr/bin/env npx tsx
/**
 * Pilot Notes Summary Generator
 *
 * Analyzes pilot notes and generates a summary report.
 * Usage: npx tsx tools/pilot-notes-summary.ts
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const REPORTS_DIR = join(PROJECT_ROOT, 'artifacts', 'reports');
const NOTES_FILE = join(REPORTS_DIR, 'pilot-notes.md');
const SUMMARY_FILE = join(REPORTS_DIR, 'pilot-notes-summary.md');

interface Note {
  timestamp: Date;
  text: string;
  categories: string[];
}

interface Summary {
  totalNotes: number;
  dateRange: { start: Date; end: Date } | null;
  categories: { [category: string]: number };
  trends: string[];
  recommendations: string[];
  notes: Note[];
}

function parseNotes(): Note[] {
  if (!existsSync(NOTES_FILE)) {
    console.warn('⚠️  No pilot notes file found');
    return [];
  }

  const content = readFileSync(NOTES_FILE, 'utf8');
  const notes: Note[] = [];

  // Extract notes using regex for timestamp pattern
  const notePattern = /\*\*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\*\*:\s*(.+?)(?=\n\n|\n\*\*|\n$|$)/gs;

  let match;
  while ((match = notePattern.exec(content)) !== null) {
    const [, timestampStr, text] = match;
    const timestamp = new Date(timestampStr);
    const categories = categorizeNote(text);

    notes.push({
      timestamp,
      text: text.trim(),
      categories
    });
  }

  return notes.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function categorizeNote(text: string): string[] {
  const lowerText = text.toLowerCase();
  const categories: string[] = [];

  // Feature feedback
  if (lowerText.includes('stream') || lowerText.includes('token') || lowerText.includes('flow')) {
    categories.push('streaming');
  }
  if (lowerText.includes('job') || lowerText.includes('progress') || lowerText.includes('background')) {
    categories.push('jobs');
  }
  if (lowerText.includes('report') || lowerText.includes('analysis') || lowerText.includes('recommendation')) {
    categories.push('reports');
  }
  if (lowerText.includes('cancel') || lowerText.includes('stop') || lowerText.includes('abort')) {
    categories.push('cancellation');
  }

  // Sentiment
  const positiveWords = ['great', 'excellent', 'good', 'love', 'like', 'fast', 'smooth', 'easy'];
  const negativeWords = ['slow', 'difficult', 'confusing', 'broken', 'issue', 'problem'];

  const hasPositive = positiveWords.some(word => lowerText.includes(word));
  const hasNegative = negativeWords.some(word => lowerText.includes(word));

  if (hasPositive && !hasNegative) categories.push('positive');
  if (hasNegative && !hasPositive) categories.push('negative');
  if (hasPositive && hasNegative) categories.push('mixed');

  // Question vs feedback
  if (lowerText.includes('how') || lowerText.includes('what') || lowerText.includes('why') || text.includes('?')) {
    categories.push('question');
  } else if (lowerText.includes('should') || lowerText.includes('could') || lowerText.includes('suggest')) {
    categories.push('suggestion');
  } else {
    categories.push('feedback');
  }

  // Integration related
  if (lowerText.includes('integration') || lowerText.includes('api') || lowerText.includes('code')) {
    categories.push('integration');
  }
  if (lowerText.includes('ui') || lowerText.includes('interface') || lowerText.includes('design')) {
    categories.push('ui-ux');
  }

  return categories.length > 0 ? categories : ['general'];
}

function generateSummary(notes: Note[]): Summary {
  const summary: Summary = {
    totalNotes: notes.length,
    dateRange: null,
    categories: {},
    trends: [],
    recommendations: [],
    notes
  };

  if (notes.length === 0) {
    return summary;
  }

  // Date range
  summary.dateRange = {
    start: notes[0].timestamp,
    end: notes[notes.length - 1].timestamp
  };

  // Category counts
  notes.forEach(note => {
    note.categories.forEach(category => {
      summary.categories[category] = (summary.categories[category] || 0) + 1;
    });
  });

  // Generate trends
  const topCategories = Object.entries(summary.categories)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  summary.trends = [
    `Most discussed: ${topCategories[0] ? topCategories[0][0] : 'N/A'} (${topCategories[0] ? topCategories[0][1] : 0} mentions)`,
    `Positive feedback: ${summary.categories.positive || 0} notes`,
    `Questions raised: ${summary.categories.question || 0} notes`,
    `Integration focus: ${summary.categories.integration || 0} notes`
  ];

  // Generate recommendations
  const positiveRatio = (summary.categories.positive || 0) / notes.length;
  const questionRatio = (summary.categories.question || 0) / notes.length;

  if (positiveRatio > 0.6) {
    summary.recommendations.push('Strong positive reception - consider accelerating pilot timeline');
  } else if (positiveRatio < 0.3) {
    summary.recommendations.push('Mixed reception - review feedback for improvement areas');
  }

  if (questionRatio > 0.4) {
    summary.recommendations.push('Many questions raised - consider additional documentation or FAQ');
  }

  if (summary.categories.streaming > summary.categories.jobs) {
    summary.recommendations.push('Stream functionality resonates well - highlight in future demos');
  }

  if (summary.categories.integration > 2) {
    summary.recommendations.push('High integration interest - ensure Windsurf pack is readily available');
  }

  return summary;
}

function formatSummary(summary: Summary): string {
  let output = `# Pilot Notes Summary

Generated: ${new Date().toISOString()}

## 📊 Overview

- **Total Notes**: ${summary.totalNotes}
- **Date Range**: ${summary.dateRange ?
    `${summary.dateRange.start.toLocaleDateString()} to ${summary.dateRange.end.toLocaleDateString()}` :
    'No notes available'}

## 📈 Key Trends

${summary.trends.map(trend => `- ${trend}`).join('\n')}

## 📋 Category Breakdown

${Object.entries(summary.categories)
  .sort(([,a], [,b]) => b - a)
  .map(([category, count]) => `- **${category}**: ${count} mentions`)
  .join('\n')}

## 💡 Recommendations

${summary.recommendations.length > 0 ?
  summary.recommendations.map(rec => `- ${rec}`).join('\n') :
  '- Continue gathering feedback for actionable insights'}

## 📝 Recent Notes

${summary.notes.slice(-5).map(note =>
  `**${note.timestamp.toLocaleDateString()} ${note.timestamp.toLocaleTimeString()}**: ${note.text}`
).join('\n\n')}

${summary.notes.length > 5 ? `\n*Showing last 5 of ${summary.notes.length} total notes*` : ''}

---

**Note**: This summary contains no personal data or sensitive information. All notes are aggregated feedback only.
`;

  return output;
}

function main(): void {
  console.log('📊 Generating pilot notes summary...');

  try {
    const notes = parseNotes();
    const summary = generateSummary(notes);
    const formattedSummary = formatSummary(summary);

    writeFileSync(SUMMARY_FILE, formattedSummary);

    console.log(`✅ Summary generated with ${notes.length} notes`);
    console.log(`📁 Summary saved to: ${SUMMARY_FILE}`);

    if (notes.length === 0) {
      console.log('\n💡 Use "npm run pilot:note" to capture feedback during demos');
    } else {
      console.log('\n📈 Key insights:');
      summary.trends.slice(0, 2).forEach(trend => console.log(`   • ${trend}`));
    }

  } catch (error) {
    console.error('❌ Error generating summary:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}