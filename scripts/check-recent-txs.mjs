#!/usr/bin/env node
/**
 * Check recent transactions from wallet
 */

import { ethers } from 'ethers';

const WALLET_ADDRESS = '0xce86a572686F22E7D1B9f6763c7B695F79762854';
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
const VAULT_ADDRESS = '0x649a09b10c70fffe9ef5f8d70e5a7de292b793df';
const RPC_URL = 'https://rpc.testnet.arc.network';

async function checkTransactions() {
  console.log('🔍 Checking recent transactions...\n');
  
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  try {
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log('Current block:', currentBlock);

    // Look at last 2000 blocks
    const fromBlock = currentBlock - 2000;
    console.log('Scanning from block:', fromBlock, '\n');

    // Check USDC transfers
    const usdcContract = new ethers.Contract(
      USDC_ADDRESS,
      ['event Transfer(address indexed from, address indexed to, uint256 value)'],
      provider
    );

    const filter = usdcContract.filters.Transfer(WALLET_ADDRESS, null);
    const events = await usdcContract.queryFilter(filter, fromBlock, currentBlock);

    console.log(`Found ${events.length} USDC Transfer events from ${WALLET_ADDRESS}:\n`);

    for (const event of events) {
      const tx = await event.getTransaction();
      const receipt = await event.getTransactionReceipt();
      
      console.log('─'.repeat(80));
      console.log('Block:', event.blockNumber);
      console.log('Tx Hash:', event.transactionHash);
      console.log('From:', event.args.from);
      console.log('To:', event.args.to);
      console.log('Amount:', ethers.utils.formatUnits(event.args.value, 6), 'USDC');
      console.log('Status:', receipt.status === 1 ? '✅ Success' : '❌ Failed');
      console.log('Gas Used:', receipt.gasUsed.toString());
      
      // Check if it went to vault
      if (event.args.to.toLowerCase() === VAULT_ADDRESS.toLowerCase()) {
        console.log('🎯 THIS WAS A VAULT DEPOSIT!');
      }
    }

    if (events.length === 0) {
      console.log('❌ No USDC transfers found in last 1000 blocks');
      console.log('   Either:');
      console.log('   1. The deposit transaction was more than 1000 blocks ago');
      console.log('   2. The deposit transaction failed (check MetaMask history)');
      console.log('   3. The USDC was sent to a different address');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTransactions();
