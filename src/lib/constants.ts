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
export const ARC_CAIP2 = 'eip155:5042002';
export const ARC_RPC_URL = 'https://rpc.testnet.arc.network';
export const ARC_RPC_FALLBACK = 'https://rpc.solidrpc.io/public/evm/5042002';
export const ARC_EXPLORER = 'https://testnet.arcscan.app';
export const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
export const ARC_USYC_ADDRESS = '0xe9185f0c5f296ed1797aae4238d26ccabeadb86c';
export const GATEWAY_WALLET_ADDRESS = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9';
export const NATIVE_PER_MICRO = 1_000_000_000_000n;

export const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0xcA9F8D931b6a0dE64ED74757A66aCB203413f2C1';
export const ORACLE_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_ADDRESS || '';

// ============================================================================
// Yield models. $1 per 1M tokens. Locked models stay visible and are refused.
// ============================================================================

export const YIELD_MODELS: ModelConfig[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    costPerMToken: 1.0,
    free: true,
    fallbackOrder: 1,
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    costPerMToken: 1.0,
    free: true,
    fallbackOrder: 2,
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    name: 'Qwen 2.5 72B',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    costPerMToken: 1.0,
    free: true,
    fallbackOrder: 3,
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    costPerMToken: 1.0,
    free: true,
    fallbackOrder: 4,
  },
];

export const LOCKED_MODELS: ModelConfig[] = [
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    endpoint: '',
    costPerMToken: 1.0,
    free: false,
    fallbackOrder: 0,
    locked: true,
  },
  {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'openrouter',
    endpoint: '',
    costPerMToken: 1.0,
    free: false,
    fallbackOrder: 0,
    locked: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openrouter',
    endpoint: '',
    costPerMToken: 1.0,
    free: false,
    fallbackOrder: 0,
    locked: true,
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'openrouter',
    endpoint: '',
    costPerMToken: 1.0,
    free: false,
    fallbackOrder: 0,
    locked: true,
  },
];

export const FREE_TIER_MODELS = YIELD_MODELS;
export const PREMIUM_MODELS = LOCKED_MODELS;

/**
 * Combined model map (keyed by model ID)
 * Includes flexible mappings for common model name variants
 */
export const MODELS = new Map<string, ModelConfig>(
  [...YIELD_MODELS, ...LOCKED_MODELS].map((m) => [m.id, m])
);

const LOCKED_ALIASES = ['claude', 'gpt-4o', 'gpt-4', 'o1', 'o3', 'opus', 'sonnet'];

export function resolveModel(modelName: string): ModelConfig | null {
  const exactMatch = MODELS.get(modelName);
  if (exactMatch) return exactMatch;
  const lowerName = modelName.toLowerCase();
  if (LOCKED_ALIASES.some((pattern) => lowerName.includes(pattern))) {
    return {
      id: modelName,
      name: modelName,
      provider: 'openrouter',
      endpoint: '',
      costPerMToken: 1.0,
      free: false,
      fallbackOrder: 0,
      locked: true,
    };
  }
  return null;
}

export function getFreeTierCascade(): ModelConfig[] {
  return YIELD_MODELS.filter((model) => !model.locked);
}

export function providerKeyConfigured(provider: ModelConfig['provider']): boolean {
  if (provider === 'gemini') return Boolean(process.env.GEMINI_API_KEY);
  if (provider === 'groq') return Boolean(process.env.GROQ_API_KEY);
  if (provider === 'openrouter') return Boolean(process.env.OPENROUTER_API_KEY);
  return false;
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
