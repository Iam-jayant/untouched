/**
 * World ID Verification Library
 * Server-side verification for World IDKit and Agent Pass
 */

// ============================================================================
// Types
// ============================================================================

export interface WorldIDProof {
  merkle_root: string;
  nullifier_hash: string;
  proof: string;
  verification_level: 'orb' | 'device';
  credential_type?: string;
}

export interface WorldIDVerifyRequest {
  proof: WorldIDProof;
  action: string;
  signal?: string;
}

export interface WorldIDVerifyResponse {
  success: boolean;
  code?: string;
  detail?: string;
  attribute?: string;
  nullifier_hash?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const WORLD_APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID || '';
const WORLD_ACTION_IDKIT = process.env.WORLD_ACTION_IDKIT || 'verify-human-deposit';
const WORLD_ACTION_AGENT_PASS = process.env.WORLD_ACTION_AGENT_PASS || 'approve-high-spend-prompt';
const WORLD_API_BASE_URL = 'https://developer.worldcoin.org/api/v2/verify';

// Demo/simulator mode (bypasses actual World ID verification)
const DEMO_MODE = process.env.WORLD_DEMO_MODE === 'true';

// ============================================================================
// Server-Side Verification
// ============================================================================

/**
 * Verify World IDKit proof (for deposit Sybil gate)
 */
export async function verifyIDKitProof(
  proof: WorldIDProof,
  signal?: string
): Promise<WorldIDVerifyResponse> {
  if (DEMO_MODE) {
    console.log('[World ID] Demo mode: bypassing IDKit verification');
    return {
      success: true,
      nullifier_hash: proof.nullifier_hash,
    };
  }

  try {
    const response = await fetch(`${WORLD_API_BASE_URL}/${WORLD_APP_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merkle_root: proof.merkle_root,
        nullifier_hash: proof.nullifier_hash,
        proof: proof.proof,
        verification_level: proof.verification_level,
        action: WORLD_ACTION_IDKIT,
        signal: signal || '',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        code: error.code || 'VERIFICATION_FAILED',
        detail: error.detail || 'World ID verification failed',
      };
    }

    const data = await response.json();
    return {
      success: true,
      nullifier_hash: proof.nullifier_hash,
    };
  } catch (error) {
    console.error('[World ID] IDKit verification error:', error);
    return {
      success: false,
      code: 'NETWORK_ERROR',
      detail: (error as Error).message,
    };
  }
}

/**
 * Verify World ID Agent Pass proof (for step-up auth)
 */
export async function verifyAgentPassProof(
  proof: WorldIDProof,
  signal?: string
): Promise<WorldIDVerifyResponse> {
  if (DEMO_MODE) {
    console.log('[World ID] Demo mode: bypassing Agent Pass verification');
    return {
      success: true,
      nullifier_hash: proof.nullifier_hash,
    };
  }

  try {
    const response = await fetch(`${WORLD_API_BASE_URL}/${WORLD_APP_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merkle_root: proof.merkle_root,
        nullifier_hash: proof.nullifier_hash,
        proof: proof.proof,
        verification_level: proof.verification_level,
        action: WORLD_ACTION_AGENT_PASS,
        signal: signal || '',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        code: error.code || 'VERIFICATION_FAILED',
        detail: error.detail || 'World ID Agent Pass verification failed',
      };
    }

    const data = await response.json();
    return {
      success: true,
      nullifier_hash: proof.nullifier_hash,
    };
  } catch (error) {
    console.error('[World ID] Agent Pass verification error:', error);
    return {
      success: false,
      code: 'NETWORK_ERROR',
      detail: (error as Error).message,
    };
  }
}

// ============================================================================
// Demo Mode Helpers
// ============================================================================

/**
 * Create a mock World ID proof for demo/testing purposes
 */
export function createMockProof(nullifierSeed: string = 'demo'): WorldIDProof {
  const hash = `0x${Buffer.from(nullifierSeed).toString('hex').padEnd(64, '0')}`;
  
  return {
    merkle_root: `0x${'1'.repeat(64)}`,
    nullifier_hash: hash,
    proof: `0x${'0'.repeat(512)}`,
    verification_level: 'orb',
  };
}

/**
 * Check if World ID is configured
 */
export function isWorldIDConfigured(): boolean {
  return Boolean(WORLD_APP_ID && WORLD_APP_ID !== 'app_staging_xxxxxx');
}

/**
 * Get World ID configuration
 */
export function getWorldIDConfig() {
  return {
    appId: WORLD_APP_ID,
    actionIDKit: WORLD_ACTION_IDKIT,
    actionAgentPass: WORLD_ACTION_AGENT_PASS,
    demoMode: DEMO_MODE,
    configured: isWorldIDConfigured(),
  };
}
