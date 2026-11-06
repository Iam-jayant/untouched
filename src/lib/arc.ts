import { ethers } from 'ethers';
import { ARC_RPC_FALLBACK, ARC_RPC_URL, ARC_USDC_ADDRESS } from './constants';

const DEPOSITED_TOPIC = ethers.utils.id('Deposited(address,uint256,uint256)');
const WITHDRAWN_TOPIC = ethers.utils.id('Withdrawn(address,uint256)');

function rpc(url: string): ethers.providers.StaticJsonRpcProvider {
  // skipFetchSetup avoids ethers' browser fetch options. Node rejects referrer "client"
  // and the Arc call comes back as "missing response" even when the receipt exists.
  return new ethers.providers.StaticJsonRpcProvider({ url, skipFetchSetup: true, timeout: 20_000 }, 5042002);
}

export function arcProvider(): ethers.providers.StaticJsonRpcProvider {
  return rpc(process.env.NEXT_PUBLIC_ARC_TESTNET_RPC || ARC_RPC_URL);
}

export function arcFallbackProvider(): ethers.providers.StaticJsonRpcProvider {
  return rpc(ARC_RPC_FALLBACK);
}

function retryable(error: unknown): boolean {
  const message = String((error as Error)?.message || error || '').toLowerCase();
  return message.includes('missing response')
    || message.includes('not confirmed')
    || message.includes('server_error')
    || message.includes('timeout')
    || message.includes('failed to fetch')
    || message.includes('bad response');
}

async function withProvider<T>(read: (provider: ethers.providers.StaticJsonRpcProvider) => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await read(arcProvider());
    } catch (error) {
      last = error;
      if (!retryable(error) || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  try {
    return await read(arcFallbackProvider());
  } catch (error) {
    console.warn('[arc] receipt read failed', last);
    throw last instanceof Error ? last : error;
  }
}

export async function readConfirmedDeposit(txHash: string, vault: string, wallet: string): Promise<{
  amount6Dec: number;
  quota6Dec: number;
}> {
  return withProvider(async (provider) => {
    const receipt = await provider.getTransactionReceipt(txHash);
    const tx = await provider.getTransaction(txHash);
    if (!receipt || receipt.status !== 1) {
      throw new Error('Deposit transaction is not confirmed');
    }
    if (!tx || tx.to?.toLowerCase() !== vault.toLowerCase()) {
      throw new Error('Transaction is not a vault call');
    }
    if (tx.from.toLowerCase() !== wallet.toLowerCase()) {
      throw new Error('Transaction sender does not match the wallet');
    }
    const log = receipt.logs.find((entry) =>
      entry.address.toLowerCase() === vault.toLowerCase() && entry.topics[0] === DEPOSITED_TOPIC
    );
    if (!log) throw new Error('Deposit event not found');
    const user = ethers.utils.getAddress(ethers.utils.hexDataSlice(log.topics[1], 12));
    if (user.toLowerCase() !== wallet.toLowerCase()) {
      throw new Error('Deposit event user does not match the wallet');
    }
    const decoded = ethers.utils.defaultAbiCoder.decode(['uint256', 'uint256'], log.data);
    return { amount6Dec: decoded[0].toNumber(), quota6Dec: decoded[1].toNumber() };
  });
}

export async function readConfirmedWithdraw(txHash: string, vault: string, wallet: string): Promise<number> {
  return withProvider(async (provider) => {
    const receipt = await provider.getTransactionReceipt(txHash);
    const tx = await provider.getTransaction(txHash);
    if (!receipt || receipt.status !== 1 || !tx) throw new Error('Withdraw transaction is not confirmed');
    if (tx.to?.toLowerCase() !== vault.toLowerCase()) throw new Error('Transaction is not a vault call');
    if (tx.from.toLowerCase() !== wallet.toLowerCase()) throw new Error('Transaction sender does not match the wallet');
    const log = receipt.logs.find((entry) =>
      entry.address.toLowerCase() === vault.toLowerCase() && entry.topics[0] === WITHDRAWN_TOPIC
    );
    if (!log) throw new Error('Withdraw event not found');
    const user = ethers.utils.getAddress(ethers.utils.hexDataSlice(log.topics[1], 12));
    if (user.toLowerCase() !== wallet.toLowerCase()) throw new Error('Withdraw event user does not match the wallet');
    const decoded = ethers.utils.defaultAbiCoder.decode(['uint256'], log.data);
    return decoded[0].toNumber();
  });
}

export async function readVaultPosition(vault: string, wallet: string): Promise<{
  principal: number;
  yieldQuota: number;
  usedCredit: number;
}> {
  const abi = ['function positions(address) view returns (uint256 principal, uint256 yieldQuota, uint256 usedCredit)'];
  return withProvider(async (provider) => {
    const contract = new ethers.Contract(vault, abi, provider);
    const position = await contract.positions(wallet);
    return {
      principal: Number(position.principal),
      yieldQuota: Number(position.yieldQuota),
      usedCredit: Number(position.usedCredit),
    };
  });
}

export const USDC_PRECOMPILE = ARC_USDC_ADDRESS;
