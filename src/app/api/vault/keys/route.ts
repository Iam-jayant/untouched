/**
 * POST /api/vault/keys - Create a new API key
 * GET /api/vault/keys - List all API keys for the vault
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAPIKey, listAPIKeys, getVaultIdForKey } from '@/lib/agent-store';

export async function POST(req: NextRequest) {
  try {
    const { vaultId, label } = await req.json();

    if (!vaultId || !label) {
      return NextResponse.json(
        { error: 'Missing vaultId or label' },
        { status: 400 }
      );
    }

    const keyMetadata = await createAPIKey({
      userId: vaultId,
      name: label,
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      key: keyMetadata,
    });
  } catch (error) {
    console.error('[API] /vault/keys POST error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.nextUrl.searchParams.get('apiKey');

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing apiKey' }, { status: 400 });
    }

    // Resolve vault ID from the API key
    let vaultId = getVaultIdForKey(apiKey) || apiKey;

    let keys = listAPIKeys(vaultId);
    if (keys.length === 0) {
      const { syncUserFromSupabase } = await import('@/lib/agent-store');
      const { isSupabaseConfigured } = await import('@/lib/supabase');
      if (isSupabaseConfigured()) {
        await syncUserFromSupabase(apiKey);
        vaultId = getVaultIdForKey(apiKey) || apiKey;
        keys = listAPIKeys(vaultId);
      }
    }

    // Always include the primary vault key in the list
    const allKeys = [
      {
        key: vaultId,
        label: 'Primary Vault Key',
        createdAt: 0,
        vaultId,
      },
      ...keys,
    ];

    return NextResponse.json({
      success: true,
      keys: allKeys,
    });
  } catch (error) {
    console.error('[API] /vault/keys GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
