/**
 * Autonomous Spend Policy Engine
 * Enforces per-call USDC limit & yield battery quota
 * 
 * 100% Deterministic - No World ID, No Mobile Approval, No HTTP Holds
 * 
 * Logic:
 * - If estimatedCostUSDC <= user.maxPerCallUsdc AND <= user.remaining → ALLOW
 * - If estimatedCostUSDC > user.maxPerCallUsdc → BLOCK (instant 403, $0.00 spent)
 * - If estimatedCostUSDC > user.remaining → DEPOSIT_MORE (402)
 */

import type { PolicyDecision, ChatCompletionRequest } from './types';
import { getUser } from './agent-store';
import { MODELS } from './constants';

// Default per-call limit (matches vault contract)
const DEFAULT_MAX_PER_CALL_USDC = 5000; // $0.005

// ============================================================================
// Autonomous Policy Decision Logic (0ms, Deterministic)
// ============================================================================

/**
 * Evaluate whether a chat completion request should be allowed
 * Returns instant decision - no async waits, no promises, no holds
 */
export async function evaluatePolicy(
  apiKey: string,
  request: ChatCompletionRequest
): Promise<PolicyDecision> {
  const user = getUser(apiKey);

  if (!user) {
    return {
      allowed: false,
      action: 'deny',
      reason: 'Invalid API key',
    };
  }

  const model = MODELS.get(request.model);

  if (!model) {
    return {
      allowed: false,
      action: 'deny',
      reason: `Unknown model: ${request.model}`,
    };
  }

  // Calculate cost based on model's costPerMToken
  // Routine: $0.001 per 1k tokens, Heavy: $0.020 per 1k tokens
  const estimatedTokens = estimateTokenCount(request);
  const estimatedCostUSD = (estimatedTokens / 1_000_000) * model.costPerMToken;
  const estimatedCostUSDC = Math.ceil(estimatedCostUSD * 1_000000); // convert to 6-decimal

  // Get user's max per-call limit (read from user state or default $0.005)
  const maxPerCallUsdc = user.maxPerCallUsdc ?? DEFAULT_MAX_PER_CALL_USDC;

  // ============================================================================
  // AUTONOMOUS SPEND POLICY GUARDRAIL (Instant, Deterministic)
  // ============================================================================

  // Check 1: Does the cost exceed the user's configured per-call limit?
  if (estimatedCostUSDC > maxPerCallUsdc) {
    return {
      allowed: false,
      action: 'blocked_by_policy',
      reason: `Blocked by Autonomous Spend Policy: $${(estimatedCostUSDC / 1_000000).toFixed(4)} exceeds max per-call limit ($${(maxPerCallUsdc / 1_000000).toFixed(4)}) — $0.00 spent`,
      estimatedCostUSDC,
    };
  }

  // Check 2: Does the user have sufficient battery remaining?
  if (user.remaining < estimatedCostUSDC) {
    return {
      allowed: false,
      action: 'deposit_more',
      reason: `Insufficient yield battery. Need $${(estimatedCostUSDC / 1_000000).toFixed(4)} but only $${(user.remaining / 1_000000).toFixed(4)} remaining.`,
      estimatedCostUSDC,
    };
  }

  // ✅ PASS: Cost is within limit AND sufficient battery
  return {
    allowed: true,
    action: 'allow',
    estimatedCostUSDC,
  };
}

// ============================================================================
// Token Estimation (rough heuristic)
// ============================================================================

/**
 * Estimate token count for a chat completion request
 * Uses simple heuristic: ~4 chars per token
 */
function estimateTokenCount(request: ChatCompletionRequest): number {
  const totalChars = request.messages.reduce(
    (sum, msg) => sum + msg.content.length,
    0
  );

  const promptTokens = Math.ceil(totalChars / 4);

  // Estimate completion tokens based on max_tokens or default to 1000
  const completionTokens = request.max_tokens || 1000;

  return promptTokens + completionTokens;
}
