/**
 * One-click Arc Testnet vault calls.
 * Native USDC uses 18 decimals. depositNative needs no ERC-20 approval.
 */

import { ethers } from 'ethers';
import { ARC_EXPLORER, ARC_USDC_ADDRESS } from './constants';
import { arcReadProvider, explainWalletError, getArcSigner } from './wallet';

const VAULT_ABI = [
  'function depositNative() payable',
  'function withdraw()',
];

function vaultAddress(): string {
  return process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0xcA9F8D931b6a0dE64ED74757A66aCB203413f2C1';
}

export function isWalletAvailable(): boolean {
  return typeof window !== 'undefined';
}

export async function signAndExecuteDeposit(amountUsdcDisplay: number): Promise<{
  txHash: string;
  walletAddress: string;
  explorerUrl: string;
  amount6Dec: number;
  quota6Dec: number;
}> {
  try {
    if (amountUsdcDisplay < 10) throw new Error('Minimum deposit is $10.00');
    const signer = await getArcSigner();
    const walletAddress = (await signer.getAddress()).toLowerCase();
    const value = ethers.utils.parseUnits(String(amountUsdcDisplay), 18);
    const reader = arcReadProvider();
    const balance = await reader.getBalance(walletAddress);
    if (balance.lt(value)) {
      throw new Error(`This wallet has ${ethers.utils.formatUnits(balance, 18)} USDC on Arc. A $${amountUsdcDisplay} stake needs more.`);
    }
    const vaultRead = new ethers.Contract(vaultAddress(), VAULT_ABI, reader);
    await vaultRead.callStatic.depositNative({ from: walletAddress, value });
    const gasPrice = await reader.getGasPrice();
    const vault = new ethers.Contract(vaultAddress(), VAULT_ABI, signer);
    const tx = await vault.depositNative({
      value,
      gasLimit: 250000,
      gasPrice,
      type: 0,
    });
    const receipt = await tx.wait();
    const amount6Dec = Math.floor(amountUsdcDisplay * 1_000000);
    const quota6Dec = Math.floor((amount6Dec * 500 * 14) / (10000 * 365));
    return {
      txHash: receipt.transactionHash,
      walletAddress,
      explorerUrl: `${ARC_EXPLORER}/tx/${receipt.transactionHash}`,
      amount6Dec,
      quota6Dec,
    };
  } catch (error) {
    throw new Error(explainWalletError(error));
  }
}

export async function signAndExecuteWithdrawal(): Promise<{
  txHash: string;
  walletAddress: string;
  explorerUrl: string;
}> {
  const signer = await getArcSigner();
  const walletAddress = (await signer.getAddress()).toLowerCase();
  const reader = arcReadProvider();
  const gasPrice = await reader.getGasPrice();
  const vault = new ethers.Contract(vaultAddress(), VAULT_ABI, signer);
  const tx = await vault.withdraw({ gasLimit: 200000, gasPrice, type: 0 });
  const receipt = await tx.wait();
  return {
    txHash: receipt.transactionHash,
    walletAddress,
    explorerUrl: `${ARC_EXPLORER}/tx/${receipt.transactionHash}`,
  };
}

export async function getWalletBalance(address: string): Promise<string> {
  const balance = await arcReadProvider().getBalance(address);
  return ethers.utils.formatUnits(balance, 18);
}

export { explainWalletError };

export const USDC_ADDRESS = ARC_USDC_ADDRESS;
