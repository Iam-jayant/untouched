import { ethers } from 'ethers';
import {
  ARC_CAIP2,
  ARC_TESTNET_CHAIN_ID,
  ARC_USDC_ADDRESS,
  GATEWAY_WALLET_ADDRESS,
} from './constants';

const DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: ARC_TESTNET_CHAIN_ID,
  verifyingContract: ARC_USDC_ADDRESS,
};

const TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

export interface X402Receipt {
  scheme: 'eip3009-gateway-nanopayment';
  network: string;
  token: string;
  amountMicroUSDC: number;
  payer: string;
  payTo: string;
  signature: string;
}

function signerWallet(): ethers.Wallet {
  const key = process.env.AGENT_SIGNER_PRIVATE_KEY;
  if (!key) {
    throw new Error('AGENT_SIGNER_PRIVATE_KEY is required to sign x402 authorizations');
  }
  return new ethers.Wallet(key);
}

export async function signGatewayPayment(amountMicroUSDC: number): Promise<{
  receipt: X402Receipt;
  header: string;
  signature: string;
}> {
  const wallet = signerWallet();
  const now = Math.floor(Date.now() / 1000);
  const message = {
    from: wallet.address,
    to: GATEWAY_WALLET_ADDRESS,
    value: amountMicroUSDC,
    validAfter: 0,
    validBefore: now + 3600,
    nonce: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
  };
  const signature = await wallet._signTypedData(DOMAIN, TYPES, message);
  const receipt: X402Receipt = {
    scheme: 'eip3009-gateway-nanopayment',
    network: ARC_CAIP2,
    token: ARC_USDC_ADDRESS,
    amountMicroUSDC,
    payer: wallet.address,
    payTo: GATEWAY_WALLET_ADDRESS,
    signature,
  };
  return {
    receipt,
    header: Buffer.from(JSON.stringify(receipt)).toString('base64'),
    signature,
  };
}

export function paymentRequiredHeader(amountMicroUSDC: number, reason: string): string {
  return Buffer.from(JSON.stringify({
    scheme: 'eip3009-gateway-nanopayment',
    network: ARC_CAIP2,
    token: ARC_USDC_ADDRESS,
    amountMicroUSDC,
    payTo: GATEWAY_WALLET_ADDRESS,
    chainId: ARC_TESTNET_CHAIN_ID,
    reason,
    replenish: 'Stake USDC on Arc Testnet with depositNative. Principal stays in the vault. The 14-day yield quota pays the call.',
  })).toString('base64');
}
