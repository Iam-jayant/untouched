/**
 * POST /api/vault/auth
 * Wallet Authentication & User Profile Onboarding
 * 
 * Flow:
 * 1. Accept walletAddress (0x...) from MetaMask/Rabby/Rainbow
 * 2. Check if user exists in Supabase/agent-store
 * 3. If new: create profile + derive agent_signer_eoa + generate personal API key
 * 4. If existing: load profile + API keys
 * 5. Return { user, apiKeys, activeApiKey }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getUser, createUser, getAPIKeys, createAPIKey } from '@/lib/agent-store';
import { DEMO_DEPOSIT_USDC, calculateAdvance, calculateBattery } from '@/lib/constants';

function normalizeAddress(address: string): string {
  return address.toLowerCase().trim();
}

function deriveAgentSigner(walletAddress: string): string {
  // Derive deterministic isolated agent signer EOA from user's wallet
  // Using keccak256-like hash (simplified for demo - production should use proper derivation)
  const hash = createHash('sha256').update(`untouched_agent_${walletAddress}`).digest('hex');
  return `0x${hash.slice(0, 40)}`;
}

function generatePersonalAPIKey(walletAddress: string): string {
  // Format: unt_live_<first4hex>_<random12hex>
  const prefix = walletAddress.slice(2, 6).toLowerCase();
  const random = createHash('sha256')
    .update(`${walletAddress}_${Date.now()}_${Math.random()}`)
    .digest('hex')
    .slice(0, 12);
  return `unt_live_${prefix}_${random}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, displayName } = body;

    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const normalizedWallet = normalizeAddress(walletAddress);

    // Check if user exists (use wallet as user ID)
    let user = getUser(normalizedWallet);

    // If not found in memory OR if user has 0 principal, try restoring from Supabase before declaring as new user
    if (!user || user.principal === 0) {
      const { syncUserFromSupabase } = await import('@/lib/agent-store');
      const { isSupabaseConfigured } = await import('@/lib/supabase');
      if (isSupabaseConfigured()) {
        const synced = await syncUserFromSupabase(normalizedWallet);
        if (synced) {
          user = synced;
        }
      }
    }

    if (user) {
      // Existing user - load their profile and keys
      const apiKeys = getAPIKeys(normalizedWallet);
      const activeApiKey = apiKeys.length > 0 ? apiKeys[0].key : (user.apiKey || normalizedWallet);

      return NextResponse.json({
        status: 'existing_user',
        user: {
          id: normalizedWallet,
          apiKey: activeApiKey,
          walletAddress: normalizedWallet,
          displayName: user.displayName,
          agentSigner: user.agentSigner,
          principal: user.principal,
          advance: user.advance,
          battery: user.battery,
          remaining: user.remaining,
          maxPerCallUsdc: user.maxPerCallUsdc,
          depositTimestamp: user.depositTimestamp,
        },
        apiKeys,
        activeApiKey,
      });
    }

    // New user - create profile
    const agentSignerEOA = deriveAgentSigner(normalizedWallet);
    const personalAPIKey = generatePersonalAPIKey(normalizedWallet);

    // Initialize with $0 - user must deposit first
    const initialPrincipal = 0;
    const advance = 0;
    const battery = 0;

    // Create user in agent-store (and Supabase if configured)
    const newUser = await createUser({
      id: normalizedWallet,
      apiKey: normalizedWallet, // Use wallet as primary identifier
      displayName: displayName || `User ${normalizedWallet.slice(0, 6)}`,
      walletAddress: normalizedWallet,
      agentSigner: agentSignerEOA,
      principal: initialPrincipal,
      advance,
      battery,
      remaining: battery,
      maxPerCallUsdc: 5000, // $0.005
      depositTimestamp: Date.now(),
      lastActivity: Date.now(),
    });

    // Create personal master API key
    const apiKey = await createAPIKey({
      key: personalAPIKey,
      userId: normalizedWallet,
      name: 'Master Vault Key',
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    const apiKeys = [apiKey];

    return NextResponse.json({
      status: 'new_user',
      user: {
        id: normalizedWallet,
        walletAddress: normalizedWallet,
        displayName: newUser.displayName,
        agentSigner: agentSignerEOA,
        principal: newUser.principal,
        advance: newUser.advance,
        battery: newUser.battery,
        remaining: newUser.remaining,
        maxPerCallUsdc: newUser.maxPerCallUsdc,
        depositTimestamp: newUser.depositTimestamp,
      },
      apiKeys,
      activeApiKey: personalAPIKey,
    });
  } catch (error) {
    console.error('[API] /vault/auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
