/**
 * Core types for Untouched backend
 * Includes G1 globalThis singleton declarations
 */

import type { ExecutionTrace } from './infrgate';

// ============================================================================
// G1: GlobalThis Singleton Declarations
// ============================================================================

export interface UserState {
  apiKey: string;
  principal: number; // USDC 6-decimal
  advance: number; // USDC 6-decimal
  battery: number; // USDC 6-decimal (principal × 0.02)
  remaining: number; // USDC 6-decimal
  agentSigner: string; // EOA address
  depositTimestamp: number;
  lastActivity: number;
  maxPerCallUsdc?: number; // USDC 6-decimal - dynamic step-up threshold (default: $0.005)
  displayName?: string; // User's display name
  walletAddress?: string; // User's connected wallet (0x...)
}

export interface AgentStore {
  users: Map<string, UserState>;
  receipts: Map<string, Receipt[]>; // keyed by apiKey
  pendingApprovals: Map<string, PendingApproval[]>; // keyed by apiKey
}

export interface SSEManager {
  connections: Map<string, Set<SSEConnection>>;
  broadcast: (apiKey: string, event: SSEEvent) => void;
  addConnection: (apiKey: string, conn: SSEConnection) => void;
  removeConnection: (apiKey: string, conn: SSEConnection) => void;
}

export interface SSEConnection {
  id: string;
  controller: ReadableStreamDefaultController;
  send: (event: SSEEvent) => void;
}

declare global {
  // eslint-disable-next-line no-var
  var __untouchedStore: AgentStore | undefined;
  // eslint-disable-next-line no-var
  var __untouchedSSE: SSEManager | undefined;
  // eslint-disable-next-line no-var
  var __untouchedVaultKeys: Map<string, any[]> | undefined;
}

// ============================================================================
// Payment & Receipts
// ============================================================================

export interface Receipt {
  id: string;
  timestamp: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSDC: number; // 6-decimal
  provider: 'openrouter' | 'groq' | 'gemini' | 'mock' | 'blocked';
  free: boolean;
  txHash?: string; // x402 EIP-3009 transaction hash
  x402Signature?: string; // x402 nanopayment signature
  gatewayWallet?: string; // Circle Gateway wallet address
  executionTrace?: ExecutionTrace; // InfrGate 6-step trace
}

export interface PendingApproval {
  id: string;
  timestamp: number;
  model: string;
  estimatedCostUSDC: number; // 6-decimal
  requiredAction: 'step_up_auth' | 'deposit_more';
  promptPreview: string; // first 200 chars
  resolver?: (decision: 'approved' | 'blocked') => void; // G3: Promise resolver
}

// ============================================================================
// Discovery API
// ============================================================================

export interface DiscoveryResponse {
  usycPrice: number; // USD per USYC
  timestamp: number;
  source: 'circle_api' | 'fallback';
  ttl: number; // seconds until stale
}

// ============================================================================
// Nanopayments (Circle X-402)
// ============================================================================

export interface NanopaymentSession {
  sessionId: string;
  apiKey: string;
  gatewayWallet: string;
  agentSigner: string;
  balance: number; // USDC 6-decimal
}

export interface NanopaymentCharge {
  sessionId: string;
  amountUSDC: number; // 6-decimal
  model: string;
  tokens: number;
  success: boolean;
  txHash?: string;
}

// ============================================================================
// Policy Engine
// ============================================================================

export interface PolicyDecision {
  allowed: boolean;
  action?: 'allow' | 'deny' | 'deposit_more' | 'blocked_by_policy';
  reason?: string;
  estimatedCostUSDC?: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openrouter' | 'groq' | 'gemini' | 'mock';
  endpoint: string;
  costPerMToken: number; // USD per million tokens
  free: boolean;
  fallbackOrder: number; // 1 = try first, 2 = try second, etc.
}

// ============================================================================
// Chat Completions (OpenAI-compatible)
// ============================================================================

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  // ... other OpenAI params
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: TokenUsage;
  executionTrace?: ExecutionTrace; // InfrGate 6-step trace
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'content_filter';
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// ============================================================================
// SSE Events
// ============================================================================

export type SSEEvent =
  | { type: 'receipt'; data: Receipt }
  | { type: 'balance_update'; data: { remaining: number; principal?: number; battery?: number; advance?: number } }
  | { type: 'deposit_confirmed'; data: { principal: number; battery: number; remaining: number; advance: number } }
  | { type: 'pending_approval'; data: PendingApproval }
  | { type: 'step_up_approved'; data: { approvalId: string } }
  | { type: 'step_up_denied'; data: { approvalId: string } }
  | { type: 'heartbeat'; data: { timestamp: number } };

// ============================================================================
// Step-Up Decision (World ID verification)
// ============================================================================

export interface StepUpDecision {
  approvalId: string;
  action: 'approve' | 'deny';
  proof?: {
    merkle_root: string;
    nullifier_hash: string;
    proof: string;
    verification_level: string;
  };
}

// ============================================================================
// Vault API
// ============================================================================

export interface DepositRequest {
  amountUSDC: number; // human-readable (e.g., 50 for $50)
}

export interface DepositResponse {
  success: boolean;
  apiKey?: string;
  principal?: number;
  advance?: number;
  battery?: number;
  agentSigner?: string;
  error?: string;
}

export interface WithdrawRequest {
  apiKey: string;
  amountUSDC: number; // human-readable
}

export interface WithdrawResponse {
  success: boolean;
  withdrawn?: number;
  remaining?: number;
  error?: string;
}

export interface StatusResponse {
  principal: number;
  advance: number;
  battery: number;
  remaining: number;
  agentSigner: string;
  depositTimestamp: number;
  lastActivity: number;
}

export interface SimulateRequest {
  amountUSDC: number; // human-readable
}

export interface SimulateResponse {
  principal: number;
  advance: number;
  battery: number;
  total: number;
  gasFee: number;
}
