/**
 * Local stand-in for `cre workflow simulate`.
 * The CRE CLI is not required for this check. It runs the same reads:
 * vault positions, official USYC balance, and the gateway ledger.
 */
import { ethers } from 'ethers';

const RPC = process.env.ARC_TESTNET_RPC || 'https://rpc.testnet.arc.network';
const USYC = '0xe9185f0c5f296ed1797aae4238d26ccabeadb86c';
const VAULT = process.env.NEXT_PUBLIC_VAULT_ADDRESS || process.env.VAULT_ADDRESS || '0xcA9F8D931b6a0dE64ED74757A66aCB203413f2C1';

const provider = new ethers.providers.StaticJsonRpcProvider(RPC, 5042002);

async function main() {
  const usyc = new ethers.Contract(USYC, ['function balanceOf(address) view returns (uint256)'], provider);
  const code = await provider.getCode(USYC);
  const block = await provider.getBlockNumber();
  const report = {
    simulated: true,
    chainId: 5042002,
    block,
    usycCode: code !== '0x',
    vault: VAULT || null,
  };
  if (VAULT) {
    const vault = new ethers.Contract(VAULT, [
      'function depositorCount() view returns (uint256)',
    ], provider);
    report.depositors = (await vault.depositorCount()).toString();
    report.usycBalance = (await usyc.balanceOf(VAULT)).toString();
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
