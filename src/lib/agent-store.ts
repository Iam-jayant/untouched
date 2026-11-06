/**
 * Agent Store (G1: globalThis singleton)
 * In-memory user state, receipts, and pending approvals
 * Pre-seeds demo user with $50 deposit
 */

import type { AgentStore, UserState, Receipt, PendingApproval } from './types';
import {
  DEMO_API_KEY,
  DEMO_DEPOSIT_USDC,
  calculateAdvance,
  calculateBattery,
} from './constants';
import crypto from 'crypto';
import { getSupabase, isSupabaseConfigured } from './supabase';

// ============================================================================
// API Key Management
// ============================================================================

export interface APIKeyMetadata {
  key: string;
  label: string;
  createdAt: number;
  vaultId: string; // Links to the primary vault/user
}

// Map of vaultId -> API keys belonging to that vault (stored on globalThis for worker consistency)
function getVaultKeysMap(): Map<string, APIKeyMetadata[]> {
  if (!globalThis.__untouchedVaultKeys) {
    globalThis.__untouchedVaultKeys = new Map<string, APIKeyMetadata[]>();
  }
  return globalThis.__untouchedVaultKeys as Map<string, APIKeyMetadata[]>;
}

/**
 * Generate a new API key in format unt_live_<16_hex_chars>
 */
export function generateAPIKey(): string {
  const randomHex = crypto.randomBytes(8).toString('hex');
  return `unt_live_${randomHex}`;
}

/**
 * Create a new API key linked to an existing vault.
 * IMPORTANT (Bug Fix): Store a REFERENCE to the vault owner's UserState,
 * NOT a copy. This ensures mutations (e.g. deposit updates) are visible
 * from both the wallet key and the API key.
 */
export async function createAPIKey(params: {
  key?: string;
  userId: string;
  name: string;
  status: string;
  createdAt: string;
}): Promise<APIKeyMetadata> {
  const key = params.key || generateAPIKey();
  const store = getStore();
  
  // Get the vault owner's state
  const vaultOwner = store.users.get(params.userId) || store.users.get(params.userId.toLowerCase());
  if (!vaultOwner) {
    throw new Error('Vault not found');
  }

  // Store the SAME object reference — NOT a copy.
  // This way, when /api/vault/deposit mutates the object found via API key,
  // the exact same mutation is visible when looked up by wallet address.
  store.users.set(key, vaultOwner);
  // Share receipts and approvals with the vault owner
  store.receipts.set(key, store.receipts.get(params.userId) || []);
  store.pendingApprovals.set(key, store.pendingApprovals.get(params.userId) || []);

  const metadata: APIKeyMetadata = {
    key,
    label: params.name,
    createdAt: Date.now(),
    vaultId: params.userId,
  };

  // Track this key under the vault
  const vKeys = getVaultKeysMap();
  const keys = vKeys.get(params.userId) || [];
  keys.push(metadata);
  vKeys.set(params.userId, keys);
  if (params.userId.toLowerCase() !== params.userId) {
    vKeys.set(params.userId.toLowerCase(), keys);
  }

  // Store in Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.from('untouched_api_keys').insert({
          key,
          user_id: params.userId,
          name: params.name,
          status: params.status,
          created_at: params.createdAt,
        });
      }
    } catch (err) {
      console.warn('[agent-store] Supabase insert API key failed:', err);
    }
  }

  return metadata;
}

/**
 * List all API keys for a vault
 */
export function listAPIKeys(vaultId: string): APIKeyMetadata[] {
  const vKeys = getVaultKeysMap();
  return vKeys.get(vaultId) || vKeys.get(vaultId.toLowerCase()) || [];
}

/**
 * Get the vault ID for an API key (for key->vault resolution)
 */
export function getVaultIdForKey(apiKey: string): string | undefined {
  const store = getStore();
  const vKeys = getVaultKeysMap();
  if (store.users.has(apiKey)) {
    for (const [vaultId, keys] of vKeys.entries()) {
      const found = keys.find((k) => k.key === apiKey);
      if (found) return vaultId;
    }
    return apiKey;
  }
  return undefined;
}

// ============================================================================
// G1: GlobalThis Singleton
// ============================================================================

function initStore(): AgentStore {
  const store: AgentStore = {
    users: new Map<string, UserState>(),
    receipts: new Map<string, Receipt[]>(),
    pendingApprovals: new Map<string, PendingApproval[]>(),
  };

  // DO NOT pre-seed demo user - require wallet connection first
  // Users must connect wallet to create their vault

  return store;
}

export function getStore(): AgentStore {
  if (!globalThis.__untouchedStore) {
    globalThis.__untouchedStore = initStore();
  }
  return globalThis.__untouchedStore;
}

// ============================================================================
// User State Management
// ============================================================================

export function getUser(apiKey: string): UserState | undefined {
  if (!apiKey) return undefined;
  const store = getStore();
  const vKeys = getVaultKeysMap();
  const trimmed = apiKey.trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct lookup
  let user = store.users.get(trimmed) || store.users.get(lower);

  // 2. If it looks like a wallet address, check lowercase and walletAddress property
  if (!user && lower.startsWith('0x')) {
    user = store.users.get(lower);
    if (!user) {
      for (const u of store.users.values()) {
        if (u.walletAddress?.toLowerCase() === lower) {
          user = u;
          store.users.set(lower, user);
          break;
        }
      }
    }
  }

  // 3. Fallback: if apiKey is a custom key, search vaultKeys to find the vault owner
  if (!user && trimmed.startsWith('unt_live_')) {
    for (const [vaultId, keys] of vKeys.entries()) {
      const found = keys.find((k) => k.key === trimmed);
      if (found) {
        user = store.users.get(vaultId) || store.users.get(vaultId.toLowerCase());
        if (user) {
          // Cache reference directly under this apiKey
          store.users.set(trimmed, user);
          break;
        }
      }
    }
  }

  // 4. Fallback search across all store users for matching apiKey
  if (!user) {
    for (const u of store.users.values()) {
      if (u.apiKey === trimmed || u.apiKey === lower) {
        user = u;
        store.users.set(trimmed, user);
        break;
      }
    }
  }

  return user;
}

/**
 * Get or sync user: first checks memory, then queries Supabase if not found or principal is 0
 */
export async function getOrSyncUser(keyOrWallet: string): Promise<UserState | undefined> {
  if (!keyOrWallet) return undefined;
  let user = getUser(keyOrWallet);
  if ((!user || user.principal === 0) && isSupabaseConfigured()) {
    const synced = await syncUserFromSupabase(keyOrWallet);
    if (synced) {
      user = synced;
    }
  }
  return user;
}

/**
 * Create a new user (wallet-based onboarding)
 */
export async function createUser(params: {
  id: string;
  apiKey: string;
  displayName?: string;
  walletAddress: string;
  agentSigner: string;
  principal: number;
  advance: number;
  battery: number;
  remaining: number;
  maxPerCallUsdc: number;
  depositTimestamp: number;
  lastActivity: number;
}): Promise<UserState> {
  const store = getStore();
  const normalizedId = params.id.toLowerCase();

  const user: UserState = {
    apiKey: params.apiKey,
    principal: params.principal,
    advance: params.advance,
    battery: params.battery,
    remaining: params.remaining,
    agentSigner: params.agentSigner,
    depositTimestamp: params.depositTimestamp,
    lastActivity: params.lastActivity,
    maxPerCallUsdc: params.maxPerCallUsdc,
    displayName: params.displayName,
    walletAddress: params.walletAddress,
  };

  // Store by wallet address (both normalized and original id)
  store.users.set(params.id, user);
  store.users.set(normalizedId, user);
  if (params.walletAddress) {
    store.users.set(params.walletAddress.toLowerCase(), user);
  }
  if (params.apiKey) {
    store.users.set(params.apiKey, user);
  }
  store.receipts.set(params.id, []);
  store.receipts.set(normalizedId, store.receipts.get(params.id)!);
  store.pendingApprovals.set(params.id, []);
  store.pendingApprovals.set(normalizedId, store.pendingApprovals.get(params.id)!);

  // Initialize vault keys tracking
  const vKeys = getVaultKeysMap();
  vKeys.set(params.id, []);
  vKeys.set(normalizedId, []);

  // Store in Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.from('untouched_users').insert({
          id: params.id,
          display_name: params.displayName,
          wallet_address: params.walletAddress,
          agent_signer_eoa: params.agentSigner,
          principal_usdc: params.principal,
          yield_battery_usdc: params.battery,
          remaining_usdc: params.remaining,
          max_per_call_usdc: params.maxPerCallUsdc,
        });
      }
    } catch (err) {
      console.warn('[agent-store] Supabase insert user failed:', err);
    }
  }

  return user;
}

/**
 * Get API keys for a user/vault
 */
export function getAPIKeys(userId: string): APIKeyMetadata[] {
  const vKeys = getVaultKeysMap();
  return vKeys.get(userId) || vKeys.get(userId.toLowerCase()) || [];
}

/**
 * Async sync user from Supabase (supports both wallet address and API keys)
 */
export async function syncUserFromSupabase(keyOrWallet: string): Promise<UserState | undefined> {
  const supabase = getSupabase();
  if (!supabase || !keyOrWallet) return undefined;

  try {
    const trimmed = keyOrWallet.trim();
    const lower = trimmed.toLowerCase();
    const store = getStore();
    const vKeys = getVaultKeysMap();

    let targetUserId: string | null = null;

    if (lower.startsWith('0x')) {
      targetUserId = lower;
    } else {
      const { data: keyData } = await supabase
        .from('untouched_api_keys')
        .select('user_id')
        .eq('key', trimmed)
        .maybeSingle();

      if (keyData?.user_id) {
        targetUserId = keyData.user_id.toLowerCase();
      }
    }

    if (!targetUserId) return undefined;

    // Load user data from untouched_users
    const { data: userData, error } = await supabase
      .from('untouched_users')
      .select('*')
      .or(`id.eq.${targetUserId},wallet_address.eq.${targetUserId}`)
      .maybeSingle();

    if (userData) {
      // Also fetch all linked API keys for this user
      const { data: userKeys } = await supabase
        .from('untouched_api_keys')
        .select('*')
        .eq('user_id', userData.id);

      const canonicalWallet = (userData.wallet_address || userData.id).toLowerCase();
      const resolvedApiKey = (userKeys && userKeys.length > 0) ? userKeys[0].key : trimmed;

      const user: UserState = {
        apiKey: resolvedApiKey,
        principal: userData.principal_usdc,
        advance: userData.yield_battery_usdc,
        battery: userData.yield_battery_usdc,
        remaining: userData.remaining_usdc,
        agentSigner: userData.agent_signer_eoa || '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
        depositTimestamp: userData.deposit_timestamp || Date.now(),
        lastActivity: Date.now(),
        maxPerCallUsdc: userData.max_per_call_usdc || 5000,
        displayName: userData.display_name || `User ${canonicalWallet.slice(0, 6)}`,
        walletAddress: canonicalWallet,
      };

      // Store in memory under both wallet address variants
      store.users.set(canonicalWallet, user);
      store.users.set(userData.id, user);

      // Track API keys in vaultKeys map and store.users
      if (userKeys && userKeys.length > 0) {
        const metadatas: APIKeyMetadata[] = userKeys.map((k) => ({
          key: k.key,
          label: k.name,
          createdAt: new Date(k.created_at).getTime(),
          vaultId: canonicalWallet,
        }));
        vKeys.set(canonicalWallet, metadatas);
        vKeys.set(userData.id, metadatas);

        for (const k of userKeys) {
          store.users.set(k.key, user);
        }
      }

      if (trimmed !== canonicalWallet) {
        store.users.set(trimmed, user);
      }

      console.log(`[agent-store] Successfully synced user from Supabase: ${canonicalWallet} (Principal: $${user.principal / 1_000000})`);
      return user;
    }
  } catch (error) {
    console.error('[Supabase] Failed to sync user:', error);
  }
  return undefined;
}

export function updateUserBalance(apiKey: string, deduction: number): boolean {
  const store = getStore();
  const user = store.users.get(apiKey);
  if (!user) return false;

  if (user.remaining < deduction) return false;

  user.remaining -= deduction;
  user.lastActivity = Date.now();

  // Async sync remaining balance to Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      if (supabase) {
        const targetId = (user.walletAddress || user.apiKey).toLowerCase();
        supabase
          .from('untouched_users')
          .update({
            remaining_usdc: user.remaining,
            last_activity: new Date(user.lastActivity).toISOString(),
          })
          .or(`id.eq.${targetId},wallet_address.eq.${targetId}`)
          .then(
            ({ error }) => {
              if (error) console.warn('[agent-store] Supabase remaining balance update failed:', error);
            },
            (err) => {
              console.warn('[agent-store] Supabase remaining sync error:', err);
            }
          );
      }
    } catch (err) {
      console.warn('[agent-store] Supabase remaining sync error:', err);
    }
  }

  return true;
}

export function updateUserSettings(
  apiKey: string,
  settings: Partial<Pick<UserState, 'maxPerCallUsdc'>>
): UserState | null {
  const store = getStore();
  const user = store.users.get(apiKey);
  
  if (!user) return null;

  // Update settings
  if (settings.maxPerCallUsdc !== undefined) {
    user.maxPerCallUsdc = settings.maxPerCallUsdc;
  }

  user.lastActivity = Date.now();

  // Sync to Supabase if configured
  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('untouched_users')
        .update({
          max_per_call_usdc: user.maxPerCallUsdc,
          last_activity: new Date(user.lastActivity).toISOString(),
        })
        .eq('api_key', apiKey)
        .then(({ error }) => {
          if (error) console.error('[Supabase] Failed to sync user settings:', error);
        });
    }
  }

  return user;
}

export function getUserBalance(apiKey: string): number {
  const user = getUser(apiKey);
  return user?.remaining ?? 0;
}

// ============================================================================
// Key Resolution Helpers
// ============================================================================

/**
 * Resolve any key (API key or wallet address) to the canonical wallet address.
 * This is the single source of truth for user identity.
 */
export function resolveUserId(keyOrWallet: string): string | undefined {
  const store = getStore();

  // 1. If it looks like a wallet address, normalize and check
  if (keyOrWallet.startsWith('0x') && keyOrWallet.length === 42) {
    const normalized = keyOrWallet.toLowerCase();
    if (store.users.has(normalized)) return normalized;
  }

  // 2. If it's an API key, search vaultKeys for the linked wallet
  if (keyOrWallet.startsWith('unt_live_')) {
    const vKeys = getVaultKeysMap();
    for (const [walletId, keys] of vKeys.entries()) {
      if (keys.some((k) => k.key === keyOrWallet)) {
        return walletId;
      }
    }
  }

  // 3. Check if the key exists directly in the store (might be a wallet stored as-is)
  if (store.users.has(keyOrWallet)) return keyOrWallet;

  return undefined;
}

/**
 * Get ALL keys (wallet + API keys) for a user, for broadcasting SSE to all connections.
 */
export function getAllKeysForUser(walletAddress: string): string[] {
  const norm = walletAddress.toLowerCase();
  const keys = new Set<string>([walletAddress, norm]);
  const vKeys = getVaultKeysMap();
  const apiKeys = [...(vKeys.get(walletAddress) || []), ...(vKeys.get(norm) || [])];
  for (const k of apiKeys) {
    keys.add(k.key);
  }
  return Array.from(keys);
}

// ============================================================================
// Receipt Management
// ============================================================================

export function addReceipt(apiKey: string, receipt: Receipt): void {
  const store = getStore();
  const receipts = store.receipts.get(apiKey) || [];
  receipts.push(receipt);
  store.receipts.set(apiKey, receipts);
}

export function getReceipts(apiKey: string): Receipt[] {
  const store = getStore();
  return store.receipts.get(apiKey) || [];
}

// ============================================================================
// Pending Approval Management
// ============================================================================

export function addPendingApproval(apiKey: string, approval: PendingApproval): void {
  const store = getStore();
  const approvals = store.pendingApprovals.get(apiKey) || [];
  approvals.push(approval);
  store.pendingApprovals.set(apiKey, approvals);

  // Sync to Supabase if configured
  if (isSupabaseConfigured()) {
    syncApprovalToSupabase(approval, apiKey).catch(console.error);
  }
}

export function getPendingApprovals(apiKey: string): PendingApproval[] {
  const store = getStore();
  return store.pendingApprovals.get(apiKey) || [];
}

export function removePendingApproval(apiKey: string, approvalId: string): boolean {
  const store = getStore();
  const approvals = store.pendingApprovals.get(apiKey) || [];
  const index = approvals.findIndex((a) => a.id === approvalId);
  if (index === -1) return false;

  approvals.splice(index, 1);
  store.pendingApprovals.set(apiKey, approvals);

  // Update Supabase status to resolved
  if (isSupabaseConfigured()) {
    updateApprovalStatusInSupabase(approvalId, 'resolved').catch(console.error);
  }

  return true;
}

/**
 * Check Supabase for approval status (cross-lambda sync)
 */
export async function checkApprovalStatusInSupabase(
  approvalId: string
): Promise<'approved' | 'blocked' | 'pending'> {
  const supabase = getSupabase();
  if (!supabase) return 'pending';

  try {
    const { data } = await supabase
      .from('untouched_pending_approvals')
      .select('status')
      .eq('id', approvalId)
      .single();

    return (data?.status as 'approved' | 'blocked' | 'pending') || 'pending';
  } catch (error) {
    console.error('[Supabase] Failed to check approval status:', error);
    return 'pending';
  }
}

/**
 * Update approval status in Supabase
 */
export async function updateApprovalStatusInSupabase(
  approvalId: string,
  status: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase
      .from('untouched_pending_approvals')
      .update({ status })
      .eq('id', approvalId);
  } catch (error) {
    console.error('[Supabase] Failed to update approval status:', error);
  }
}

/**
 * Sync approval to Supabase
 */
async function syncApprovalToSupabase(
  approval: PendingApproval,
  apiKey: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const userId = getVaultIdForKey(apiKey) || 'user_default';

    await supabase.from('untouched_pending_approvals').insert({
      id: approval.id,
      user_id: userId,
      api_key: apiKey,
      timestamp: approval.timestamp,
      model: approval.model,
      estimated_cost_usdc: approval.estimatedCostUSDC,
      required_action: approval.requiredAction,
      status: 'pending',
    });
  } catch (error) {
    console.error('[Supabase] Failed to sync approval:', error);
  }
}

// ============================================================================
// Debug Utilities
// ============================================================================

export function getAllUsers(): UserState[] {
  const store = getStore();
  return Array.from(store.users.values());
}

export function resetStore(): void {
  globalThis.__untouchedStore = initStore();
}
