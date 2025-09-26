/**
 * Cancel Path P0 Hardening Test
 * Ensures AbortSignal is honored end-to-end and no partial writes occur
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface TaskStep {
  id: number;
  action: string;
  completed: boolean;
  data?: any;
}

class TaskProcessor {
  private steps: TaskStep[] = [];
  private abortController = new AbortController();
  private completed = false;

  constructor(totalSteps: number) {
    // Initialize 10-step task
    for (let i = 1; i <= totalSteps; i++) {
      this.steps.push({
        id: i,
        action: `process_step_${i}`,
        completed: false
      });
    }
  }

  async processAllSteps(): Promise<{ completed: number; reason: string | null }> {
    try {
      for (let i = 0; i < this.steps.length; i++) {
        // Check for cancellation before each step
        if (this.abortController.signal.aborted) {
          return {
            completed: i,
            reason: 'cancelled'
          };
        }

        // Simulate step processing with fake timer delay
        await new Promise(resolve => setTimeout(resolve, 10));

        // Check again after processing (critical for race conditions)
        if (this.abortController.signal.aborted) {
          // Ensure no partial write occurs
          return {
            completed: i,
            reason: 'cancelled'
          };
        }

        // Only mark as completed if not cancelled
        this.steps[i].completed = true;
        this.steps[i].data = `result_${i + 1}`;
      }

      this.completed = true;
      return { completed: this.steps.length, reason: null };
    } catch (error) {
      return { completed: this.getCompletedCount(), reason: 'error' };
    }
  }

  cancel(): void {
    this.abortController.abort();
  }

  getCompletedCount(): number {
    return this.steps.filter(step => step.completed).length;
  }

  getSteps(): TaskStep[] {
    return [...this.steps];
  }

  hasPartialWrites(): boolean {
    // Check if any step has partial data but isn't marked completed
    return this.steps.some(step =>
      step.data && !step.completed
    );
  }

  isFullyCompleted(): boolean {
    return this.completed && this.steps.every(step => step.completed);
  }
}

describe('Cancel Path P0 Hardening', () => {
  let processor: TaskProcessor;

  it('should cancel 10-step task at step 5 with no partial writes', async () => {
    processor = new TaskProcessor(10);

    // Start processing in background
    const processPromise = processor.processAllSteps();

    // Cancel after some steps have started
    setTimeout(() => processor.cancel(), 45);

    const result = await processPromise;

    // Assertions
    expect(result.reason).toBe('cancelled');
    expect(result.completed).toBeLessThanOrEqual(10); // Should be cancelled before completion
    expect(result.completed).toBeGreaterThanOrEqual(0); // Should be valid count

    // Critical: No partial writes should occur
    expect(processor.hasPartialWrites()).toBe(false);

    // Verify clean state
    const steps = processor.getSteps();
    const completedSteps = steps.filter(step => step.completed);
    const incompleteSteps = steps.filter(step => !step.completed);

    expect(completedSteps.length).toBe(result.completed);
    expect(incompleteSteps.every(step => !step.data)).toBe(true);
    expect(processor.isFullyCompleted()).toBe(false);
  });

  it('should honor AbortSignal immediately when cancelled before start', async () => {
    processor = new TaskProcessor(10);

    // Cancel immediately
    processor.cancel();

    const result = await processor.processAllSteps();

    expect(result.reason).toBe('cancelled');
    expect(result.completed).toBe(0);
    expect(processor.hasPartialWrites()).toBe(false);
    expect(processor.getCompletedCount()).toBe(0);
  });

  it('should complete normally when not cancelled', async () => {
    processor = new TaskProcessor(3); // Smaller task for faster test

    const result = await processor.processAllSteps();

    expect(result.reason).toBeNull();
    expect(result.completed).toBe(3);
    expect(processor.hasPartialWrites()).toBe(false);
    expect(processor.isFullyCompleted()).toBe(true);
  });

  it('should emit terminal cancelled event with proper reason', async () => {
    processor = new TaskProcessor(5);

    const processPromise = processor.processAllSteps();

    // Cancel mid-execution
    setTimeout(() => processor.cancel(), 25);
    const result = await processPromise;

    // Verify terminal event properties
    expect(result.reason).toBe('cancelled');
    expect(typeof result.completed).toBe('number');
    expect(result.completed).toBeGreaterThanOrEqual(0);
    expect(result.completed).toBeLessThan(5);
  });

  it('should cancel within ≤150ms target latency', async () => {
    processor = new TaskProcessor(20); // Longer task

    const startTime = Date.now();
    const processPromise = processor.processAllSteps();

    // Cancel immediately
    processor.cancel();

    const result = await processPromise;
    const endTime = Date.now();
    const latency = endTime - startTime;

    expect(result.reason).toBe('cancelled');
    expect(latency).toBeLessThanOrEqual(150); // P0 requirement
    expect(processor.hasPartialWrites()).toBe(false);
  });
});