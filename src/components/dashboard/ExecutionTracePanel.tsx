'use client';

import { CheckCircle, XCircle, Clock, Zap } from 'lucide-react';
import type { ExecutionTrace, TraceStep } from '@/lib/infrgate';

interface ExecutionTracePanelProps {
  trace: ExecutionTrace | null;
}

const defaultTrace: ExecutionTrace = {
  requestId: 'sample_trace',
  steps: [
    {
      type: 'AUTH',
      label: 'Authentication',
      status: 'pending',
      startTime: Date.now(),
      metadata: {},
    },
    {
      type: 'RATE_LIMIT',
      label: 'Rate Limiting',
      status: 'pending',
      startTime: Date.now(),
      metadata: {},
    },
    {
      type: 'IDEMPOTENCY',
      label: 'Idempotency Cache',
      status: 'pending',
      startTime: Date.now(),
      metadata: {},
    },
    {
      type: 'POLICY',
      label: 'Autonomous Spend Policy',
      status: 'pending',
      startTime: Date.now(),
      metadata: {},
    },
    {
      type: 'ROUTING',
      label: 'Provider Routing',
      status: 'pending',
      startTime: Date.now(),
      metadata: {},
    },
    {
      type: 'FINALIZE',
      label: 'x402 Settlement & Usage Ledger',
      status: 'pending',
      startTime: Date.now(),
      metadata: {},
    },
  ],
  totalDurationMs: 0,
  finalizedAt: Date.now(),
};

const stepSubtitles: Record<string, string> = {
  AUTH: 'Verify API key & resolve Arc USYC Vault',
  RATE_LIMIT: 'Check InfrGate Token Bucket (60 RPM) & concurrency',
  IDEMPOTENCY: 'SHA-256 request fingerprint check ($0.00 on replay hit)',
  POLICY: 'Deterministic spend limit check (0ms, instant block if exceeded)',
  ROUTING: 'InfrGate adapter scoring & circuit breaker failover',
  FINALIZE: 'Sign EIP-3009 nanopayment & deduct Yield Battery',
};

export function ExecutionTracePanel({ trace: providedTrace }: ExecutionTracePanelProps) {
  const trace = providedTrace || defaultTrace;
  const isDefault = !providedTrace;

  const getStepIcon = (step: TraceStep) => {
    if (step.status === 'success') {
      return <CheckCircle className="w-5 h-5 text-emerald-400" />;
    }
    if (step.status === 'failure') {
      return <XCircle className="w-5 h-5 text-red-400" />;
    }
    return <Clock className="w-5 h-5 text-amber-400 animate-pulse" />;
  };

  const getStepBorderColor = (step: TraceStep) => {
    if (step.status === 'success') return 'border-emerald-500/30';
    if (step.status === 'failure') return 'border-red-500/30';
    return 'border-amber-500/30';
  };

  const getConnectorColor = (step: TraceStep) => {
    if (step.status === 'success') return 'bg-emerald-500/50';
    if (step.status === 'failure') return 'bg-red-500/50';
    return 'bg-amber-500/50';
  };

  return (
    <div className="bg-black border border-white/10 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-400" />
          <h2 className="text-xl font-display">Gateway Execution Trace</h2>
        </div>
        {!isDefault && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded">
            <span className="text-xs font-mono text-white/60">
              {trace.totalDurationMs}ms total
            </span>
          </div>
        )}
      </div>

      {isDefault && (
        <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded text-sm text-white/50">
          Send a prompt to see the live 6-step execution trace
        </div>
      )}

      {/* Trace Steps */}
      <div className="relative space-y-0">
        {trace.steps.map((step, index) => (
          <div key={index} className="relative">
            {/* Connector Line */}
            {index < trace.steps.length - 1 && (
              <div
                className={`absolute left-[18px] top-12 w-0.5 h-[calc(100%-12px)] ${getConnectorColor(
                  step
                )} transition-colors`}
              />
            )}

            {/* Step Card */}
            <div
              className={`relative flex gap-4 p-4 rounded-lg border ${getStepBorderColor(
                step
              )} bg-black/50 hover:bg-white/[0.02] transition-all ${
                isDefault ? 'opacity-50' : ''
              }`}
            >
              {/* Icon */}
              <div className="relative z-10 flex-shrink-0">{getStepIcon(step)}</div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <h3 className="text-sm font-medium text-white">{step.label}</h3>
                  {step.durationMs !== undefined && (
                    <span className="text-xs font-mono text-white/50 whitespace-nowrap">
                      {step.durationMs}ms
                    </span>
                  )}
                </div>

                <p className="text-xs text-white/40 mb-2">{stepSubtitles[step.type]}</p>

                {/* Metadata */}
                {step.metadata && Object.keys(step.metadata).length > 0 && !isDefault && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(step.metadata).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-2 text-xs">
                        <span className="text-white/30 font-mono">{key}:</span>
                        <span className="text-white/50 font-mono break-all">
                          {typeof value === 'object'
                            ? JSON.stringify(value, null, 2)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Error Message */}
                {step.error && (
                  <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                    {step.error}
                  </div>
                )}

                {/* Success Badge */}
                {step.status === 'success' && index === trace.steps.length - 1 && !isDefault && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-400">
                    <CheckCircle className="w-3 h-3" />
                    Execution completed successfully
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Request ID Footer */}
      {!isDefault && (
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-white/40 font-mono">Request ID:</span>
          <code className="text-white/60 font-mono">{trace.requestId}</code>
        </div>
      )}
    </div>
  );
}
