/**
 * POST /api/vault/withdraw
 * Principal-First Withdrawal Settlement with EIP-712 Signature Verification
 * 
 * Flow:
 * 1. Receive EIP-712 signature from frontend
 * 2. Verify signature matches withdrawer address
 * 3. Calculate usedCreditUSDC = max(0, yieldBattery - remaining)
 * 4. Calculate returnedPrincipalUSDC = max(0, principal - usedCreditUSDC)
 * 5. Update vault state to zero
 * 6. Broadcast SSE update
 * 7. Return settlement breakdown + mock tx hash
 * 
 * IMPORTANT: This endpoint REQUIRES a valid EIP-712 signature.
 * No signature = no withdrawal. This ensures every withdrawal has cryptographic proof.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser, updateUserBalance } from '@/lib/agent-store';
import { broadcastBalanceUpdate } from '@/lib/sse';
import { DEMO_DEPOSIT_USDC, calculateAdvance, calculateBattery } from '@/lib/constants';
import { ethers } from 'ethers';

// Track used nonces to prevent replay attacks
const usedNonces = new Set<string>();

/**
 * Verify EIP-712 signature for withdrawal
 */
function verifyWithdrawalSignature(
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
      WithdrawWithAuthorization: [
        { name: 'withdrawer', type: 'address' },
        { name: 'principalAmountMicroUSDC', type: 'string' },
        { name: 'yieldForfeitedMicroUSDC', type: 'string' },
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

    console.log('[Withdraw] Signature verification:', {
      expected: expectedSigner.toLowerCase(),
      recovered: recoveredAddress.toLowerCase(),
      match: recoveredAddress.toLowerCase() === expectedSigner.toLowerCase(),
    });

    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error) {
    console.error('[Withdraw] Signature verification error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey, action, signature, message, walletAddress: providedWallet } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing apiKey' },
        { status: 400 }
      );
    }

    let user = getUser(apiKey);
    if (!user && (apiKey || providedWallet)) {
      const { syncUserFromSupabase } = await import('@/lib/agent-store');
      const { isSupabaseConfigured } = await import('@/lib/supabase');
      if (isSupabaseConfigured()) {
        user = (await syncUserFromSupabase(apiKey)) || (providedWallet ? await syncUserFromSupabase(providedWallet) : undefined);
      }
    }
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Handle reset action (back to $50 demo vault) - NO signature required for reset
    if (action === 'reset') {
      const advance = calculateAdvance(DEMO_DEPOSIT_USDC);
      const battery = calculateBattery(DEMO_DEPOSIT_USDC);

      // Reset user state
      user.principal = DEMO_DEPOSIT_USDC;
      user.advance = advance;
      user.battery = battery;
      user.remaining = battery;
      user.depositTimestamp = Date.now();
      user.lastActivity = Date.now();

      // Broadcast update
      broadcastBalanceUpdate(apiKey, battery);

      return NextResponse.json({
        success: true,
        action: 'reset',
        principal: DEMO_DEPOSIT_USDC,
        battery,
        remaining: battery,
        message: 'Vault reset to $50 demo configuration',
      });
    }

    // ============================================================================
    // Principal-First Withdrawal Settlement with Signature Verification
    // ============================================================================

    // STRICT REQUIREMENT: Must have signature for withdrawal
    if (!signature || !message) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cryptographic signature required. Please sign the withdrawal with your wallet.' 
        },
        { status: 400 }
      );
    }

    // Verify the wallet address matches
    const signerAddress = providedWallet || message.withdrawer;
    if (!signerAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // CRITICAL: Verify EIP-712 signature
    const isValidSignature = verifyWithdrawalSignature(signature, message, signerAddress);
    if (!isValidSignature) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid signature. The withdrawal must be signed by your wallet.' 
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

    const principalUSDC = user.principal;
    const yieldBatteryUSDC = user.battery;
    const remainingUSDC = user.remaining;

    // Calculate how much yield advance was actually used
    const usedCreditUSDC = Math.max(0, yieldBatteryUSDC - remainingUSDC);

    // Principal-first: Return principal minus used yield advance
    const returnedPrincipalUSDC = Math.max(0, principalUSDC - usedCreditUSDC);

    // Verify signed amount matches calculated amount
    const signedAmount = parseInt(message.principalAmountMicroUSDC);
    if (signedAmount !== principalUSDC) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Amount mismatch. The signed amount does not match your vault balance.' 
        },
        { status: 400 }
      );
    }

    // Generate mock transaction hash
    const txHash = `0x${Math.random().toString(16).slice(2, 66).padEnd(64, '0')}`;

    // Update user state (set everything to 0 after withdrawal)
    user.principal = 0;
    user.remaining = 0;
    user.battery = 0;
    user.advance = 0;
    user.lastActivity = Date.now();

    // Broadcast update to all user devices
    try {
      const target = user.walletAddress || signerAddress;
      if (target) {
        const { broadcastToUser } = await import('@/lib/sse');
        broadcastToUser(target, {
          type: 'balance_update',
          data: { remaining: 0, principal: 0, battery: 0, advance: 0 },
        });
      }
      broadcastBalanceUpdate(apiKey, 0);
    } catch (sseErr) {
      console.warn('[Withdraw] SSE broadcast warning:', sseErr);
    }

    return NextResponse.json({
      success: true,
      principalUSDC,
      yieldBatteryUSDC,
      remainingUSDC,
      usedCreditUSDC,
      returnedPrincipalUSDC,
      txHash,
      signature: signature.slice(0, 20) + '...',
      verified: true,
      message: `Withdrew $${(returnedPrincipalUSDC / 1_000000).toFixed(2)} (Principal: $${(principalUSDC / 1_000000).toFixed(2)} - Used Credit: $${(usedCreditUSDC / 1_000000).toFixed(6)})`,
    });
  } catch (error) {
    console.error('[API] /vault/withdraw error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
