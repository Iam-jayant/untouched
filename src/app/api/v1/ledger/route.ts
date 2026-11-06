import { NextResponse } from 'next/server';
import { ARC_USYC_ADDRESS, VAULT_ADDRESS } from '@/lib/constants';
import { readVaultPositions } from '@/lib/vault-chain';
import { getStore } from '@/lib/agent-store';

export async function GET() {
  const chain = await readVaultPositions().catch((error) => {
    console.error('[ledger] vault read failed', error);
    return [];
  });
  const store = getStore();
  const seen = new Set<string>();
  const users = [];
  for (const user of store.users.values()) {
    const id = (user.walletAddress || '').toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    users.push({
      wallet: id,
      principal: user.principal,
      yieldQuota: user.battery,
      usedCredit: Math.max(0, user.battery - user.remaining),
    });
  }
  return NextResponse.json({
    vault: VAULT_ADDRESS,
    usyc: ARC_USYC_ADDRESS,
    chain,
    users,
  });
}
