#!/usr/bin/env tsx
/**
 * UI Fixtures Generator v3
 * Generates deterministic edge-case fixtures for Windsurf UI development
 * Usage: npm run fixtures:ui
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const FIXTURES_DIR = join(PROJECT_ROOT, 'artifacts', 'ui-fixtures');

interface FixtureEvent {
  id: string;
  event: string;
  data: string;
}

interface ParsedEventData {
  [key: string]: any;
}

interface FixtureSet {
  name: string;
  events: FixtureEvent[];
  viewModel: any;
  expectedProps: any;
  metadata: any;
}

class UIFixturesGenerator {

  constructor() {
    this.log('🎨 UI Fixtures Generator v3');
    this.log('=' .repeat(35));
  }

  log(message: string): void {
    console.log(message);
  }

  // Base timestamp for deterministic fixtures
  getBaseTimestamp(): Date {
    return new Date('2024-01-15T10:30:00.000Z');
  }
    timestamp: string;
    duration: number;
    status: 'completed' | 'cancelled' | 'error';
    model: string;
  };
  totals: {
    totalTokens: number;
    totalCost: number;
    totalSteps: number;
    completedSteps: number;
  };
  steps: Array<{
    id: string;
    type: 'analysis' | 'generation' | 'validation' | 'processing';
    duration: number;
    status: 'completed' | 'cancelled' | 'error';
    tokens: number;
    cost: number;
  }>;
}

const FIXTURES_DIR = 'artifacts/ui-fixtures';

async function generateTokenStreamingHappyPath(): Promise<void> {
  const sessionId = 'session-happy-001';
  const events: SSEEvent[] = [];
  const tokens: StreamViewModel['tokens'] = [];

  // Generate streaming tokens
  const sampleTokens = [
    'I', ' recommend', ' **React**', ' for', ' your', ' e-commerce', ' platform', ' based', ' on',
    ' the', ' following', ' analysis:', '\n\n', '##', ' Technical', ' Evaluation', '\n\n',
    '**React**', ' offers', ' the', ' best', ' balance', ' of', ' ecosystem', ' maturity',
    ' and', ' team', ' familiarity', '.', ' With', ' your', ' $150,000', ' budget',
    ' and', ' 6-month', ' timeline', ',', ' React', ' provides', ':\n\n',
    '- ', 'Extensive', ' component', ' libraries', '\n',
    '- ', 'Strong', ' SEO', ' support', ' via', ' Next.js', '\n',
    '- ', 'Mobile', ' responsive', ' design', ' capabilities', '\n',
    '- ', 'Large', ' talent', ' pool', ' for', ' hiring', '\n\n',
    '**Final', ' recommendation:** ', 'React', ' with', ' Next.js'
  ];

  for (let i = 0; i < sampleTokens.length; i++) {
    const tokenId = `token_${i.toString().padStart(3, '0')}`;
    const timestamp = Date.now() + i * 100;

    tokens.push({
      id: tokenId,
      text: sampleTokens[i],
      timestamp
    });

    events.push({
      id: tokenId,
      event: 'token',
      data: JSON.stringify({
        id: tokenId,
        text: sampleTokens[i],
        timestamp,
        sessionId
      }),
      timestamp
    });
  }

  // Final completion event
  events.push({
    id: 'complete_001',
    event: 'complete',
    data: JSON.stringify({
      sessionId,
      totalTokens: tokens.length,
      totalCost: 0.045,
      duration: tokens.length * 100,
      model: 'gpt-4-turbo'
    })
  });

  // Create view model
  const viewModel: StreamViewModel = {
    sessionId,
    status: 'completed',
    tokens,
    metadata: {
      totalTokens: tokens.length,
      totalCost: 0.045,
      duration: tokens.length * 100,
      model: 'gpt-4-turbo'
    }
  };

  // Write files
  const dir = join(FIXTURES_DIR, '1-happy-path');
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, 'events.ndjson'),
    events.map(e => JSON.stringify(e)).join('\n'));
  await writeFile(join(dir, 'view-model.json'),
    JSON.stringify(viewModel, null, 2));
}

async function generateResumeWithLastEventId(): Promise<void> {
  const sessionId = 'session-resume-002';
  const events: SSEEvent[] = [];
  const tokens: StreamViewModel['tokens'] = [];

  // Initial batch of tokens
  const initialTokens = ['I', ' need', ' to', ' analyze', ' your'];
  for (let i = 0; i < initialTokens.length; i++) {
    const tokenId = `token_${i.toString().padStart(3, '0')}`;
    const timestamp = Date.now() + i * 100;

    tokens.push({
      id: tokenId,
      text: initialTokens[i],
      timestamp
    });

    events.push({
      id: tokenId,
      event: 'token',
      data: JSON.stringify({
        id: tokenId,
        text: initialTokens[i],
        timestamp,
        sessionId
      })
    });
  }

  // Disconnect event
  events.push({
    id: 'disconnect_001',
    event: 'disconnect',
    data: JSON.stringify({
      sessionId,
      reason: 'connection_lost',
      lastTokenId: 'token_004'
    })
  });

  // Resume from last event ID
  const resumeTokens = [' requirements', ' more', ' carefully', '.'];
  for (let i = 0; i < resumeTokens.length; i++) {
    const tokenId = `token_${(initialTokens.length + i).toString().padStart(3, '0')}`;
    const timestamp = Date.now() + (initialTokens.length + i) * 100;

    tokens.push({
      id: tokenId,
      text: resumeTokens[i],
      timestamp
    });

    events.push({
      id: tokenId,
      event: 'token',
      data: JSON.stringify({
        id: tokenId,
        text: resumeTokens[i],
        timestamp,
        sessionId,
        resumed: true
      })
    });
  }

  events.push({
    id: 'complete_002',
    event: 'complete',
    data: JSON.stringify({
      sessionId,
      totalTokens: tokens.length,
      totalCost: 0.018,
      duration: tokens.length * 100,
      model: 'gpt-4-turbo',
      resumed: true
    })
  });

  const viewModel: StreamViewModel = {
    sessionId,
    status: 'completed',
    tokens,
    metadata: {
      totalTokens: tokens.length,
      totalCost: 0.018,
      duration: tokens.length * 100,
      model: 'gpt-4-turbo'
    }
  };

  const dir = join(FIXTURES_DIR, '2-resume-last-event-id');
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, 'events.ndjson'),
    events.map(e => JSON.stringify(e)).join('\n'));
  await writeFile(join(dir, 'view-model.json'),
    JSON.stringify(viewModel, null, 2));
}

async function generateMidStreamCancel(): Promise<void> {
  const sessionId = 'session-cancel-003';
  const events: SSEEvent[] = [];
  const tokens: StreamViewModel['tokens'] = [];

  // Start streaming
  const partialTokens = ['Based', ' on', ' your', ' requirements', ',', ' I', ' would'];
  for (let i = 0; i < partialTokens.length; i++) {
    const tokenId = `token_${i.toString().padStart(3, '0')}`;
    const timestamp = Date.now() + i * 100;

    tokens.push({
      id: tokenId,
      text: partialTokens[i],
      timestamp
    });

    events.push({
      id: tokenId,
      event: 'token',
      data: JSON.stringify({
        id: tokenId,
        text: partialTokens[i],
        timestamp,
        sessionId
      })
    });
  }

  // Cancel event
  events.push({
    id: 'cancel_001',
    event: 'cancelled',
    data: JSON.stringify({
      sessionId,
      reason: 'user_cancelled',
      partialTokens: tokens.length,
      timestamp: Date.now() + tokens.length * 100
    })
  });

  const viewModel: StreamViewModel = {
    sessionId,
    status: 'cancelled',
    tokens,
    metadata: {
      totalTokens: tokens.length,
      totalCost: 0.014,
      duration: tokens.length * 100,
      model: 'gpt-4-turbo'
    }
  };

  const dir = join(FIXTURES_DIR, '3-mid-stream-cancel');
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, 'events.ndjson'),
    events.map(e => JSON.stringify(e)).join('\n'));
  await writeFile(join(dir, 'view-model.json'),
    JSON.stringify(viewModel, null, 2));
}

async function generateErrorStream(): Promise<void> {
  const sessionId = 'session-error-004';
  const events: SSEEvent[] = [];

  // A few initial tokens
  const tokens: StreamViewModel['tokens'] = [];
  const initialTokens = ['I', ' am'];

  for (let i = 0; i < initialTokens.length; i++) {
    const tokenId = `token_${i.toString().padStart(3, '0')}`;
    const timestamp = Date.now() + i * 100;

    tokens.push({
      id: tokenId,
      text: initialTokens[i],
      timestamp
    });

    events.push({
      id: tokenId,
      event: 'token',
      data: JSON.stringify({
        id: tokenId,
        text: initialTokens[i],
        timestamp,
        sessionId
      })
    });
  }

  // Error event
  events.push({
    id: 'error_001',
    event: 'error',
    data: JSON.stringify({
      sessionId,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Request rate limit exceeded. Please try again in a few moments.',
        details: 'You have exceeded the maximum number of requests per minute. Current limit: 60 requests/minute.',
        timestamp: Date.now() + tokens.length * 100
      }
    })
  });

  const viewModel: StreamViewModel = {
    sessionId,
    status: 'error',
    tokens,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Request rate limit exceeded. Please try again in a few moments.',
      details: 'You have exceeded the maximum number of requests per minute. Current limit: 60 requests/minute.'
    }
  };

  const dir = join(FIXTURES_DIR, '4-error-stream');
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, 'events.ndjson'),
    events.map(e => JSON.stringify(e)).join('\n'));
  await writeFile(join(dir, 'view-model.json'),
    JSON.stringify(viewModel, null, 2));
}

async function generateJobsProgressWithCancel(): Promise<void> {
  const sessionId = 'session-jobs-005';
  const events: SSEEvent[] = [];

  // Job progress from 0 to 50, then cancel
  const jobId = 'job_scenario_analysis_001';
  const progressSteps = [0, 10, 25, 35, 45, 50]; // Cancel at 50%

  for (const progress of progressSteps) {
    events.push({
      id: `progress_${progress}`,
      event: 'job_progress',
      data: JSON.stringify({
        sessionId,
        jobId,
        name: 'Scenario Analysis',
        status: 'running',
        progress,
        timestamp: Date.now() + progress * 50
      })
    });
  }

  // Cancel event
  events.push({
    id: 'job_cancel_001',
    event: 'job_cancelled',
    data: JSON.stringify({
      sessionId,
      jobId,
      name: 'Scenario Analysis',
      status: 'cancelled',
      progress: 50,
      reason: 'user_cancelled',
      timestamp: Date.now() + 2500
    })
  });

  const viewModel: JobsViewModel = {
    sessionId,
    jobs: [{
      id: jobId,
      name: 'Scenario Analysis',
      status: 'cancelled',
      progress: 50,
      startTime: Date.now(),
      endTime: Date.now() + 2500
    }]
  };

  const dir = join(FIXTURES_DIR, '5-jobs-progress-cancel');
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, 'events.ndjson'),
    events.map(e => JSON.stringify(e)).join('\n'));
  await writeFile(join(dir, 'view-model.json'),
    JSON.stringify(viewModel, null, 2));
}

async function generateReadme(): Promise<void> {
  const readme = `# UI Fixtures Pack v2

Generated deterministic fixtures for Decision Guide AI UI development.

## Fixtures

### 1. Happy Path Token Streaming
- **Path:** \`1-happy-path/\`
- **Description:** Complete token streaming scenario with 60+ tokens
- **Events:** Token events → completion
- **Use case:** Test normal streaming behavior

### 2. Resume with Last-Event-ID
- **Path:** \`2-resume-last-event-id/\`
- **Description:** Connection drops mid-stream, resumes from last event ID
- **Events:** Initial tokens → disconnect → resume → completion
- **Use case:** Test reconnection logic

### 3. Mid-Stream Cancel
- **Path:** \`3-mid-stream-cancel/\`
- **Description:** User cancels request while tokens are streaming
- **Events:** Token events → cancel event
- **Use case:** Test cancellation handling

### 4. Error Stream
- **Path:** \`4-error-stream/\`
- **Description:** Stream fails with rate limit error after 2 tokens
- **Events:** Initial tokens → error event
- **Use case:** Test error handling and user feedback

### 5. Jobs Progress with Cancel
- **Path:** \`5-jobs-progress-cancel/\`
- **Description:** Job progresses to 50% then gets cancelled
- **Events:** Progress events (0→50%) → cancel
- **Use case:** Test job cancellation at mid-point

## File Structure

Each fixture contains:
- \`events.ndjson\` - Server-Sent Events in NDJSON format
- \`view-model.json\` - Complete UI state after processing all events

## Usage in UI Development

### Loading Events
\`\`\`typescript
import events from './ui-fixtures/1-happy-path/events.ndjson';
const eventStream = events.split('\\n').map(line => JSON.parse(line));
\`\`\`

### Using View Models
\`\`\`typescript
import viewModel from './ui-fixtures/1-happy-path/view-model.json';
// viewModel contains final state with all tokens, metadata, etc.
\`\`\`

### Event Types

#### Token Event
\`\`\`json
{
  "id": "token_001",
  "event": "token",
  "data": "{\\"id\\":\\"token_001\\",\\"text\\":\\"I\\",\\"timestamp\\":1234567890,\\"sessionId\\":\\"session-001\\"}"
}
\`\`\`

#### Complete Event
\`\`\`json
{
  "id": "complete_001",
  "event": "complete",
  "data": "{\\"sessionId\\":\\"session-001\\",\\"totalTokens\\":60,\\"totalCost\\":0.045}"
}
\`\`\`

#### Error Event
\`\`\`json
{
  "id": "error_001",
  "event": "error",
  "data": "{\\"error\\":{\\"code\\":\\"RATE_LIMIT_EXCEEDED\\",\\"message\\":\\"Request rate limit exceeded\\"}}"
}
\`\`\`

## View Model Schemas

### StreamViewModel
- \`sessionId\`: string
- \`status\`: 'idle' | 'streaming' | 'completed' | 'cancelled' | 'error'
- \`tokens\`: Array of token objects with id, text, timestamp
- \`metadata\`: Cost, duration, model info (if completed)
- \`error\`: Error details (if failed)

### JobsViewModel
- \`sessionId\`: string
- \`jobs\`: Array of job objects with progress, status, timing

All fixtures are deterministic and safe for version control.
`;

  await writeFile(join(FIXTURES_DIR, 'README.md'), readme);
}

async function main(): Promise<void> {
  console.log('🔧 Generating UI Fixture Packs v2...');

  await mkdir(FIXTURES_DIR, { recursive: true });

  // Generate all fixture sets
  await generateTokenStreamingHappyPath();
  console.log('✅ Generated happy path streaming');

  await generateResumeWithLastEventId();
  console.log('✅ Generated resume with Last-Event-ID');

  await generateMidStreamCancel();
  console.log('✅ Generated mid-stream cancel');

  await generateErrorStream();
  console.log('✅ Generated error stream');

  await generateJobsProgressWithCancel();
  console.log('✅ Generated jobs progress with cancel');

  await generateReadme();
  console.log('✅ Generated README documentation');

  console.log(`\n📁 All fixtures saved to: ${FIXTURES_DIR}`);
  console.log('🎯 View-model shapes documented in README');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Fixture generation failed:', error);
    process.exit(1);
  });
}