/**
 * POST /api/vault/policy
 * Update user's spend policy (maxPerCallUsdc threshold)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/agent-store';

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }

    const body = await req.json();
    const { maxPerCallUSDC } = body;

    if (typeof maxPerCallUSDC !== 'number' || maxPerCallUSDC < 0) {
      return NextResponse.json(
        { error: 'Invalid maxPerCallUSDC. Must be a positive number.' },
        { status: 400 }
      );
    }

    const user = getUser(apiKey);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Convert to 6-decimal USDC if needed (assume human-readable if < 1000)
    const maxPerCallUsdc = maxPerCallUSDC < 1000 ? maxPerCallUSDC * 1_000000 : maxPerCallUSDC;

    // Update user's max per-call limit
    user.maxPerCallUsdc = maxPerCallUsdc;

    return NextResponse.json({
      success: true,
      maxPerCallUsdc,
      maxPerCallUSD: maxPerCallUsdc / 1_000000,
    });
  } catch (error) {
    console.error('[API] /vault/policy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
