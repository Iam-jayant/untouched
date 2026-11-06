/**
 * Core constants for Untouched backend
 * Includes deposit presets and free-tier LLM routing map
 */

import type { ModelConfig } from './types';

// ============================================================================
// Deposit Presets (human-readable USD)
// ============================================================================

export const DEPOSIT_PRESETS = [10, 50, 100, 250] as const;

export const MIN_DEPOSIT_USDC = 10_000000; // 6-decimal = $10
export const GAS_BUFFER_USDC = 500; // $0.0005

// ============================================================================
// Battery Calculation (G2: Exact Math - 5% APY for 14 Days)
// ============================================================================

/**
 * Calculate advance (5% APY for 14 days)
 * Formula: (principal × 500 × 14) / (10000 × 365)
 *          = (principal × 0.05 × 14) / 365
 * 
 * Examples:
 *   $10  (10_000000) → 19178  ($0.019178)
 *   $50  (50_000000) → 95890  ($0.095890)
 *   $100 (100_000000) → 191780 ($0.191780)
 *   $250 (250_000000) → 479452 ($0.479452)
 */
export function calculateAdvance(principalUSDC: number): number {
  return Math.floor((principalUSDC * 500 * 14) / (10000 * 365));
}

/**
 * DEPRECATED: Battery is now the same as advance (14-day yield credit)
 * Use calculateAdvance() instead
 */
export function calculateBattery(principalUSDC: number): number {
  return calculateAdvance(principalUSDC);
}

// ============================================================================
// Arc Testnet Constants
// ============================================================================

export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
export const GATEWAY_WALLET_ADDRESS = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9';

export const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS!;
export const ORACLE_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_ADDRESS!;

// ============================================================================
// Free-Tier LLM Routing Map (Enhancement 2)
// ============================================================================

/**
 * Free-tier models (priority order):
 * 1. OpenRouter :free models (gpt-4o-mini, claude-3-5-haiku, deepseek-v3, llama-3.3-70b)
 * 2. Groq (llama-3.3-70b)
 * 3. Gemini (gemini-2.0-flash-exp:free)
 * 4. Mock fallback (always succeeds)
 */
export const FREE_TIER_MODELS: ModelConfig[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    costPerMToken: 1.0, // $0.001 per 1000 tokens
    free: true,
    fallbackOrder: 1,
  },
  {
    id: 'anthropic/claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    costPerMToken: 1.0,
    free: true,
    fallbackOrder: 2,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    costPerMToken: 1.0,
    free: true,
    fallbackOrder: 3,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B (OpenRouter)',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    costPerMToken: 1.0,
    free: true,
    fallbackOrder: 4,
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B (Groq)',
    provider: 'groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    costPerMToken: 1.0,
    free: true,
    fallbackOrder: 5,
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    costPerMToken: 1.0,
    free: true,
    fallbackOrder: 6,
  },
  {
    id: 'mock-gpt-4o',
    name: 'Mock GPT-4o (Fallback)',
    provider: 'mock',
    endpoint: '',
    costPerMToken: 1.0,
    free: true,
    fallbackOrder: 99,
  },
];

/**
 * Heavy models. A single call can exceed the default per-call cap.
 */
export const PREMIUM_MODELS: ModelConfig[] = [
  {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    costPerMToken: 20.0, // $0.020 per 1000 tokens
    free: false,
    fallbackOrder: 0,
  },
  {
    id: 'openai/o3-pro',
    name: 'OpenAI o3-pro',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    costPerMToken: 20.0,
    free: false,
    fallbackOrder: 0,
  },
];

/**
 * Combined model map (keyed by model ID)
 * Includes flexible mappings for common model name variants
 */
export const MODELS = new Map<string, ModelConfig>(
  [...FREE_TIER_MODELS, ...PREMIUM_MODELS].map((m) => [m.id, m])
);

/**
 * Map flexible model names to standard models
 * Routine models: $1 per 1M tokens
 * Heavy models: $20 per 1M tokens
 */
export function resolveModel(modelName: string): ModelConfig {
  // Check exact match first
  const exactMatch = MODELS.get(modelName);
  if (exactMatch) return exactMatch;

  const lowerName = modelName.toLowerCase();

  // Heavy models map to $20 per 1M tokens
  const heavyPatterns = [
    'opus', 'o1', 'o3', 'o3-pro', 'o3-mini', 
    'claude-3-opus', 'claude-opus', 
    'deep-research', 'claude-3.5-opus'
  ];

  if (heavyPatterns.some(pattern => lowerName.includes(pattern))) {
    // Return a generic heavy model config
    return {
      id: modelName,
      name: modelName,
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      costPerMToken: 20.0, // $0.020
      free: false,
      fallbackOrder: 0,
    };
  }

  // Routine models - all map to $0.001 (auto-approve)
  const routinePatterns = [
    'gpt-4o-mini', 'gpt-4o', 'gpt-4', 'gpt-3.5',
    'claude-3-5-haiku', 'claude-3-haiku', 'haiku',
    'gemini', 'llama', 'deepseek', 'mistral'
  ];

  if (routinePatterns.some(pattern => lowerName.includes(pattern))) {
    // Return a generic routine model config
    return {
      id: modelName,
      name: modelName,
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      costPerMToken: 1.0, // $0.001
      free: true,
      fallbackOrder: 1,
    };
  }

  // Default: treat as routine model
  return {
    id: modelName,
    name: modelName,
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    costPerMToken: 1.0,
    free: true,
    fallbackOrder: 1,
  };
}

/**
 * Get free-tier models sorted by fallback order
 */
export function getFreeTierCascade(): ModelConfig[] {
  return [...FREE_TIER_MODELS].sort((a, b) => a.fallbackOrder - b.fallbackOrder);
}

// ============================================================================
// API Keys & Environment
// ============================================================================

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
export const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || '';

// ============================================================================
// Discovery API
// ============================================================================

export const CIRCLE_DISCOVERY_URL = 'https://api.circle.com/v1/stablecoins/usyc/price';
export const DISCOVERY_TTL_SECONDS = 300; // 5 minutes
export const DISCOVERY_FALLBACK_PRICE = 1.0; // $1 per USYC if API down

// ============================================================================
// SSE & Policy
// ============================================================================

export const SSE_HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
export const STEP_UP_TIMEOUT_MS = 300000; // 5 minutes

// ============================================================================
// Demo User (Pre-seed for Phase 2)
// ============================================================================

export const DEMO_API_KEY = 'unt_live_demo_key';
export const DEMO_DEPOSIT_USDC = 50_000000; // $50 → battery = $0.095890
