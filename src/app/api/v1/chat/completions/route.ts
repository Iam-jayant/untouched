/**
 * POST /api/v1/chat/completions
 * OpenAI-compatible chat completions endpoint with InfrGate Control Plane
 * 
 * 6-Step Execution Trace:
 * 1. AUTH - Verify API key & resolve tenant vault
 * 2. RATE_LIMIT - Token bucket rate limiting (60 RPM)
 * 3. IDEMPOTENCY - SHA-256 request fingerprint cache check
 * 4. POLICY - Per-call limit and yield battery
 * 5. ROUTING - Provider health ranking & circuit breaker
 * 6. FINALIZE - x402 nanopayment signing & battery deduction
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ChatCompletionRequest, ChatCompletionResponse, Receipt } from '@/lib/types';
import { evaluatePolicy } from '@/lib/policy-engine';
import { 
  getUser, 
  updateUserBalance, 
  addReceipt, 
} from '@/lib/agent-store';
import { broadcastReceipt, broadcastBalanceUpdate } from '@/lib/sse';
import { providerKeyConfigured, resolveModel } from '@/lib/constants';
import { callLLM } from '@/lib/llm-proxy';
import { paymentRequiredHeader, signGatewayPayment } from '@/lib/x402';
import {
  createTraceBuilder,
  getIdempotencyGuard,
  getRateLimiter,
} from '@/lib/infrgate';
import { isSupabaseConfigured } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const trace = createTraceBuilder(requestId);
  const startTime = Date.now();

  try {
    // ========================================================================
    // STEP 1: AUTHENTICATION
    // ========================================================================
    trace.startStep('AUTH', 'Authentication');
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      trace.fail('Missing API key');
      trace.finalize();
      const required = paymentRequiredHeader(0, 'missing_auth');
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 402, headers: { 'PAYMENT-REQUIRED': required } }
      );
    }

    let user = getUser(apiKey);
    
    // If user not found and Supabase is configured, try syncing from DB
    if (!user && isSupabaseConfigured()) {
      console.log('[Chat] User not in memory, syncing from Supabase...');
      const { syncUserFromSupabase } = await import('@/lib/agent-store');
      await syncUserFromSupabase(apiKey);
      user = getUser(apiKey);
    }
    
    if (!user) {
      trace.fail('Invalid API key');
      trace.finalize();
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    trace.succeed({ apiKey: apiKey.substring(0, 12) + '...', principal: user.principal });

    // ========================================================================
    // STEP 2: RATE LIMITING
    // ========================================================================
    trace.startStep('RATE_LIMIT', 'Rate Limiting (60 RPM)');
    const rateLimiter = getRateLimiter();
    const rateLimitResult = await rateLimiter.check(apiKey);

    if (!rateLimitResult.allowed) {
      trace.fail('Rate limit exceeded (60 RPM)');
      trace.finalize();
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Max 60 requests per minute.',
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429 }
      );
    }

    trace.succeed({ remaining: rateLimitResult.remaining });

    // ========================================================================
    // STEP 3: REQUEST PARSING & IDEMPOTENCY
    // ========================================================================
    trace.startStep('IDEMPOTENCY', 'Idempotency Cache Check');
    const body: ChatCompletionRequest = await req.json();
    
    if (!body.model || !body.messages) {
      trace.fail('Missing required fields');
      trace.finalize();
      return NextResponse.json(
        { error: 'Missing required fields: model, messages' },
        { status: 400 }
      );
    }

    // Compute SHA-256 fingerprint for idempotency
    const idempotencyGuard = getIdempotencyGuard();
    const fingerprint = await idempotencyGuard.fingerprint({
      apiKey,
      model: body.model,
      messages: body.messages,
    });

    // Check for explicit Idempotency-Key header (demo-safe idempotency)
    const explicitIdempotencyKey = req.headers.get('idempotency-key');
    const shouldCheckCache = !!explicitIdempotencyKey;

    let cachedResponse: any = null;
    if (shouldCheckCache) {
      cachedResponse = await idempotencyGuard.get(fingerprint);
    }

    if (cachedResponse) {
      trace.succeed({ cached: true, fingerprint: fingerprint.substring(0, 16) + '...', costUSDC: 0 });
      trace.finalize();
      
      // Return cached response with $0.00 cost
      return NextResponse.json({
        ...cachedResponse.body,
        executionTrace: trace.getTrace(),
        cached: true,
        costUSDC: 0,
      });
    }

    trace.succeed({ cached: false, fingerprint: fingerprint.substring(0, 16) + '...' });

    // ========================================================================
    // STEP 4: AUTONOMOUS SPEND POLICY (Instant, Deterministic)
    // ========================================================================
    trace.startStep('POLICY', 'Autonomous Spend Policy');
    const policy = await evaluatePolicy(apiKey, body);

    if (!policy.allowed) {
      // Handle blocked by policy
      if (policy.action === 'blocked_by_policy') {
        // Instant block. Nothing is spent.
        trace.fail(policy.reason || 'Blocked by spend policy');
        
        // Mark remaining steps as skipped
        trace.startStep('ROUTING', 'Provider Routing (Skipped)');
        trace.addMetadata({ skipped: true, reason: 'blocked_by_policy' });
        
        trace.startStep('FINALIZE', 'x402 Settlement (Skipped)');
        trace.addMetadata({ skipped: true, reason: 'blocked_by_policy' });
        
        const executionTrace = trace.finalize();

        // Create blocked receipt ($0.00 spent)
        const blockedReceipt: Receipt = {
          id: requestId,
          timestamp: Date.now(),
          model: body.model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUSDC: 0,
          provider: 'blocked',
          free: false,
          executionTrace,
        };

        addReceipt(apiKey, blockedReceipt);
        broadcastReceipt(apiKey, blockedReceipt);

        return NextResponse.json(
          {
            error: policy.reason,
            action: 'blocked',
            costUSDC: 0,
            executionTrace,
            receipt: blockedReceipt,
          },
          { status: 403 }
        );
      } else if (policy.action === 'deposit_more') {
        trace.fail('Insufficient yield battery');
        trace.finalize();
        const required = paymentRequiredHeader(policy.estimatedCostUSDC || 0, 'yield_battery_empty');
        return NextResponse.json(
          {
            error: policy.reason,
            action: 'deposit_required',
            estimated_cost_usdc: policy.estimatedCostUSDC,
            executionTrace: trace.getTrace(),
          },
          { status: 402, headers: { 'PAYMENT-REQUIRED': required } }
        );
      } else {
        trace.fail(policy.reason || 'Policy denied');
        trace.finalize();
        return NextResponse.json(
          { error: policy.reason, executionTrace: trace.getTrace() },
          { status: 403 }
        );
      }
    } else {
      trace.succeed({ action: 'allowed', estimatedCost: policy.estimatedCostUSDC });
    }

    // ========================================================================
    // STEP 5: ROUTING & EXECUTION (Provider Selection + Circuit Breaker)
    // ========================================================================
    trace.startStep('ROUTING', 'Provider Routing (InfrGate)');
    
    const model = resolveModel(body.model);
    if (!model || model.locked) {
      trace.fail('Locked or unknown model');
      trace.finalize();
      return NextResponse.json(
        { error: model?.locked ? 'Locked — Protects the yield battery' : `Unknown model: ${body.model}` },
        { status: 403 }
      );
    }
    if (!providerKeyConfigured(model.provider)) {
      trace.fail(`${model.provider} key missing`);
      trace.finalize();
      return NextResponse.json(
        { error: `${model.name} is unavailable` },
        { status: 503 }
      );
    }

    let response: ChatCompletionResponse | undefined;
    let actualModel: string | undefined;
    let provider: 'openrouter' | 'groq' | 'gemini' | 'mock' | undefined;
    let costUSDC = 0;

    try {
      const callStart = Date.now();
      response = await callLLM(model, body);
      actualModel = model.id;
      provider = model.provider;
      costUSDC = calculateCost(response, model.costPerMToken);
      trace.succeed({
        provider: model.provider,
        model: actualModel,
        latencyMs: Date.now() - callStart,
        cost: costUSDC,
      });
    } catch (error) {
      console.error(`[Chat] ${body.model} failed:`, error);
      trace.fail(`Provider error: ${(error as Error).message}`);
      trace.finalize();
      return NextResponse.json(
        {
          error: 'LLM request failed',
          details: (error as Error).message,
          executionTrace: trace.getTrace(),
        },
        { status: 503 }
      );
    }

    // TypeScript assertion
    if (!response || !actualModel || !provider) {
      trace.fail('Missing response data');
      trace.finalize();
      return NextResponse.json(
        { error: 'Internal error: missing response data', executionTrace: trace.getTrace() },
        { status: 500 }
      );
    }

    // ========================================================================
    // STEP 6: FINALIZE (x402 Nanopayment + Battery Deduction + Cache)
    // ========================================================================
    trace.startStep('FINALIZE', 'x402 Settlement & Usage Ledger');

    // Deduct from battery
    if (costUSDC > 0) {
      const success = updateUserBalance(apiKey, costUSDC);
      if (!success) {
        trace.fail('Insufficient battery after completion');
        trace.finalize();
        const required = paymentRequiredHeader(costUSDC, 'yield_battery_empty');
        return NextResponse.json(
          { error: 'Insufficient battery after completion', executionTrace: trace.getTrace() },
          { status: 402, headers: { 'PAYMENT-REQUIRED': required } }
        );
      }
      if (user.walletAddress) {
        try {
          const { recordUsageOnChain } = await import('@/lib/vault-chain');
          await recordUsageOnChain(user.walletAddress, costUSDC);
        } catch (chainError) {
          console.error('[Chat] recordUsage failed:', chainError);
        }
      }
    }

    // Generate receipt with x402 metadata
    let x402Signature: string | undefined;
    let gatewayWallet: string | undefined;

    // Sign nanopayment for paid requests (costUSDC > 0)
    const payment = await signGatewayPayment(costUSDC);
    x402Signature = payment.signature;
    gatewayWallet = payment.receipt.payTo;

    const executionTrace = trace.finalize();

    const receipt: Receipt = {
      id: requestId,
      timestamp: Date.now(),
      model: actualModel,
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      costUSDC,
      provider,
      free: model.free,
      x402Signature,
      gatewayWallet,
      executionTrace,
    };

    addReceipt(apiKey, receipt);

    trace.succeed({
      costUSDC,
      batteryRemaining: user.remaining - costUSDC,
      totalDuration: Date.now() - startTime,
    });

    // Cache the response for idempotency (only on success - never cache 4xx/5xx)
    if (explicitIdempotencyKey) {
      await idempotencyGuard.set(fingerprint, response, 200);
    }

    broadcastReceipt(apiKey, receipt);
    broadcastBalanceUpdate(apiKey, user.remaining);

    return NextResponse.json(
      {
        ...response,
        executionTrace,
        badge: 'Upstream API paid by Untouched. Principal untouched.',
      },
      {
        headers: {
          'PAYMENT-RESPONSE': payment.header,
          'x-x402-signature': payment.signature,
        },
      }
    );
  } catch (error) {
    console.error('[Chat] Unexpected error:', error);
    trace.finalize();
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: (error as Error).message,
        executionTrace: trace.getTrace(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Cost Calculation
// ============================================================================

function calculateCost(
  response: ChatCompletionResponse,
  costPerMToken: number
): number {
  const totalTokens = response.usage.total_tokens;
  const costUSD = (totalTokens / 1_000_000) * costPerMToken;
  return Math.ceil(costUSD * 1_000000); // convert to 6-decimal USDC
}
