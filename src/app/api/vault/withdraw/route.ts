import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/agent-store';
import { VAULT_ADDRESS } from '@/lib/constants';
import { readConfirmedWithdraw } from '@/lib/arc';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { broadcastBalanceUpdate } from '@/lib/sse';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const walletAddress = String(body.walletAddress || '').toLowerCase();
    const txHash = body.txHash as string | undefined;
    const apiKey = body.apiKey as string | undefined;
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/) || !txHash) {
      return NextResponse.json({ success: false, error: 'Wallet address and confirmed tx hash are required' }, { status: 400 });
    }
    if (!VAULT_ADDRESS) {
      return NextResponse.json({ success: false, error: 'Vault is not deployed' }, { status: 503 });
    }

    const payout6Dec = await readConfirmedWithdraw(txHash, VAULT_ADDRESS, walletAddress);
    const user = getUser(walletAddress) || (apiKey ? getUser(apiKey) : undefined);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    user.principal = 0;
    user.battery = 0;
    user.remaining = 0;
    user.advance = 0;
    user.lastActivity = Date.now();

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      await supabase?.from('untouched_users').update({
        principal_usdc: 0,
        yield_battery_usdc: 0,
        remaining_usdc: 0,
        last_activity: new Date().toISOString(),
      }).eq('id', walletAddress);
    }

    broadcastBalanceUpdate(walletAddress, 0);
    return NextResponse.json({ success: true, payout6Dec, txHash, principal: 0, battery: 0, remaining: 0, advance: 0 });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
  }
}
