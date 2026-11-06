/**
 * POST /api/world/step-up-decision
 * Process step-up authentication decision (World ID Agent Pass)
 * 
 * ⚠️ G1 + G3: This route resolves the Promise-based HTTP hold
 * - Reads globalThis.__untouchedStore (G1) to find pendingApproval
 * - Calls pendingApproval.resolver() which unblocks /api/v1/chat/completions (G3)
 * 
 * Two paths (both mandatory for World bounty):
 * - Path 1 (BLOCKED): action="deny" → HTTP 403, $0.00 spent, Crimson receipt
 * - Path 2 (APPROVED): action="approve" + proof → HTTP 200, $0.020 spent, Green receipt
 */

import { NextRequest, NextResponse } from 'next/server';
import type { StepUpDecision } from '@/lib/types';
import { 
  getUser, 
  removePendingApproval, 
  getPendingApprovals, 
  addReceipt, 
  updateUserBalance,
  updateApprovalStatusInSupabase 
} from '@/lib/agent-store';
import { broadcastStepUpApproved, broadcastStepUpDenied, broadcastReceipt, broadcastBalanceUpdate } from '@/lib/sse';
import { verifyAgentPassProof, type WorldIDProof } from '@/lib/world-id';

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }

    const body: StepUpDecision = await req.json();

    if (!body.approvalId || !body.action) {
      return NextResponse.json(
        { error: 'Missing required fields: approvalId, action' },
        { status: 400 }
      );
    }

    const user = getUser(apiKey);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ⮕ G1: Read from globalThis.__untouchedStore
    const approvals = getPendingApprovals(apiKey);
    const approval = approvals.find((a) => a.id === body.approvalId);
    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    // ============================================================================
    // Path 1: BLOCKED (Mandatory Denied Path for World Bounty)
    // ============================================================================
    
    if (body.action === 'deny') {
      // ⮕ G3: Resolve the Promise FIRST (unblocks /api/v1/chat/completions immediately)
      if (approval.resolver) {
        approval.resolver('blocked');
      }

      // Update Supabase status for cross-lambda sync
      await updateApprovalStatusInSupabase(body.approvalId, 'blocked');

      // Log Crimson Red BLOCKED receipt
      const blockedReceipt = {
        id: `receipt_blocked_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        model: approval.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUSDC: 0, // $0.00 spent
        provider: 'blocked' as const,
        free: false,
      };

      addReceipt(apiKey, blockedReceipt);
      removePendingApproval(apiKey, body.approvalId);

      // Broadcast SSE events
      broadcastStepUpDenied(apiKey, body.approvalId);
      broadcastReceipt(apiKey, blockedReceipt);

      return NextResponse.json({
        success: true,
        action: 'blocked',
        approvalId: body.approvalId,
        message: 'Request blocked by Untouched Spend Policy & World ID Agent Pass',
        costUSDC: 0,
      });
    }

    // ============================================================================
    // Path 2: APPROVED (with World ID Agent Pass proof)
    // ============================================================================
    
    if (body.action === 'approve') {
      // Verify World ID Agent Pass proof
      if (body.proof) {
        const verifyResult = await verifyAgentPassProof(body.proof as WorldIDProof);

        if (!verifyResult.success) {
          return NextResponse.json(
            {
              success: false,
              error: 'World ID Agent Pass verification failed',
              code: verifyResult.code,
              detail: verifyResult.detail,
            },
            { status: 403 }
          );
        }

        console.log('[World] Agent Pass verification successful:', {
          nullifier_hash: verifyResult.nullifier_hash,
          verification_level: body.proof.verification_level,
        });
      }

      // ⮕ G3: Resolve the Promise FIRST (unblocks /api/v1/chat/completions immediately)
      // Let /api/v1/chat/completions handle deduction and receipt logging
      if (approval.resolver) {
        approval.resolver('approved');
      }

      // Update Supabase status for cross-lambda sync
      await updateApprovalStatusInSupabase(body.approvalId, 'approved');

      removePendingApproval(apiKey, body.approvalId);

      // Broadcast SSE event (receipt will be broadcast by /api/v1/chat/completions)
      broadcastStepUpApproved(apiKey, body.approvalId);

      return NextResponse.json({
        success: true,
        action: 'approved',
        approvalId: body.approvalId,
        message: 'Step-up authentication approved via World ID Agent Pass',
      });
    }

    // Invalid action
    return NextResponse.json(
      { error: 'Invalid action. Must be "approve" or "deny"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] /world/step-up-decision error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
