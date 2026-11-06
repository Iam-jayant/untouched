'use client';

import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { defineChain } from 'viem';
import type { ReactNode } from 'react';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' } },
});

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

const metadata = {
  name: 'Untouched',
  description: 'Stake USDC on Arc. Principal stays put. Yield pays for inference.',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  icons: ['https://avatars.githubusercontent.com/u/37784886'],
};

export const wagmiConfig = defaultWagmiConfig({
  chains: [arcTestnet],
  projectId,
  metadata,
  enableEIP6963: true,
  enableInjected: true,
  enableWalletConnect: true,
  auth: { email: false, socials: [], showWallets: true },
});

let modalReady = false;

export function initWeb3Modal() {
  if (modalReady || !projectId) return;
  createWeb3Modal({
    wagmiConfig,
    projectId,
    themeMode: 'dark',
    enableAnalytics: false,
    featuredWalletIds: [
      'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
      '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
      'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa',
    ],
  });
  modalReady = true;
}

const queryClient = new QueryClient();

export function Web3ModalProvider({ children }: { children: ReactNode }) {
  initWeb3Modal();
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
