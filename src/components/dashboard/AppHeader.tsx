'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Shield, Smartphone, Terminal, Zap } from 'lucide-react';
import type { UserState } from '@/lib/types';

interface AppHeaderProps {
  active: 'dashboard' | 'playground';
  walletAddress: string | null;
  walletStatus: 'disconnected' | 'reconnecting' | 'connected';
  connected: boolean;
  userState: UserState | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onPair: () => void;
}

export function AppHeader({
  active,
  walletAddress,
  walletStatus,
  connected,
  userState,
  onConnect,
  onDisconnect,
  onPair,
}: AppHeaderProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const address = mounted ? walletAddress : null;
  const reconnecting = mounted && walletStatus === 'reconnecting';
  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-20">
          <Link href="/landing" className="flex items-center gap-3 group">
            <span className="text-2xl font-display text-white group-hover:text-white/80 transition-colors duration-300">
              UNTOUCHED
            </span>
            <span className="hidden md:flex items-center gap-2 text-xs text-white/40 font-mono uppercase tracking-wider border-l border-white/10 pl-3">
              <Terminal className="w-3 h-3" />
              {active === 'playground' ? 'Playground' : 'Developer Dashboard'}
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className={`hidden sm:inline-flex px-3 py-2 rounded text-sm border transition-colors ${
                active === 'dashboard'
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 text-white/70 border-white/15 hover:text-white hover:bg-white/10'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/playground"
              className={`hidden sm:inline-flex px-3 py-2 rounded text-sm border transition-colors ${
                active === 'playground'
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 text-white/70 border-white/15 hover:text-white hover:bg-white/10'
              }`}
            >
              Playground
            </Link>

            {!address ? (
              <button
                onClick={onConnect}
                disabled={reconnecting}
                className="flex items-center gap-2 px-5 py-2.5 whitespace-nowrap bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded font-medium text-sm transition-all duration-300 shadow-lg hover:shadow-orange-500/50 disabled:opacity-70"
              >
                <span>{reconnecting ? 'Restoring wallet…' : 'Connect Wallet'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/30 rounded">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono text-emerald-300">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </span>
                </div>
                {userState?.agentSigner && (
                  <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded">
                    <Terminal className="w-3 h-3 text-white/60" />
                    <span className="text-xs font-mono text-white/60">
                      Agent: {userState.agentSigner.slice(0, 6)}...
                    </span>
                  </div>
                )}
                <button
                  onClick={onDisconnect}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/20 text-white/70 hover:text-white rounded text-sm transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}

            <div className="hidden lg:flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded">
                <Shield className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs font-mono text-white">
                  ${((userState?.principal || 0) / 1_000000).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded">
                <Zap className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs font-mono text-white">
                  ${((userState?.remaining || 0) / 1_000000).toFixed(4)}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-xs font-mono text-white/60">{connected ? 'Live' : 'Offline'}</span>
              </div>
            </div>

            <button
              onClick={onPair}
              className="group flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-white/90 rounded font-medium text-sm transition-all duration-300 hover:gap-3 btn-shimmer"
            >
              <Smartphone className="w-4 h-4" />
              <span className="hidden md:inline">Pair Mobile</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
