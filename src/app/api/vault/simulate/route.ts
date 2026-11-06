/**
 * POST /api/vault/simulate
 * Two modes:
 * 1. Preview deposit calculation (amountUSDC provided)
 * 2. Fast-forward 14 days (apiKey provided via auth header)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SimulateRequest, SimulateResponse } from '@/lib/types';
import { calculateAdvance, calculateBattery, GAS_BUFFER_USDC } from '@/lib/constants';
import { getUser } from '@/lib/agent-store';
import { broadcastBalanceUpdate } from '@/lib/sse';

export async function POST(req: NextRequest) {
  try {
    const body: SimulateRequest = await req.json();

    // Mode 1: Preview deposit calculation
    if (body.amountUSDC && body.amountUSDC > 0) {
      if (body.amountUSDC < 10) {
        return NextResponse.json(
          { error: 'Minimum deposit is $10' },
          { status: 400 }
        );
      }

      // Convert to 6-decimal USDC
      const principalUSDC = body.amountUSDC * 1_000000;

      const advance = calculateAdvance(principalUSDC);
      const battery = calculateBattery(principalUSDC);
      const total = advance + battery;

      const response: SimulateResponse = {
        principal: principalUSDC,
        advance,
        battery,
        total,
        gasFee: GAS_BUFFER_USDC,
      };

      return NextResponse.json(response);
    }

    // Mode 2: Fast-forward 14 days (Chainlink CRE reconcile simulation)
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key for fast-forward simulation' },
        { status: 401 }
      );
    }

    let user = getUser(apiKey);
    if (!user) {
      const { syncUserFromSupabase } = await import('@/lib/agent-store');
      const { isSupabaseConfigured } = await import('@/lib/supabase');
      if (isSupabaseConfigured()) {
        user = await syncUserFromSupabase(apiKey);
      }
    }
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Reset battery to full 14-day capacity
    const fullBattery = calculateBattery(user.principal);
    const previousRemaining = user.remaining;
    user.remaining = fullBattery;

    // Calculate USYC NAV increase (14-day 5% APY)
    const usycNavBefore = 1.0;
    const usycNavAfter = 1.0 + (0.05 * 14) / 365;

    // Broadcast balance update
    broadcastBalanceUpdate(apiKey, user.remaining);

    return NextResponse.json({
      success: true,
      message: '⏩ Fast-forwarded 14 days: Chainlink CRE reconciled USYC yield and repaid Credit Reserve Pool',
      principal: user.principal,
      principalUSD: user.principal / 1_000000,
      batteryBefore: previousRemaining,
      batteryAfter: user.remaining,
      batteryReplenished: user.remaining - previousRemaining,
      usycNavBefore,
      usycNavAfter,
      usycYield: usycNavAfter - usycNavBefore,
    });
  } catch (error) {
    console.error('[API] /vault/simulate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
