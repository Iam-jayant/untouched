'use client';

/**
 * World IDKit Button Component
 * Wraps @worldcoin/idkit for deposit verification (Sybil gate)
 */

import { IDKitWidget, ISuccessResult, VerificationLevel } from '@worldcoin/idkit';

export interface WorldIDKitButtonProps {
  onSuccess: (proof: ISuccessResult) => void;
  onError?: (error: Error) => void;
  appId: string;
  action: string;
  signal?: string;
  verificationLevel?: VerificationLevel;
  children?: React.ReactNode;
}

export function WorldIDKitButton({
  onSuccess,
  onError,
  appId,
  action,
  signal = '',
  verificationLevel = VerificationLevel.Orb,
  children,
}: WorldIDKitButtonProps) {
  const handleVerify = async (proof: ISuccessResult) => {
    try {
      onSuccess(proof);
    } catch (error) {
      console.error('[WorldIDKit] Verification error:', error);
      onError?.(error as Error);
    }
  };

  return (
    <IDKitWidget
      app_id={appId}
      action={action}
      signal={signal}
      onSuccess={handleVerify}
      onError={(error: { message: string }) => {
        console.error('[WorldIDKit] Widget error:', error);
        onError?.(new Error(error.message));
      }}
      verification_level={verificationLevel}
    >
      {({ open }: { open: () => void }) => (
        <button
          onClick={open}
          className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-lg transition-all"
        >
          {children || '🌐 Verify with World ID'}
        </button>
      )}
    </IDKitWidget>
  );
}
