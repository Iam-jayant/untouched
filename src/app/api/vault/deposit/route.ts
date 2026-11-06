import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getUser, createUser, createAPIKey, getAPIKeys } from '@/lib/agent-store';
import { ARC_EXPLORER, VAULT_ADDRESS } from '@/lib/constants';
import { readConfirmedDeposit, readVaultPosition } from '@/lib/arc';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { broadcastDepositConfirmed } from '@/lib/sse';

function personalKey(wallet: string): string {
  const prefix = wallet.slice(2, 6);
  const random = createHash('sha256').update(`${wallet}_${Date.now()}`).digest('hex').slice(0, 12);
  return `unt_live_${prefix}_${random}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const walletAddress = String(body.walletAddress || '').toLowerCase();
    const txHash = body.txHash as string | undefined;
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/) || !txHash) {
      return NextResponse.json({ success: false, error: 'Wallet address and confirmed tx hash are required' }, { status: 400 });
    }
    if (!VAULT_ADDRESS) {
      return NextResponse.json({ success: false, error: 'Vault is not deployed' }, { status: 503 });
    }

    const confirmed = await readConfirmedDeposit(txHash, VAULT_ADDRESS, walletAddress);
    const position = await readVaultPosition(VAULT_ADDRESS, walletAddress);

    let user = getUser(walletAddress);
    if (!user && isSupabaseConfigured()) {
      const { syncUserFromSupabase } = await import('@/lib/agent-store');
      user = await syncUserFromSupabase(walletAddress);
    }
    if (!user) {
      user = await createUser({
        id: walletAddress,
        apiKey: walletAddress,
        displayName: `User ${walletAddress.slice(0, 6)}`,
        walletAddress,
        agentSigner: `0x${createHash('sha256').update(`untouched_agent_${walletAddress}`).digest('hex').slice(0, 40)}`,
        principal: 0,
        advance: 0,
        battery: 0,
        remaining: 0,
        maxPerCallUsdc: 5000,
        depositTimestamp: 0,
        lastActivity: Date.now(),
      });
    }

    const existingKeys = getAPIKeys(walletAddress);
    let apiKey = existingKeys[0]?.key || (user.apiKey?.startsWith('unt_live_') ? user.apiKey : '');
    if (!apiKey) {
      const created = await createAPIKey({
        key: personalKey(walletAddress),
        userId: walletAddress,
        name: 'Master Vault Key',
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      apiKey = created.key;
    }

    user.principal = position.principal;
    user.battery = position.yieldQuota;
    user.remaining = Math.max(0, position.yieldQuota - position.usedCredit);
    user.advance = user.battery;
    user.lastActivity = Date.now();
    if (!user.depositTimestamp) user.depositTimestamp = Date.now();

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.from('untouched_users').upsert({
          id: walletAddress,
          wallet_address: walletAddress,
          display_name: user.displayName || `User ${walletAddress.slice(0, 6)}`,
          agent_signer_eoa: user.agentSigner,
          principal_usdc: user.principal,
          yield_battery_usdc: user.battery,
          remaining_usdc: user.remaining,
          last_activity: new Date(user.lastActivity).toISOString(),
          deposit_timestamp: user.depositTimestamp,
          max_per_call_usdc: user.maxPerCallUsdc || 5000,
        }, { onConflict: 'id' });
      }
    }

    broadcastDepositConfirmed(walletAddress, {
      principal: user.principal,
      battery: user.battery,
      remaining: user.remaining,
      advance: user.advance,
    });

    return NextResponse.json({
      success: true,
      apiKey,
      principal: user.principal,
      battery: user.battery,
      remaining: user.remaining,
      advance: user.advance,
      txHash,
      amount6Dec: confirmed.amount6Dec,
      explorerUrl: `${ARC_EXPLORER}/tx/${txHash}`,
      verified: true,
    });
  } catch (error) {
    console.error('[API] /vault/deposit error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
