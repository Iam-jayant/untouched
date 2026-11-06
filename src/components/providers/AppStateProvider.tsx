'use client';

/**
 * App State Provider
 * Connects to SSE (/api/events) and syncs state across PC and Mobile
 */

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { UserState, Receipt, PendingApproval, SSEEvent } from '@/lib/types';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount, useDisconnect, useReconnect } from 'wagmi';
import { getAccount } from '@wagmi/core';
import { wagmiConfig } from '@/components/providers/Web3ModalProvider';

interface AppState {
  userState: UserState | null;
  receipts: Receipt[];
  pendingApproval: PendingApproval | null;
  connected: boolean;
  apiKey: string;
  walletAddress: string | null;
  walletStatus: 'disconnected' | 'reconnecting' | 'connected';
  setApiKey: (key: string) => void;
  connectWallet: () => Promise<void>;
  connectDemoWallet: () => void;
  disconnectWallet: () => void;
  refreshStatus: () => Promise<void>;
  updateUserState: (newState: Partial<UserState>) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState('');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userState, setUserState] = useState<UserState | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [connected, setConnected] = useState(false);
  const { open } = useWeb3Modal();
  const { address: connectedAddress, status: accountStatus } = useAccount();
  const { reconnect } = useReconnect();
  const { disconnectAsync } = useDisconnect();
  const accountStatusRef = useRef(accountStatus);
  accountStatusRef.current = accountStatus;

  // MetaMask announces after the first paint. Wagmi's first reconnect in dev
  // often runs before that and then does not try again, so a refresh looks disconnected.
  useEffect(() => {
    let stopped = false;
    const restore = () => {
      if (stopped || accountStatusRef.current === 'connected') return;
      void reconnect();
    };
    restore();
    window.addEventListener('eip6963:announceProvider', restore);
    window.addEventListener('ethereum#initialized', restore);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const retry = window.setTimeout(restore, 600);
    return () => {
      stopped = true;
      window.removeEventListener('eip6963:announceProvider', restore);
      window.removeEventListener('ethereum#initialized', restore);
      window.clearTimeout(retry);
    };
  }, [reconnect]);

  // Load wallet, API key, and cached state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedApiKey = localStorage.getItem('untouched_api_key');
      const cachedState = localStorage.getItem('untouched_cached_state');
      
      if (savedApiKey) setApiKeyState(savedApiKey);
      if (cachedState) {
        try {
          const parsed = JSON.parse(cachedState);
          if (parsed && typeof parsed === 'object') {
            setUserState((current) => {
              if (current && (current.principal || 0) > (parsed.principal || 0)) return current;
              return parsed;
            });
          }
        } catch {}
      }
      const cachedReceipts = localStorage.getItem('untouched_receipts');
      if (cachedReceipts) {
        try {
          const parsed = JSON.parse(cachedReceipts);
          if (Array.isArray(parsed)) setReceipts(parsed);
        } catch {}
      }
    }
  }, []);

  const authorizeWallet = async (address: string) => {
    const walletAddr = address.toLowerCase();
    const res = await fetch('/api/vault/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletAddr,
        displayName: `User ${walletAddr.slice(0, 6)}`,
      }),
    });
    if (!res.ok) throw new Error('Failed to authenticate wallet');
    const data = await res.json();
    localStorage.setItem('untouched_wallet', walletAddr);
    if (data.activeApiKey) {
      localStorage.setItem('untouched_api_key', data.activeApiKey);
      setApiKeyState(data.activeApiKey);
    }
    if (data.user) {
      setUserState((current) => {
        const incoming = data.user;
        const keepBalances = current && (current.principal || 0) > (incoming.principal || 0);
        const next = keepBalances
          ? {
              ...incoming,
              principal: current.principal,
              battery: current.battery,
              remaining: current.remaining,
              advance: current.advance,
              apiKey: data.activeApiKey || current.apiKey,
            }
          : incoming;
        localStorage.setItem('untouched_cached_state', JSON.stringify(next));
        return next;
      });
    }
    setConnected(true);
  };

  useEffect(() => {
    if (!connectedAddress) return;
    setWalletAddress(connectedAddress.toLowerCase());
    authorizeWallet(connectedAddress).catch((error) => {
      console.error('[Wallet] Auth failed:', error);
    });
  }, [connectedAddress]);

  const connectWallet = async () => {
    await open({ view: 'Connect' });
  };

  // Connect demo vault (deprecated - wallet required now)
  const connectDemoWallet = () => {
    alert('Demo mode removed. Please connect your wallet to create a vault.');
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    disconnectAsync().catch(() => undefined);
    setConnected(false);
    setWalletAddress(null);
    setApiKeyState('');
    setUserState(null);
    setReceipts([]);
    localStorage.removeItem('untouched_wallet');
    localStorage.removeItem('untouched_api_key');
    localStorage.removeItem('untouched_cached_state');
    localStorage.removeItem('untouched_receipts');
  };

  // Set API key (for switching between keys)
  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem('untouched_api_key', key);
  };

  const updateUserState = (newState: Partial<UserState>) => {
    setUserState((prev) => {
      const base: UserState = prev || {
        apiKey: apiKey || walletAddress || '',
        walletAddress: walletAddress || undefined,
        principal: 0,
        advance: 0,
        battery: 0,
        remaining: 0,
        agentSigner: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
        depositTimestamp: Date.now(),
        lastActivity: Date.now(),
        maxPerCallUsdc: 5000,
        displayName: walletAddress ? `User ${walletAddress.slice(0, 6)}` : 'User',
      };
      const updated = { ...base, ...newState };
      if (typeof window !== 'undefined') {
        localStorage.setItem('untouched_cached_state', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const refreshStatus = async () => {
    if (!apiKey && !walletAddress) return;

    try {
      const queryParam = apiKey ? `apiKey=${encodeURIComponent(apiKey)}` : `wallet=${encodeURIComponent(walletAddress || '')}`;
      const walletParam = walletAddress ? `&wallet=${encodeURIComponent(walletAddress)}` : '';
      const res = await fetch(`/api/vault/status?${queryParam}${walletParam}`);

      if (res.ok) {
        const data = await res.json();
        if (data.userState) {
          setUserState((current) => {
            const incoming = data.userState;
            const keepBalances = current && (current.principal || 0) > (incoming.principal || 0);
            const next = keepBalances
              ? {
                  ...incoming,
                  principal: current.principal,
                  battery: current.battery,
                  remaining: current.remaining,
                  advance: current.advance,
                }
              : incoming;
            if (typeof window !== 'undefined') {
              localStorage.setItem('untouched_cached_state', JSON.stringify(next));
            }
            return next;
          });
          setReceipts((current) => {
            const incoming = data.receipts || [];
            const next = incoming.length === 0 && current.length > 0 ? current : incoming;
            if (typeof window !== 'undefined') {
              localStorage.setItem('untouched_receipts', JSON.stringify(next));
            }
            return next;
          });
          if (data.pendingApprovals?.length > 0) {
            setPendingApproval(data.pendingApprovals[0]);
          }
          setConnected(true);
          return;
        }
      }
    } catch (err) {
      console.warn('[AppState] refreshStatus error:', err);
    }
  };

  // Fetch initial user state
  useEffect(() => {
    if (!apiKey && !walletAddress) return;

    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (!pathname.startsWith('/dashboard') && !pathname.startsWith('/playground') && !pathname.startsWith('/mobile')) {
        return;
      }
    }

    refreshStatus();
    const pollInterval = setInterval(refreshStatus, 5000);
    return () => clearInterval(pollInterval);
  }, [apiKey, walletAddress]);

  // Connect to SSE
  useEffect(() => {
    const sseKey = apiKey || walletAddress;
    if (!sseKey) return;

    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (!pathname.startsWith('/dashboard') && !pathname.startsWith('/playground') && !pathname.startsWith('/mobile')) {
        return;
      }
    }

    const eventSource = new EventSource(`/api/events?apiKey=${encodeURIComponent(sseKey)}`);

    eventSource.onopen = () => {
      console.log('[SSE] Connected');
      setConnected(true);
    };

    eventSource.onerror = (error) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[SSE] Backend not available - this is expected during frontend development');
      } else {
        console.error('[SSE] Error:', error);
      }
      setConnected(false);
    };

    eventSource.addEventListener('heartbeat', () => {});

    eventSource.addEventListener('receipt', (e) => {
      const receipt: Receipt = JSON.parse(e.data);
      console.log('[SSE] Receipt:', receipt);
      setReceipts((prev) => {
        const next = [receipt, ...prev];
        localStorage.setItem('untouched_receipts', JSON.stringify(next));
        return next;
      });
    });

    eventSource.addEventListener('balance_update', (e) => {
      const data = JSON.parse(e.data);
      console.log('[SSE] Balance update:', data);
      setUserState((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          remaining: data.remaining !== undefined ? data.remaining : prev.remaining,
          principal: data.principal !== undefined ? data.principal : prev.principal,
          battery: data.battery !== undefined ? data.battery : prev.battery,
          advance: data.advance !== undefined ? data.advance : prev.advance,
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem('untouched_cached_state', JSON.stringify(updated));
        }
        return updated;
      });
    });

    eventSource.addEventListener('deposit_confirmed', (e) => {
      const data = JSON.parse(e.data);
      console.log('[SSE] Deposit confirmed event received:', data);
      setUserState((prev) => {
        const base: UserState = prev || {
          apiKey: apiKey || walletAddress || '',
          walletAddress: walletAddress || undefined,
          principal: 0,
          advance: 0,
          battery: 0,
          remaining: 0,
          agentSigner: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
          depositTimestamp: Date.now(),
          lastActivity: Date.now(),
          maxPerCallUsdc: 5000,
          displayName: walletAddress ? `User ${walletAddress.slice(0, 6)}` : 'User',
        };
        const updated = {
          ...base,
          principal: data.principal !== undefined ? data.principal : base.principal,
          battery: data.battery !== undefined ? data.battery : base.battery,
          remaining: data.remaining !== undefined ? data.remaining : base.remaining,
          advance: data.advance !== undefined ? data.advance : base.advance,
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem('untouched_cached_state', JSON.stringify(updated));
        }
        return updated;
      });
    });

    eventSource.addEventListener('pending_approval', (e) => {
      const approval: PendingApproval = JSON.parse(e.data);
      console.log('[SSE] Pending approval:', approval);
      setPendingApproval(approval);
    });

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [apiKey, walletAddress]);

  return (
    <AppStateContext.Provider
      value={{
        userState,
        receipts,
        pendingApproval,
        connected,
        apiKey,
        walletAddress,
        walletStatus: connectedAddress
          ? 'connected'
          : accountStatus === 'reconnecting' || accountStatus === 'connecting'
            ? 'reconnecting'
            : 'disconnected',
        setApiKey,
        connectWallet,
        connectDemoWallet,
        disconnectWallet,
        refreshStatus,
        updateUserState,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}
