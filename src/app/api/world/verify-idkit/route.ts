/**
 * POST /api/world/verify-idkit
 * Verifies World IDKit proof for deposit Sybil gate
 * 1 human = 1 active credit line
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyIDKitProof, type WorldIDProof } from '@/lib/world-id';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const { proof, signal } = body as {
      proof: WorldIDProof;
      signal?: string;
    };

    if (!proof || !proof.merkle_root || !proof.nullifier_hash || !proof.proof) {
      return NextResponse.json(
        { error: 'Invalid World ID proof format' },
        { status: 400 }
      );
    }

    // Verify proof with World Developer Portal API
    const verifyResult = await verifyIDKitProof(proof, signal);

    if (!verifyResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'World ID verification failed',
          code: verifyResult.code,
          detail: verifyResult.detail,
        },
        { status: 403 }
      );
    }

    // Return verified status + nullifier
    return NextResponse.json({
      success: true,
      verified: true,
      nullifierHash: verifyResult.nullifier_hash,
      message: 'Human verification successful. 1 credit line active.',
    });
  } catch (error) {
    console.error('[API] /world/verify-idkit error:', error);
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
