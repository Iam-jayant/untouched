/**
 * WalletConnect session for Arc Testnet.
 * Stakes are sent as legacy transactions. Arc's RPC rejects the EIP-1559
 * payload MetaMask builds by default and reports it as an internal JSON-RPC error.
 */

import { ethers } from 'ethers';
import { getAccount } from '@wagmi/core';
import { wagmiConfig } from '@/components/providers/Web3ModalProvider';

const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_HEX = '0x4cef52';
const ARC_RPC = 'https://rpc.testnet.arc.network';

const ARC_CHAIN = {
  chainId: ARC_CHAIN_HEX,
  chainName: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: [ARC_RPC],
  blockExplorerUrls: ['https://testnet.arcscan.app'],
};

type Eip1193 = ethers.providers.ExternalProvider & {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  disconnect?: () => Promise<void>;
  connected?: boolean;
};

let walletProvider: Eip1193 | null = null;
let walletConnectProvider: Eip1193 | null = null;

function projectId(): string {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!id) throw new Error('WalletConnect project id is not configured');
  return id;
}

export function arcReadProvider(): ethers.providers.StaticJsonRpcProvider {
  return new ethers.providers.StaticJsonRpcProvider({ url: ARC_RPC, skipFetchSetup: true, timeout: 20_000 }, ARC_CHAIN_ID);
}

export interface BrowserWallet {
  id: string;
  name: string;
  icon?: string;
  provider: Eip1193;
}

export function discoverBrowserWallets(): Promise<BrowserWallet[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve([]);
      return;
    }
    const found = new Map<string, BrowserWallet>();
    const add = (provider: Eip1193, name: string, icon?: string, id?: string) => {
      const key = id || name;
      if (!provider?.request || found.has(key)) return;
      found.set(key, { id: key, name, icon, provider });
    };

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<{ info?: { uuid?: string; name?: string; icon?: string; rdns?: string }; provider?: Eip1193 }>).detail;
      if (!detail?.provider) return;
      add(detail.provider, detail.info?.name || 'Browser wallet', detail.info?.icon, detail.info?.rdns || detail.info?.uuid);
    };

    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    window.setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
      const ethereum = (window as Window & { ethereum?: Eip1193 & { providers?: Eip1193[]; isMetaMask?: boolean; isRabby?: boolean } }).ethereum;
      if (found.size === 0 && ethereum) {
        const list = ethereum.providers?.length ? ethereum.providers : [ethereum];
        list.forEach((provider, index) => {
          const named = provider as Eip1193 & { isMetaMask?: boolean; isRabby?: boolean; isCoinbaseWallet?: boolean };
          const name = named.isRabby ? 'Rabby' : named.isCoinbaseWallet ? 'Coinbase Wallet' : named.isMetaMask ? 'MetaMask' : `Browser wallet ${index + 1}`;
          add(provider, name, undefined, `${name}-${index}`);
        });
      }
      resolve([...found.values()]);
    }, 400);
  });
}

async function finishConnection(provider: Eip1193): Promise<{ provider: Eip1193; address: string }> {
  walletProvider = provider;
  const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
  await ensureArcChain(provider);
  const address = accounts?.[0];
  if (!address) throw new Error('The wallet did not return an account');
  return { provider, address: address.toLowerCase() };
}

export async function connectBrowserWallet(wallet: BrowserWallet): Promise<{ provider: Eip1193; address: string }> {
  return finishConnection(wallet.provider);
}

export async function connectWalletProvider(): Promise<{ provider: Eip1193; address: string }> {
  if (!walletConnectProvider) {
    const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
    walletConnectProvider = await EthereumProvider.init({
      projectId: projectId(),
      chains: [ARC_CHAIN_ID],
      rpcMap: { [ARC_CHAIN_ID]: ARC_RPC },
      showQrModal: true,
      metadata: {
        name: 'Untouched',
        description: 'Stake USDC on Arc. Principal stays put. Yield pays for inference.',
        url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        icons: ['https://avatars.githubusercontent.com/u/37784886'],
      },
      methods: [
        'eth_sendTransaction',
        'personal_sign',
        'eth_signTypedData_v4',
        'wallet_switchEthereumChain',
        'wallet_addEthereumChain',
      ],
      events: ['chainChanged', 'accountsChanged'],
    }) as Eip1193;
  }
  if (!walletConnectProvider.connected) {
    await (walletConnectProvider as Eip1193 & { connect: () => Promise<void> }).connect();
  }
  return finishConnection(walletConnectProvider);
}

export async function disconnectWalletProvider(): Promise<void> {
  if (walletConnectProvider?.disconnect) {
    await walletConnectProvider.disconnect().catch(() => undefined);
  }
  walletConnectProvider = null;
  walletProvider = null;
}

export async function getArcSigner(): Promise<ethers.providers.JsonRpcSigner> {
  const account = getAccount(wagmiConfig);
  if (!account.connector) throw new Error('Connect a wallet first');
  const ethereum = await account.connector.getProvider() as Eip1193;
  await ensureArcChain(ethereum);
  const provider = new ethers.providers.Web3Provider(ethereum, 'any');
  return provider.getSigner();
}

async function ensureArcChain(provider: Eip1193): Promise<void> {
  const current = await provider.request({ method: 'eth_chainId' }) as string;
  if (parseInt(current, 16) === ARC_CHAIN_ID) return;
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_CHAIN_HEX }],
    });
  } catch (error: any) {
    if (error?.code === 4902 || String(error?.message || '').toLowerCase().includes('unrecognized')) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [ARC_CHAIN],
      });
    } else {
      throw error;
    }
  }
}

export function explainWalletError(error: unknown): string {
  const err = error as { reason?: string; message?: string; error?: { message?: string }; data?: { message?: string } };
  const message = err?.reason || err?.error?.message || err?.data?.message || err?.message || 'Wallet request failed';
  if (message.toLowerCase().includes('internal json-rpc')) {
    return 'Arc rejected the stake request. Use a wallet that holds USDC on Arc Testnet, then approve the stake again.';
  }
  return message;
}
