/**
 * GET /api/vault/status?apiKey=xxx
 * Get user status (with receipts and pending approvals for hybrid polling)
 * Updated: Syncs from Supabase when user not in memory
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser, getReceipts, getPendingApprovals } from '@/lib/agent-store';
import { VAULT_ADDRESS } from '@/lib/constants';
import { readVaultPosition } from '@/lib/arc';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const queryKey = req.nextUrl.searchParams.get('apiKey');
    const queryWallet = req.nextUrl.searchParams.get('wallet');
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const apiKey = queryKey || queryWallet || authHeader;

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key or wallet' }, { status: 400 });
    }

    let user = getUser(apiKey);
    if (!user && queryWallet) {
      user = getUser(queryWallet);
    }
    
    // If user not found OR if user in memory has 0 principal, sync from Supabase
    if (!user || user.principal === 0) {
      const { syncUserFromSupabase } = await import('@/lib/agent-store');
      const { isSupabaseConfigured } = await import('@/lib/supabase');
      if (isSupabaseConfigured()) {
        const synced = (await syncUserFromSupabase(apiKey)) || (queryWallet ? await syncUserFromSupabase(queryWallet) : undefined);
        if (synced) {
          user = synced;
        }
      }
    }
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const wallet = (user.walletAddress || (queryWallet?.startsWith('0x') ? queryWallet : '')).toLowerCase();
    if (wallet && VAULT_ADDRESS) {
      try {
        const position = await readVaultPosition(VAULT_ADDRESS, wallet);
        const spentInDb = Math.max(0, (user.battery || 0) - (user.remaining || 0));
        const used = Math.max(position.usedCredit, spentInDb);
        const remaining = Math.max(0, position.yieldQuota - Math.min(used, position.yieldQuota));
        const changed = user.principal !== position.principal || user.battery !== position.yieldQuota || user.remaining !== remaining;
        user.principal = position.principal;
        user.battery = position.yieldQuota;
        user.advance = position.yieldQuota;
        user.remaining = remaining;
        user.walletAddress = wallet;
        if (changed && isSupabaseConfigured()) {
          const supabase = getSupabase();
          if (supabase) {
            await supabase.from('untouched_users').upsert({
              id: wallet,
              wallet_address: wallet,
              display_name: user.displayName || `User ${wallet.slice(0, 6)}`,
              agent_signer_eoa: user.agentSigner,
              principal_usdc: user.principal,
              yield_battery_usdc: user.battery,
              remaining_usdc: user.remaining,
              last_activity: new Date().toISOString(),
              deposit_timestamp: user.depositTimestamp || Date.now(),
              max_per_call_usdc: user.maxPerCallUsdc || 5000,
            }, { onConflict: 'id' });
          }
        }
      } catch (chainError) {
        console.warn('[API] /vault/status chain read skipped', chainError);
      }
    }

    const receipts = getReceipts(apiKey);
    const pendingApprovals = getPendingApprovals(apiKey);

    const response = {
      userState: {
        apiKey: user.apiKey || apiKey,
        principal: user.principal,
        advance: user.advance,
        battery: user.battery,
        remaining: user.remaining,
        agentSigner: user.agentSigner,
        depositTimestamp: user.depositTimestamp,
        lastActivity: user.lastActivity,
        maxPerCallUsdc: user.maxPerCallUsdc,
        displayName: user.displayName,
        walletAddress: user.walletAddress,
      },
      receipts: receipts.slice(0, 20), // Last 20 receipts
      pendingApprovals,
      connected: true, // Always true if this endpoint responds
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] /vault/status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
