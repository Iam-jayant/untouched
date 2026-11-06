/**
 * Chainlink CRE yield reconcile.
 * Single JSON-RPC calls only. Arc rejects batched requests with -32600.
 */

import { ethers } from 'ethers';

const RPC = process.env.ARC_TESTNET_RPC || 'https://rpc.testnet.arc.network';
const FALLBACK = process.env.ARC_RPC_FALLBACK || 'https://rpc.solidrpc.io/public/evm/5042002';
const VAULT = process.env.VAULT_ADDRESS || process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0xcA9F8D931b6a0dE64ED74757A66aCB203413f2C1';
const USYC = '0xe9185f0c5f296ed1797aae4238d26ccabeadb86c';
const LEDGER = process.env.LEDGER_URL || 'http://127.0.0.1:3000/api/v1/ledger';

const VAULT_ABI = [
  'function depositorCount() view returns (uint256)',
  'function depositors(uint256) view returns (address)',
  'function positions(address) view returns (uint256 principal, uint256 yieldQuota, uint256 usedCredit)',
  'function reconcile(address user, uint256 surplus6Dec)',
];
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

function provider(url: string) {
  return new ethers.providers.StaticJsonRpcProvider(url, 5042002);
}

export async function reconcileYield() {
  if (!VAULT) {
    return { success: false, skipped: true, reason: 'VAULT_ADDRESS is not set' };
  }

  let rpc = provider(RPC);
  let usycBalance: ethers.BigNumber;
  try {
    usycBalance = await new ethers.Contract(USYC, ERC20_ABI, rpc).balanceOf(VAULT);
  } catch {
    rpc = provider(FALLBACK);
    usycBalance = await new ethers.Contract(USYC, ERC20_ABI, rpc).balanceOf(VAULT);
  }

  const ledgerResponse = await fetch(LEDGER);
  const ledger = await ledgerResponse.json();
  const vault = new ethers.Contract(VAULT, VAULT_ABI, rpc);
  const count = (await vault.depositorCount()).toNumber();
  const planned: Array<{ user: string; surplus6Dec: string }> = [];

  for (let i = 0; i < count; i += 1) {
    const user = await vault.depositors(i);
    const pos = await vault.positions(user);
    const used = ethers.BigNumber.from(pos.usedCredit);
    const offchain = (ledger.users || []).find((row: { wallet: string }) => String(row.wallet).toLowerCase() === String(user).toLowerCase());
    const spent = ethers.BigNumber.from(offchain?.usedCredit || 0);
    const cover = used.gt(spent) ? used : spent;
    if (cover.gt(0) && usycBalance.gt(0)) {
      planned.push({ user, surplus6Dec: cover.toString() });
    }
  }

  if (process.env.CRE_SIMULATE === '1' || !process.env.PRIVATE_KEY) {
    return { success: true, simulated: true, usycBalance: usycBalance.toString(), planned };
  }

  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, rpc);
  const writable = vault.connect(signer);
  const txs: string[] = [];
  for (const item of planned) {
    const tx = await writable.reconcile(item.user, item.surplus6Dec);
    txs.push((await tx.wait()).transactionHash);
  }
  return { success: true, simulated: false, txs };
}
