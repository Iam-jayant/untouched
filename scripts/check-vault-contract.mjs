#!/usr/bin/env node
/**
 * Check if vault contract is deployed and working
 */

import { ethers } from 'ethers';

const RPC = 'https://rpc.testnet.arc.network';
const VAULT_ADDRESS = '0x649a09b10c70fffe9ef5f8d70e5a7de292b793df';
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
const WALLET_ADDRESS = '0xce86a572686F22E7D1B9f6763c7B695F79762854';

const VAULT_ABI = [
  'function depositWithCreditAdvance(uint256 amountUsdc, address agentSignerEOA, bytes32 worldIdNullifier)',
  'function positions(address) view returns (uint256 principalUsdc, uint256 shares, uint256 maxPerCallUsdc, address agentSignerEOA, uint256 unpaidAdvanceUsdc, bytes32 worldIdNullifier)',
  'function MIN_DEPOSIT_USDC() view returns (uint256)',
  'function owner() view returns (address)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

async function checkVault() {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  
  console.log('🔍 Checking Vault Contract\n');
  console.log('Vault:', VAULT_ADDRESS);
  console.log('USDC:', USDC_ADDRESS);
  console.log('Wallet:', WALLET_ADDRESS);
  console.log('');

  // Check if vault contract exists
  console.log('1️⃣ Checking if vault contract is deployed...');
  const vaultCode = await provider.getCode(VAULT_ADDRESS);
  if (vaultCode === '0x') {
    console.log('❌ Vault contract NOT deployed at this address!\n');
    return;
  }
  console.log('✅ Vault contract exists\n');

  // Check vault owner
  console.log('2️⃣ Checking vault owner...');
  try {
    const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
    const owner = await vaultContract.owner();
    console.log('✅ Vault owner:', owner, '\n');
  } catch (error) {
    console.log('❌ Could not read vault owner:', error.message, '\n');
  }

  // Check minimum deposit
  console.log('3️⃣ Checking minimum deposit...');
  try {
    const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
    const minDeposit = await vaultContract.MIN_DEPOSIT_USDC();
    console.log('✅ Minimum deposit:', ethers.utils.formatUnits(minDeposit, 6), 'USDC\n');
  } catch (error) {
    console.log('❌ Could not read min deposit:', error.message, '\n');
  }

  // Check USDC balance
  console.log('4️⃣ Checking USDC balance...');
  try {
    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
    const balance = await usdcContract.balanceOf(WALLET_ADDRESS);
    const decimals = await usdcContract.decimals();
    console.log('✅ USDC balance:', ethers.utils.formatUnits(balance, decimals), 'USDC\n');
  } catch (error) {
    console.log('❌ Could not read USDC balance:', error.message, '\n');
  }

  // Check USDC allowance
  console.log('5️⃣ Checking USDC allowance for vault...');
  try {
    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
    const allowance = await usdcContract.allowance(WALLET_ADDRESS, VAULT_ADDRESS);
    const decimals = await usdcContract.decimals();
    console.log('✅ USDC allowance:', ethers.utils.formatUnits(allowance, decimals), 'USDC\n');
    
    if (allowance.eq(0)) {
      console.log('⚠️  You need to approve USDC spending first!\n');
    }
  } catch (error) {
    console.log('❌ Could not read allowance:', error.message, '\n');
  }

  // Check existing position
  console.log('6️⃣ Checking existing vault position...');
  try {
    const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
    const position = await vaultContract.positions(WALLET_ADDRESS);
    console.log('Position:');
    console.log('  Principal:', ethers.utils.formatUnits(position.principalUsdc, 6), 'USDC');
    console.log('  Shares:', position.shares.toString());
    console.log('  Unpaid advance:', ethers.utils.formatUnits(position.unpaidAdvanceUsdc, 6), 'USDC\n');
    
    if (position.principalUsdc.gt(0)) {
      console.log('⚠️  You already have a position! The contract might not allow a second deposit.\n');
    }
  } catch (error) {
    console.log('❌ Could not read position:', error.message, '\n');
  }

  // Try gas estimation
  console.log('7️⃣ Testing gas estimation for $10 deposit...');
  try {
    const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
    const amount = ethers.utils.parseUnits('10', 6);
    const agentEOA = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9';
    const nullifier = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    
    const gasEstimate = await vaultContract.estimateGas.depositWithCreditAdvance(
      amount,
      agentEOA,
      nullifier,
      { from: WALLET_ADDRESS }
    );
    
    console.log('✅ Gas estimate:', gasEstimate.toString());
    console.log('✅ Deposit should work!\n');
  } catch (error) {
    console.log('❌ Gas estimation failed!');
    console.log('Error:', error.message);
    
    if (error.reason) {
      console.log('Reason:', error.reason);
    }
    
    if (error.data) {
      console.log('Data:', error.data);
    }
    
    console.log('\n📋 Possible causes:');
    console.log('  1. You already have a position (contract allows only 1 deposit per address)');
    console.log('  2. USDC not approved');
    console.log('  3. Amount below minimum deposit');
    console.log('  4. World ID nullifier already used');
    console.log('  5. Contract paused or has insufficient reserve pool\n');
  }
}

checkVault().catch(console.error);
