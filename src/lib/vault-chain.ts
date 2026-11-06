import { ethers } from 'ethers';
import { VAULT_ADDRESS } from './constants';
import { arcProvider } from './arc';

const VAULT_ABI = [
  'function recordUsage(address user, uint256 amount6Dec)',
  'function positions(address) view returns (uint256 principal, uint256 yieldQuota, uint256 usedCredit)',
  'function depositorCount() view returns (uint256)',
  'function depositors(uint256) view returns (address)',
];

export async function recordUsageOnChain(user: string, amount6Dec: number): Promise<string | null> {
  const key = process.env.AGENT_SIGNER_PRIVATE_KEY;
  if (!VAULT_ADDRESS || !key || amount6Dec <= 0) return null;
  const wallet = new ethers.Wallet(key, arcProvider());
  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, wallet);
  const tx = await vault.recordUsage(user, amount6Dec);
  const receipt = await tx.wait();
  return receipt.transactionHash as string;
}

export async function readVaultPositions(): Promise<Array<{
  user: string;
  principal: string;
  yieldQuota: string;
  usedCredit: string;
}>> {
  if (!VAULT_ADDRESS) return [];
  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, arcProvider());
  const count = await vault.depositorCount();
  const total = count.toNumber();
  const rows = [];
  for (let i = 0; i < total; i += 1) {
    const user = await vault.depositors(i);
    const pos = await vault.positions(user);
    rows.push({
      user,
      principal: pos.principal.toString(),
      yieldQuota: pos.yieldQuota.toString(),
      usedCredit: pos.usedCredit.toString(),
    });
  }
  return rows;
}
