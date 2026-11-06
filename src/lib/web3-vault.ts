/**
 * Web3 Vault Interaction Module
 * Real wallet interactions with MetaMask/Rabby/Rainbow/Coinbase
 * 
 * Every deposit and withdrawal MUST:
 * 1. Pop up wallet for signature/transaction
 * 2. Get cryptographic proof (EIP-712 or transaction hash)
 * 3. Submit proof to backend for verification
 */

import { ethers } from 'ethers';

// Arc Testnet configuration
const ARC_TESTNET_CONFIG = {
  chainId: '0x4cef52', // 5042002 in hex
  chainIdDecimal: 5042002,
  chainName: 'Arc Testnet',
  rpcUrls: ['https://rpc.testnet.arc.network'],
  nativeCurrency: {
    name: 'ARC',
    symbol: 'ARC',
    decimals: 18,
  },
  blockExplorerUrls: ['https://explorer.testnet.arc.network'],
};

// Contract addresses (from .env or defaults)
const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

// EIP-712 Domain for Deposit Authorization
const DEPOSIT_DOMAIN = {
  name: 'Untouched PrincipalCreditVault (USYC)',
  version: '1',
  verifyingContract: VAULT_ADDRESS,
};

// EIP-712 Types for Deposit
const DEPOSIT_TYPES = {
  DepositWithAuthorization: [
    { name: 'depositor', type: 'address' },
    { name: 'token', type: 'string' },
    { name: 'principalAmountMicroUSDC', type: 'string' },
    { name: 'estimated14DayYieldMicroUSDC', type: 'string' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'validBefore', type: 'uint256' },
  ],
};

// EIP-712 Types for Withdrawal
const WITHDRAW_TYPES = {
  WithdrawWithAuthorization: [
    { name: 'withdrawer', type: 'address' },
    { name: 'principalAmountMicroUSDC', type: 'string' },
    { name: 'yieldForfeitedMicroUSDC', type: 'string' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'validBefore', type: 'uint256' },
  ],
};

/**
 * Check if window.ethereum is available
 */
export function isWalletAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
}

/**
 * Get the current chain ID from wallet
 */
async function getCurrentChainId(): Promise<string> {
  if (!isWalletAvailable() || !window.ethereum) {
    throw new Error('No wallet detected. Please install MetaMask, Rabby, or another Web3 wallet.');
  }

  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  return chainId as string;
}

/**
 * Switch to Arc Testnet or add it if not present
 */
async function switchToArcTestnet(): Promise<void> {
  if (!isWalletAvailable() || !window.ethereum) {
    throw new Error('No wallet detected');
  }

  try {
    // Try to switch to Arc Testnet
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_TESTNET_CONFIG.chainId }],
    });
  } catch (switchError: any) {
    // Chain not added yet, add it
    if (switchError.code === 4902) {
      try {
        if (!window.ethereum) throw new Error('Wallet disconnected');
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [ARC_TESTNET_CONFIG],
        });
      } catch (addError) {
        throw new Error('Failed to add Arc Testnet to your wallet');
      }
    } else {
      throw switchError;
    }
  }
}

/**
 * Ensure wallet is connected and on correct network
 */
export async function ensureWalletAndNetwork(): Promise<string> {
  if (!isWalletAvailable() || !window.ethereum) {
    throw new Error('No wallet detected. Please install MetaMask, Rabby, or another Web3 wallet.');
  }

  // Request account access
  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts',
  }) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found. Please unlock your wallet.');
  }

  const walletAddress = accounts[0];

  // Check current chain
  const currentChainId = await getCurrentChainId();
  
  // If not on Arc Testnet, try to switch
  if (currentChainId !== ARC_TESTNET_CONFIG.chainId) {
    console.log(`Current chain: ${currentChainId}, switching to Arc Testnet...`);
    await switchToArcTestnet();
  }

  return walletAddress;
}

/**
 * Generate random nonce for EIP-712 signatures
 */
function generateNonce(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sign and execute a deposit
 * Returns: { signature, message, txHash? }
 */
export async function signAndExecuteDeposit(amountUsdcDisplay: number): Promise<{
  signature: string;
  message: any;
  txHash?: string;
  walletAddress: string;
}> {
  // Step 0: Validate amount
  if (amountUsdcDisplay < 10) {
    throw new Error('Minimum deposit is $10.00');
  }

  // Step 1: Ensure wallet connected and on correct network
  const walletAddress = await ensureWalletAndNetwork();

  // Step 2: Convert to micro-USDC (6 decimals)
  const amountMicro = Math.floor(amountUsdcDisplay * 1_000000);
  const estimated14DayYield = Math.floor(amountMicro * 0.05 * (14 / 365));

  // Step 3: Build EIP-712 message
  const currentChainId = await getCurrentChainId();
  const domain = {
    ...DEPOSIT_DOMAIN,
    chainId: parseInt(currentChainId, 16),
  };

  const message = {
    depositor: walletAddress,
    token: 'USDC -> USYC',
    principalAmountMicroUSDC: String(amountMicro),
    estimated14DayYieldMicroUSDC: String(estimated14DayYield),
    nonce: generateNonce(),
    validBefore: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
  };

  // Step 4: Request EIP-712 signature from wallet (MUST pop up wallet)
  console.log('[Web3] Requesting EIP-712 signature for deposit...');
  
  if (!window.ethereum) {
    throw new Error('Wallet disconnected during signing');
  }

  let signature: string;
  try {
    signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [walletAddress, JSON.stringify({
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          DepositWithAuthorization: DEPOSIT_TYPES.DepositWithAuthorization,
        },
        domain,
        primaryType: 'DepositWithAuthorization',
        message,
      })],
    }) as string;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error('User rejected the signature request');
    }
    throw new Error(`Signature failed: ${error.message}`);
  }

  console.log('[Web3] Signature received:', signature.slice(0, 20) + '...');

  // Step 5: Optional - Execute on-chain transaction if vault is deployed
  let txHash: string | undefined;
  
  // For testnet demo, we skip the actual transaction but could add:
  // if (VAULT_ADDRESS !== '0x5FbDB2315678afecb367f032d93F642f64180aa3') {
  //   txHash = await executeDepositTransaction(walletAddress, amountMicro);
  // }

  return {
    signature,
    message,
    txHash,
    walletAddress,
  };
}

/**
 * Sign and execute a withdrawal
 * Returns: { signature, message, txHash? }
 */
export async function signAndExecuteWithdrawal(
  amountUsdcDisplay: number,
  yieldForfeited: number
): Promise<{
  signature: string;
  message: any;
  txHash?: string;
  walletAddress: string;
}> {
  // Step 1: Ensure wallet connected and on correct network
  const walletAddress = await ensureWalletAndNetwork();

  // Step 2: Convert to micro-USDC
  const amountMicro = Math.floor(amountUsdcDisplay * 1_000000);
  const yieldForfeitedMicro = Math.floor(yieldForfeited * 1_000000);

  // Step 3: Build EIP-712 message
  const currentChainId = await getCurrentChainId();
  const domain = {
    ...DEPOSIT_DOMAIN,
    chainId: parseInt(currentChainId, 16),
  };

  const message = {
    withdrawer: walletAddress,
    principalAmountMicroUSDC: String(amountMicro),
    yieldForfeitedMicroUSDC: String(yieldForfeitedMicro),
    nonce: generateNonce(),
    validBefore: Math.floor(Date.now() / 1000) + 3600,
  };

  // Step 4: Request EIP-712 signature (MUST pop up wallet)
  console.log('[Web3] Requesting EIP-712 signature for withdrawal...');
  
  if (!window.ethereum) {
    throw new Error('Wallet disconnected during signing');
  }

  let signature: string;
  try {
    signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [walletAddress, JSON.stringify({
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          WithdrawWithAuthorization: WITHDRAW_TYPES.WithdrawWithAuthorization,
        },
        domain,
        primaryType: 'WithdrawWithAuthorization',
        message,
      })],
    }) as string;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error('User rejected the signature request');
    }
    throw new Error(`Signature failed: ${error.message}`);
  }

  console.log('[Web3] Withdrawal signature received');

  return {
    signature,
    message,
    walletAddress,
  };
}

/**
 * Approve USDC spending (for future on-chain deposits)
 */
export async function approveUSDCSpending(amountUsdcDisplay: number): Promise<string> {
  const walletAddress = await ensureWalletAndNetwork();
  const amountMicro = Math.floor(amountUsdcDisplay * 1_000000);

  if (!window.ethereum) {
    throw new Error('Wallet disconnected');
  }

  // ERC-20 approve function signature: approve(address,uint256)
  const approveData = ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256'],
    [VAULT_ADDRESS, amountMicro]
  );
  
  const functionSignature = ethers.utils.id('approve(address,uint256)').slice(0, 10);
  const fullData = functionSignature + approveData.slice(2);

  try {
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to: USDC_ADDRESS,
        data: fullData,
      }],
    }) as string;

    return txHash;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error('User rejected the approval transaction');
    }
    throw new Error(`Approval failed: ${error.message}`);
  }
}

/**
 * Get wallet balance (for display purposes)
 */
export async function getWalletBalance(address: string): Promise<string> {
  if (!isWalletAvailable() || !window.ethereum) {
    return '0';
  }

  try {
    const balance = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [address, 'latest'],
    }) as string;

    return ethers.utils.formatEther(balance);
  } catch (error) {
    console.error('[Web3] Failed to get balance:', error);
    return '0';
  }
}
