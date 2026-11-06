'use client';

/**
 * Step-Up Authentication Modal
 * Shows when a prompt exceeds maxPerCallUsdc ($0.005 default)
 * Two buttons:
 * 1. 🚫 Block Request (Crimson denied path)
 * 2. 🌐 Approve with World ID Agent Pass (Green approved path)
 */

import { useState } from 'react';
import { IDKitWidget, ISuccessResult, VerificationLevel } from '@worldcoin/idkit';
import type { PendingApproval } from '@/lib/types';

export interface StepUpModalProps {
  approval: PendingApproval;
  apiKey: string;
  onBlock: () => void;
  onApprove: (proof: ISuccessResult) => void;
  onClose: () => void;
  appId: string;
  action: string;
}

export function StepUpModal({
  approval,
  apiKey,
  onBlock,
  onApprove,
  onClose,
  appId,
  action,
}: StepUpModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBlock = async () => {
    setIsSubmitting(true);
    try {
      await fetch('/api/world/step-up-decision', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvalId: approval.id,
          action: 'deny',
        }),
      });
      onBlock();
      onClose();
    } catch (error) {
      console.error('[StepUpModal] Block error:', error);
      setIsSubmitting(false);
    }
  };

  const handleApproveWithProof = async (proof: ISuccessResult) => {
    setIsSubmitting(true);
    try {
      await fetch('/api/world/step-up-decision', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvalId: approval.id,
          action: 'approve',
          proof: {
            merkle_root: proof.merkle_root,
            nullifier_hash: proof.nullifier_hash,
            proof: proof.proof,
            verification_level: proof.verification_level,
          },
        }),
      });
      onApprove(proof);
      onClose();
    } catch (error) {
      console.error('[StepUpModal] Approve error:', error);
      setIsSubmitting(false);
    }
  };

  const costDisplay = (approval.estimatedCostUSDC / 1_000000).toFixed(3);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#12141D] border border-[#1E2230] rounded-2xl max-w-md w-full p-6 space-y-6 animate-slide-up">
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-2">🔐</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Step-Up Authentication Required
          </h2>
          <p className="text-gray-400 text-sm">
            This request exceeds your auto-approve limit
          </p>
        </div>

        {/* Request Details */}
        <div className="bg-[#090A0F] rounded-lg p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Model</span>
            <span className="text-white font-mono text-sm">{approval.model}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Estimated Cost</span>
            <span className="text-amber-400 font-mono font-semibold">
              ${costDisplay}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm">Impact on Savings</span>
            <span className="text-emerald-400 font-mono font-semibold">
              $0.00
            </span>
          </div>
        </div>

        {/* Prompt Preview */}
        {approval.promptPreview && (
          <div className="bg-[#090A0F] rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">Prompt Preview:</p>
            <p className="text-gray-300 text-sm line-clamp-2">
              {approval.promptPreview}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Approve with World ID Agent Pass */}
          <IDKitWidget
            app_id={appId}
            action={action}
            signal={approval.id}
            onSuccess={handleApproveWithProof}
            verification_level={VerificationLevel.Orb}
          >
            {({ open }: { open: () => void }) => (
              <button
                onClick={open}
                disabled={isSubmitting}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg transition-all"
              >
                🌐 Approve with World ID Agent Pass
              </button>
            )}
          </IDKitWidget>

          {/* Block Request (Demo Denied Path) */}
          <button
            onClick={handleBlock}
            disabled={isSubmitting}
            className="w-full py-4 px-6 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-red-400 border border-red-500/30 font-semibold rounded-xl transition-all"
          >
            🚫 Block Request (Demo Denied Path)
          </button>

          {/* Cancel */}
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
