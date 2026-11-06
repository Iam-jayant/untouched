/**
 * GET /api/vault/status?apiKey=xxx
 * Get user status (with receipts and pending approvals for hybrid polling)
 * Updated: Syncs from Supabase when user not in memory
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser, getReceipts, getPendingApprovals } from '@/lib/agent-store';

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
