import { NextRequest, NextResponse } from 'next/server';
import { getUser, updateUserSettings } from '@/lib/agent-store';

/**
 * POST /api/vault/settings
 * Update user settings (e.g., maxPerCallUsdc)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, maxPerCallUsdc } = body;

    if (!apiKey || typeof maxPerCallUsdc !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: apiKey, maxPerCallUsdc' },
        { status: 400 }
      );
    }

    // Validate spend limit range ($0.001 to $0.025)
    const minLimit = 1000; // $0.001 in USDC micro-units
    const maxLimit = 25000; // $0.025 in USDC micro-units
    
    if (maxPerCallUsdc < minLimit || maxPerCallUsdc > maxLimit) {
      return NextResponse.json(
        { error: `maxPerCallUsdc must be between $0.001 and $0.025 (${minLimit} to ${maxLimit} micro-units)` },
        { status: 400 }
      );
    }

    // Get user from API key
    const user = getUser(apiKey);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Update settings
    const updated = updateUserSettings(apiKey, { maxPerCallUsdc });
    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      maxPerCallUsdc: updated.maxPerCallUsdc ?? 5000,
      maxPerCallUsd: (updated.maxPerCallUsdc ?? 5000) / 1_000000,
    });
  } catch (error) {
    console.error('[/api/vault/settings] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
