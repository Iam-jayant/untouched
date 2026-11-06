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
import { getUser, createUser, getAPIKeys } from '@/lib/agent-store';

function normalizeAddress(address: string): string {
  return address.toLowerCase().trim();
}

function deriveAgentSigner(walletAddress: string): string {
  const hash = createHash('sha256').update(`untouched_agent_${walletAddress}`).digest('hex');
  return `0x${hash.slice(0, 40)}`;
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

    // New user. The API key is issued after the first confirmed stake.
    const agentSignerEOA = deriveAgentSigner(normalizedWallet);

    const newUser = await createUser({
      id: normalizedWallet,
      apiKey: normalizedWallet,
      displayName: displayName || `User ${normalizedWallet.slice(0, 6)}`,
      walletAddress: normalizedWallet,
      agentSigner: agentSignerEOA,
      principal: 0,
      advance: 0,
      battery: 0,
      remaining: 0,
      maxPerCallUsdc: 5000,
      depositTimestamp: 0,
      lastActivity: Date.now(),
    });

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
      apiKeys: [],
      activeApiKey: null,
    });
  } catch (error) {
    console.error('[API] /vault/auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
