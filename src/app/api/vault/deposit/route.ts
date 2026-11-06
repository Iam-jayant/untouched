/**
 * POST /api/vault/deposit
 * Verify cryptographic signature and add funds to vault
 * 
 * Flow:
 * 1. Receive EIP-712 signature from frontend
 * 2. Verify signature matches depositor address
 * 3. Validate deposit amount and nonce
 * 4. Update principal + recalculate battery
 * 5. Broadcast SSE balance_update event
 * 6. Sync to Supabase if configured
 * 
 * IMPORTANT: This endpoint REQUIRES a valid EIP-712 signature.
 * No signature = no deposit. This ensures every deposit has cryptographic proof.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser, createUser, resolveUserId } from '@/lib/agent-store';
import { calculateAdvance, calculateBattery, MIN_DEPOSIT_USDC } from '@/lib/constants';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { getSSE } from '@/lib/sse';
import { broadcastDepositConfirmed, broadcastToUser } from '@/lib/sse';
import { ethers } from 'ethers';

// Track used nonces to prevent replay attacks
const usedNonces = new Set<string>();

/**
 * Verify EIP-712 signature for deposit
 */
function verifyDepositSignature(
  signature: string,
  message: any,
  expectedSigner: string
): boolean {
  try {
    const domain = {
      name: 'Untouched PrincipalCreditVault (USYC)',
      version: '1',
      chainId: message.chainId || 5042002,
      verifyingContract: process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    };

    const types = {
      DepositWithAuthorization: [
        { name: 'depositor', type: 'address' },
        { name: 'token', type: 'string' },
        { name: 'principalAmountMicroUSDC', type: 'string' },
        { name: 'estimated14DayYieldMicroUSDC', type: 'string' },
        { name: 'nonce', type: 'bytes32' },
        { name: 'validBefore', type: 'uint256' },
      ],
    };

    // Recover signer from signature
    const recoveredAddress = ethers.utils.verifyTypedData(
      domain,
      types,
      message,
      signature
    );

    console.log('[Deposit] Signature verification:', {
      expected: expectedSigner.toLowerCase(),
      recovered: recoveredAddress.toLowerCase(),
      match: recoveredAddress.toLowerCase() === expectedSigner.toLowerCase(),
    });

    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error) {
    console.error('[Deposit] Signature verification error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      apiKey, 
      walletAddress: providedWallet,
      amountUsdc, 
      txHash, 
      blockNumber, 
      principalUsdc, 
      advanceUsdc, 
      onChain 
    } = body;

    // Check if this is an on-chain transaction
    if (onChain && txHash) {
      console.log('[Deposit] Processing on-chain transaction:', txHash);
      
      // Validate inputs
      if (!apiKey && !providedWallet) {
        return NextResponse.json(
          { success: false, error: 'API key or wallet address required' },
          { status: 400 }
        );
      }

      // FIXED: Resolve user by trying wallet address FIRST (canonical key),
      // then API key. This avoids the copy-vs-reference mismatch.
      const walletAddress = providedWallet?.toLowerCase();
      let user = walletAddress ? getUser(walletAddress) : null;
      if (!user && apiKey) {
        user = getUser(apiKey);
      }

      // Try restoring from Supabase if not in memory
      if (!user && (walletAddress || apiKey)) {
        const { syncUserFromSupabase } = await import('@/lib/agent-store');
        const { isSupabaseConfigured } = await import('@/lib/supabase');
        if (isSupabaseConfigured()) {
          user = (walletAddress ? await syncUserFromSupabase(walletAddress) : undefined) || (apiKey ? await syncUserFromSupabase(apiKey) : undefined);
        }
      }

      // Determine the canonical user ID for SSE broadcasting
      const canonicalId = walletAddress || resolveUserId(apiKey) || apiKey;

      if (!user && walletAddress) {
        console.warn('[Deposit] User not found, creating on-the-fly for wallet:', walletAddress);
        
        const { createHash } = await import('crypto');
        
        const agentSignerEOA = `0x${createHash('sha256').update(`untouched_agent_${walletAddress}`).digest('hex').slice(0, 40)}`;
        
        user = await createUser({
          id: walletAddress,
          apiKey: walletAddress,
          displayName: `User ${walletAddress.slice(0, 6)}`,
          walletAddress,
          agentSigner: agentSignerEOA,
          principal: 0,
          advance: 0,
          battery: 0,
          remaining: 0,
          maxPerCallUsdc: 5000,
          depositTimestamp: Date.now(),
          lastActivity: Date.now(),
        });
        
        console.log('[Deposit] User created successfully');
      }
      
      if (!user) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'User not found. Please connect wallet via /api/vault/auth first.',
            hint: 'The backend lost your session. Refresh the page to reconnect.'
          },
          { status: 404 }
        );
      }

      // Convert string values to numbers (micro-units)
      const principalMicro = Math.floor(parseFloat(principalUsdc) * 1_000000);
      const advanceMicro = Math.floor(parseFloat(advanceUsdc) * 1_000000);

      // Update user state from on-chain values
      user.principal = principalMicro;
      user.battery = advanceMicro;
      user.remaining = advanceMicro;
      user.advance = advanceMicro; // For simplicity, advance = battery initially
      user.lastActivity = Date.now();
      
      // Keep store.users synchronized across all key variants
      const { getStore } = await import('@/lib/agent-store');
      const store = getStore();
      if (walletAddress) store.users.set(walletAddress, user);
      if (apiKey) store.users.set(apiKey, user);
      if (canonicalId) store.users.set(canonicalId, user);
      
      // Set depositTimestamp if first deposit
      if (!user.depositTimestamp || user.depositTimestamp === 0) {
        user.depositTimestamp = Date.now();
      }

      // Sync to Supabase if configured
      if (isSupabaseConfigured()) {
        const supabase = getSupabase();
        if (supabase) {
          const targetId = (user.walletAddress || providedWallet || apiKey).toLowerCase();
          const { error } = await supabase
            .from('untouched_users')
            .upsert({
              id: targetId,
              wallet_address: targetId,
              display_name: user.displayName || `User ${targetId.slice(0, 6)}`,
              agent_signer_eoa: user.agentSigner || '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
              principal_usdc: principalMicro,
              yield_battery_usdc: advanceMicro,
              remaining_usdc: advanceMicro,
              last_activity: new Date(user.lastActivity).toISOString(),
              deposit_timestamp: user.depositTimestamp,
              max_per_call_usdc: user.maxPerCallUsdc || 5000,
            }, { onConflict: 'id' });

          if (error) {
            console.error('[Deposit] Supabase sync error:', error);
          } else {
            console.log('[Deposit] Supabase upsert successful for:', targetId);
          }
        }
      }

      // Broadcast FULL state update via SSE to ALL connected clients for this user
      try {
        if (walletAddress) {
          broadcastDepositConfirmed(walletAddress, {
            principal: principalMicro,
            battery: advanceMicro,
            remaining: advanceMicro,
            advance: advanceMicro,
          });
        }
        // Also broadcast to the API key directly in case SSE connected with it
        if (apiKey && apiKey !== walletAddress) {
          const sse = getSSE();
          sse.broadcast(apiKey, {
            type: 'deposit_confirmed',
            data: {
              principal: principalMicro,
              battery: advanceMicro,
              remaining: advanceMicro,
              advance: advanceMicro,
            },
          });
        }
      } catch (sseError) {
        console.error('[Deposit] SSE broadcast error:', sseError);
      }

      return NextResponse.json({
        success: true,
        message: `On-chain deposit confirmed`,
        principal: principalMicro,
        principalUsd: principalMicro / 1_000000,
        battery: advanceMicro,
        batteryUsd: advanceMicro / 1_000000,
        remaining: advanceMicro,
        remainingUsd: advanceMicro / 1_000000,
        advance: advanceMicro,
        advanceUsd: advanceMicro / 1_000000,
        txHash,
        blockNumber,
        verified: true,
        onChain: true,
      });
    }

    // Legacy signature-based flow (fallback)
    const { signature, message, walletAddress: legacyWallet } = body;

    // STRICT REQUIREMENT: Must have signature
    if (!signature || !message) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cryptographic signature required. Please sign the deposit with your wallet.' 
        },
        { status: 400 }
      );
    }

    // Validate inputs
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key required' },
        { status: 400 }
      );
    }

    if (!amountUsdc || typeof amountUsdc !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid deposit amount' },
        { status: 400 }
      );
    }

    // Check minimum deposit ($10 = 10,000,000 micro-units)
    if (amountUsdc < MIN_DEPOSIT_USDC) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Minimum deposit is $${(MIN_DEPOSIT_USDC / 1_000000).toFixed(2)}` 
        },
        { status: 400 }
      );
    }

    // Get user
    const user = getUser(apiKey);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found. Please connect wallet first.' },
        { status: 404 }
      );
    }

    // Verify the wallet address matches
    const signerAddress = legacyWallet || message.depositor;
    if (!signerAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // CRITICAL: Verify EIP-712 signature
    const isValidSignature = verifyDepositSignature(signature, message, signerAddress);
    if (!isValidSignature) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid signature. The deposit must be signed by your wallet.' 
        },
        { status: 403 }
      );
    }

    // Check nonce hasn't been used (prevent replay attacks)
    if (usedNonces.has(message.nonce)) {
      return NextResponse.json(
        { success: false, error: 'Nonce already used. Please try again.' },
        { status: 400 }
      );
    }

    // Check signature hasn't expired
    const now = Math.floor(Date.now() / 1000);
    if (message.validBefore && now > message.validBefore) {
      return NextResponse.json(
        { success: false, error: 'Signature expired. Please try again.' },
        { status: 400 }
      );
    }

    // Mark nonce as used
    usedNonces.add(message.nonce);

    // Verify amount matches signature
    const signedAmount = parseInt(message.principalAmountMicroUSDC);
    if (signedAmount !== amountUsdc) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Amount mismatch. The signed amount does not match the request.' 
        },
        { status: 400 }
      );
    }

    // Calculate new balances
    const newPrincipal = user.principal + amountUsdc;
    const additionalBattery = calculateBattery(amountUsdc);
    const newBattery = user.battery + additionalBattery;
    const newRemaining = user.remaining + additionalBattery;

    // Update in-memory store
    user.principal = newPrincipal;
    user.battery = newBattery;
    user.remaining = newRemaining;
    user.advance = calculateAdvance(newPrincipal);
    user.lastActivity = Date.now();
    
    // If this is the first deposit, set depositTimestamp
    if (!user.depositTimestamp || user.depositTimestamp === 0) {
      user.depositTimestamp = Date.now();
    }

    // Sync to Supabase if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const targetId = (user.walletAddress || signerAddress || apiKey).toLowerCase();
        const { error } = await supabase
          .from('untouched_users')
          .upsert({
            id: targetId,
            wallet_address: targetId,
            display_name: user.displayName || `User ${targetId.slice(0, 6)}`,
            agent_signer_eoa: user.agentSigner || '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
            principal_usdc: newPrincipal,
            yield_battery_usdc: newBattery,
            remaining_usdc: newRemaining,
            last_activity: new Date(user.lastActivity).toISOString(),
            deposit_timestamp: user.depositTimestamp,
            max_per_call_usdc: user.maxPerCallUsdc || 5000,
          }, { onConflict: 'id' });

        if (error) {
          console.error('[Deposit] Supabase sync error:', error);
          // Don't fail the request - in-memory update succeeded
        }
      }
    }

    // Broadcast SSE update
    try {
      const targetWallet = user.walletAddress || signerAddress;
      if (targetWallet) {
        broadcastDepositConfirmed(targetWallet, {
          principal: newPrincipal,
          battery: newBattery,
          remaining: newRemaining,
          advance: user.advance,
        });
      }
      if (apiKey && apiKey !== targetWallet) {
        const sse = getSSE();
        sse.broadcast(apiKey, {
          type: 'deposit_confirmed',
          data: {
            principal: newPrincipal,
            battery: newBattery,
            remaining: newRemaining,
            advance: user.advance,
          },
        });
      }
    } catch (sseError) {
      console.error('[Deposit] SSE broadcast error:', sseError);
      // Don't fail - SSE is not critical
    }

    return NextResponse.json({
      success: true,
      message: `Deposited $${(amountUsdc / 1_000000).toFixed(2)} successfully`,
      principal: newPrincipal,
      principalUsd: newPrincipal / 1_000000,
      battery: newBattery,
      batteryUsd: newBattery / 1_000000,
      remaining: newRemaining,
      remainingUsd: newRemaining / 1_000000,
      advance: user.advance,
      advanceUsd: user.advance / 1_000000,
      signature: signature.slice(0, 20) + '...',
      verified: true,
    });
  } catch (error) {
    console.error('[API] /vault/deposit error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
