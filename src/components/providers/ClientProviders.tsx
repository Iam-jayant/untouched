'use client';

import { AppStateProvider } from '@/components/providers/AppStateProvider';
import { initWeb3Modal, Web3ModalProvider } from '@/components/providers/Web3ModalProvider';
import type { ReactNode } from 'react';

initWeb3Modal();

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <Web3ModalProvider>
      <AppStateProvider>{children}</AppStateProvider>
    </Web3ModalProvider>
  );
}
