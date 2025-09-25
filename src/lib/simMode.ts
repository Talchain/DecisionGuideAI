/**
 * Simulation Mode for Scenario Sandbox PoC
 * Provides deterministic, offline streaming simulation for safe demos
 */

export interface SimToken {
  id: string;
  text: string;
  delay: number; // milliseconds
  type?: 'content' | 'thinking' | 'done' | 'error' | 'aborted';
}

export interface SimScenario {
  id: string;
  seed: number;
  tokens: SimToken[];
  totalDuration: number;
}

// Pre-built simulation scenarios for deterministic demos
const SIM_SCENARIOS: SimScenario[] = [
  {
    id: 'analysis-basic',
    seed: 42,
    tokens: [
      { id: 'tok_1', text: 'Analyzing the scenario...', delay: 200, type: 'thinking' },
      { id: 'tok_2', text: '\n\n## Initial Assessment\n\n', delay: 300 },
      { id: 'tok_3', text: 'Based on the provided information, I can identify several key factors:\n\n', delay: 400 },
      { id: 'tok_4', text: '1. **Market Context**: The current situation suggests', delay: 350 },
      { id: 'tok_5', text: ' a need for strategic positioning.\n', delay: 250 },
      { id: 'tok_6', text: '2. **Risk Factors**: Limited resources may constrain', delay: 380 },
      { id: 'tok_7', text: ' our implementation options.\n', delay: 220 },
      { id: 'tok_8', text: '3. **Opportunity**: There is potential for', delay: 320 },
      { id: 'tok_9', text: ' significant impact with the right approach.\n\n', delay: 280 },
      { id: 'tok_10', text: '## Recommendation\n\n', delay: 400 },
      { id: 'tok_11', text: 'I recommend proceeding with a phased implementation', delay: 360 },
      { id: 'tok_12', text: ' that prioritizes quick wins while building', delay: 300 },
      { id: 'tok_13', text: ' toward long-term sustainability.', delay: 250 },
      { id: 'done', text: '', delay: 0, type: 'done' }
    ],
    totalDuration: 4000
  },
  {
    id: 'error-demo',
    seed: 123,
    tokens: [
      { id: 'tok_1', text: 'Starting analysis...', delay: 200 },
      { id: 'tok_2', text: '\n\nProcessing initial data...', delay: 300 },
      { id: 'error', text: 'Error: Budget exceeded', delay: 500, type: 'error' }
    ],
    totalDuration: 1000
  },
  {
    id: 'quick-demo',
    seed: 999,
    tokens: [
      { id: 'tok_1', text: 'Quick analysis complete.\n\n', delay: 100 },
      { id: 'tok_2', text: '**Result**: Low complexity scenario with clear path forward.', delay: 200 },
      { id: 'done', text: '', delay: 0, type: 'done' }
    ],
    totalDuration: 300
  }
];

export class SimModeStreamer {
  private scenario: SimScenario;
  private currentIndex = 0;
  private isStreaming = false;
  private isCancelled = false;
  private startTime = 0;
  private timeoutId: number | null = null;

  constructor(seed: number = 42, prompt?: string) {
    // Select scenario based on seed and prompt hints
    this.scenario = this.selectScenario(seed, prompt);
  }

  private selectScenario(seed: number, prompt?: string): SimScenario {
    // Simple scenario selection logic
    if (prompt?.toLowerCase().includes('error') || seed === 123) {
      return SIM_SCENARIOS.find(s => s.id === 'error-demo') || SIM_SCENARIOS[0];
    }

    if (prompt?.toLowerCase().includes('quick') || seed === 999) {
      return SIM_SCENARIOS.find(s => s.id === 'quick-demo') || SIM_SCENARIOS[0];
    }

    // Default to basic analysis
    return SIM_SCENARIOS.find(s => s.id === 'analysis-basic') || SIM_SCENARIOS[0];
  }

  start(onToken: (token: SimToken) => void, onComplete: () => void): void {
    if (this.isStreaming) {
      return;
    }

    this.isStreaming = true;
    this.isCancelled = false;
    this.currentIndex = 0;
    this.startTime = Date.now();

    this.streamNextToken(onToken, onComplete);
  }

  private streamNextToken(onToken: (token: SimToken) => void, onComplete: () => void): void {
    if (this.isCancelled) {
      // Send cancelled token and stop
      onToken({ id: 'cancelled', text: '', delay: 0, type: 'aborted' });
      onComplete();
      return;
    }

    if (this.currentIndex >= this.scenario.tokens.length) {
      this.isStreaming = false;
      onComplete();
      return;
    }

    const token = this.scenario.tokens[this.currentIndex];
    this.currentIndex++;

    // Send the token
    onToken(token);

    // Check if this is a terminal token
    if (token.type === 'done' || token.type === 'error' || token.type === 'aborted') {
      this.isStreaming = false;
      onComplete();
      return;
    }

    // Schedule next token
    const nextToken = this.scenario.tokens[this.currentIndex];
    if (nextToken) {
      this.timeoutId = window.setTimeout(() => {
        this.streamNextToken(onToken, onComplete);
      }, nextToken.delay);
    }
  }

  cancel(): void {
    this.isCancelled = true;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  getProgress(): { completed: number; total: number; duration: number } {
    return {
      completed: this.currentIndex,
      total: this.scenario.tokens.length,
      duration: Date.now() - this.startTime
    };
  }

  isActive(): boolean {
    return this.isStreaming;
  }

  getEstimatedDuration(): number {
    return this.scenario.totalDuration;
  }
}

export function isSimModeEnabled(): boolean {
  // Check environment variable or localStorage
  return import.meta.env.VITE_SIM_MODE === '1' ||
         localStorage.getItem('feature.simMode') === '1';
}

export function enableSimMode(): void {
  localStorage.setItem('feature.simMode', '1');
}

export function disableSimMode(): void {
  localStorage.setItem('feature.simMode', '0');
}

export function getAvailableScenarios(): { id: string; seed: number; description: string }[] {
  return SIM_SCENARIOS.map(scenario => ({
    id: scenario.id,
    seed: scenario.seed,
    description: scenario.id.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }));
}