/**
 * InfrGate Control Plane Singleton (G1)
 * Wraps inference-by-infrgate SDK for Untouched Gateway
 */

import {
  IdempotencyGuard,
  TokenBucketRateLimiter,
  ProviderCircuitBreaker,
} from 'inference-by-infrgate';

// ============================================================================
// Execution Trace Types (Custom Implementation)
// ============================================================================

export type TraceStepType = 'AUTH' | 'RATE_LIMIT' | 'IDEMPOTENCY' | 'POLICY' | 'ROUTING' | 'FINALIZE';
export type TraceStepStatus = 'pending' | 'success' | 'failure';

export interface TraceStep {
  type: TraceStepType;
  label: string;
  status: TraceStepStatus;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  metadata?: Record<string, any>;
  error?: string;
}

export interface ExecutionTrace {
  requestId: string;
  steps: TraceStep[];
  totalDurationMs: number;
  finalizedAt: number;
}

export class ExecutionTraceBuilder {
  private requestId: string;
  private steps: TraceStep[] = [];
  private startTime: number;
  private currentStep: TraceStep | null = null;

  constructor(requestId: string) {
    this.requestId = requestId;
    this.startTime = Date.now();
  }

  startStep(type: TraceStepType, label: string): TraceStep {
    // Finish previous step if exists
    if (this.currentStep && this.currentStep.status === 'pending') {
      this.currentStep.status = 'success';
      this.currentStep.endTime = Date.now();
      this.currentStep.durationMs = this.currentStep.endTime - this.currentStep.startTime;
    }

    this.currentStep = {
      type,
      label,
      status: 'pending',
      startTime: Date.now(),
    };

    this.steps.push(this.currentStep);
    return this.currentStep;
  }

  succeed(metadata?: Record<string, any>): void {
    if (this.currentStep) {
      this.currentStep.status = 'success';
      this.currentStep.endTime = Date.now();
      this.currentStep.durationMs = this.currentStep.endTime - this.currentStep.startTime;
      if (metadata) {
        this.currentStep.metadata = { ...this.currentStep.metadata, ...metadata };
      }
    }
  }

  fail(error: string, metadata?: Record<string, any>): void {
    if (this.currentStep) {
      this.currentStep.status = 'failure';
      this.currentStep.endTime = Date.now();
      this.currentStep.durationMs = this.currentStep.endTime - this.currentStep.startTime;
      this.currentStep.error = error;
      if (metadata) {
        this.currentStep.metadata = { ...this.currentStep.metadata, ...metadata };
      }
    }
  }

  addMetadata(metadata: Record<string, any>): void {
    if (this.currentStep) {
      this.currentStep.metadata = { ...this.currentStep.metadata, ...metadata };
    }
  }

  getTrace(): ExecutionTrace {
    return {
      requestId: this.requestId,
      steps: this.steps,
      totalDurationMs: Date.now() - this.startTime,
      finalizedAt: Date.now(),
    };
  }

  finalize(): ExecutionTrace {
    // Finish current step if pending
    if (this.currentStep && this.currentStep.status === 'pending') {
      this.succeed();
    }
    return this.getTrace();
  }
}

// ============================================================================
// G1: GlobalThis Singleton
// ============================================================================

declare global {
  // eslint-disable-next-line no-var
  var __untouchedIdempotency: IdempotencyGuard | undefined;
  // eslint-disable-next-line no-var
  var __untouchedRateLimiter: TokenBucketRateLimiter | undefined;
  // eslint-disable-next-line no-var
  var __untouchedCircuitBreakers: Map<string, ProviderCircuitBreaker> | undefined;
}

/**
 * Get or create the Idempotency Guard singleton
 */
export function getIdempotencyGuard(): IdempotencyGuard {
  if (!globalThis.__untouchedIdempotency) {
    globalThis.__untouchedIdempotency = new IdempotencyGuard({
      ttlSeconds: 3600, // 1 hour cache
    });
  }
  return globalThis.__untouchedIdempotency;
}

/**
 * Get or create the Rate Limiter singleton
 */
export function getRateLimiter(): TokenBucketRateLimiter {
  if (!globalThis.__untouchedRateLimiter) {
    globalThis.__untouchedRateLimiter = new TokenBucketRateLimiter({
      capacity: 60, // 60 requests
      refillRate: 1, // 1 token per second = 60 RPM
    });
  }
  return globalThis.__untouchedRateLimiter;
}

/**
 * Get or create a Circuit Breaker for a specific provider
 */
export function getCircuitBreaker(provider: string): ProviderCircuitBreaker {
  if (!globalThis.__untouchedCircuitBreakers) {
    globalThis.__untouchedCircuitBreakers = new Map();
  }

  if (!globalThis.__untouchedCircuitBreakers.has(provider)) {
    globalThis.__untouchedCircuitBreakers.set(
      provider,
      new ProviderCircuitBreaker(provider, {
        failureThreshold: 5,
        failureWindowMs: 60000,
        recoveryTimeoutMs: 30000,
        successThreshold: 2,
        halfOpenMaxRequests: 3,
      })
    );
  }

  return globalThis.__untouchedCircuitBreakers.get(provider)!;
}

/**
 * Rank providers based on circuit breaker health
 */
export function rankProviders(
  providers: Array<'openrouter' | 'groq' | 'gemini'>
): Array<'openrouter' | 'groq' | 'gemini'> {
  // Filter out open-circuit providers
  const available = providers.filter((p) => {
    const breaker = getCircuitBreaker(p);
    const state = breaker.getState();
    return state === 'CLOSED' || state === 'HALF_OPEN';
  });

  // If no providers available, return original order (fallback)
  if (available.length === 0) return providers;

  return available;
}

/**
 * Create a new execution trace builder
 */
export function createTraceBuilder(requestId: string): ExecutionTraceBuilder {
  return new ExecutionTraceBuilder(requestId);
}

