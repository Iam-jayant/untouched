'use client';

/**
 * Mobile Vault & Usage Companion
 * Autonomous spend policy • Live x402 receipt feed • Vault controls
 */

import { useState, useEffect } from 'react';
import { useAppState } from '@/components/providers/AppStateProvider';

export default function MobilePage() {
  const { userState, receipts, connected, apiKey, walletAddress, setApiKey, refreshStatus, updateUserState } = useAppState();
  const [maxPerCall, setMaxPerCall] = useState(0.005); // Default $0.005
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Read API key & wallet from URL query param on mount (for QR pairing)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlApiKey = params.get('apiKey');
      const urlWallet = params.get('wallet');
      
      if (urlWallet) {
        localStorage.setItem('untouched_wallet', urlWallet);
      }
      if (urlApiKey) {
        localStorage.setItem('untouched_api_key', urlApiKey);
        setApiKey(urlApiKey);
        window.history.replaceState({}, '', '/mobile');
      } else {
        const storedKey = localStorage.getItem('untouched_api_key');
        if (storedKey) {
          setApiKey(storedKey);
        }
      }
    }
  }, [setApiKey]);

  // Sync maxPerCall with userState
  useEffect(() => {
    if (userState?.maxPerCallUsdc) {
      setMaxPerCall(userState.maxPerCallUsdc / 1_000000);
    }
  }, [userState?.maxPerCallUsdc]);

  const principal = userState ? userState.principal / 1_000000 : 0;
  const advance = userState ? userState.advance / 1_000000 : 0;
  const remaining = userState ? userState.remaining / 1_000000 : 0;
  const battery = userState ? userState.battery / 1_000000 : 0;
  const usedCredit = battery - remaining; // Spent from yield battery
  const totalYield = battery; // Total yield battery capacity
  const batteryPercent = totalYield > 0 ? Math.min((remaining / totalYield) * 100, 100) : 0;

  const recentReceipts = receipts.slice(0, 20);

  // Quick stake handler with Web3 signature
  const handleQuickStake = async (amount: number) => {
    if (!apiKey) {
      alert('No API key found. Please pair from desktop first.');
      return;
    }

    try {
      const { signAndExecuteDeposit } = await import('@/lib/web3-vault');
      const result = await signAndExecuteDeposit(amount);
      const response = await fetch('/api/vault/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, walletAddress, txHash: result.txHash }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(`Deposit failed: ${data.error || 'Unknown error'}`);
        return;
      }
      if (updateUserState) {
        updateUserState({
          principal: data.principal,
          battery: data.battery,
          remaining: data.remaining,
          advance: data.advance,
        });
      }
      alert(`Staked $${amount}.\n${result.explorerUrl}`);
    } catch (err: any) {
      console.error('Deposit error:', err);
      
      if (err.message && err.message.includes('rejected')) {
        alert('❌ Deposit cancelled - you rejected the wallet signature');
      } else if (err.message && err.message.includes('wallet')) {
        alert(`❌ Wallet error: ${err.message}`);
      } else {
        alert(`❌ Deposit failed: ${err.message || 'Check console'}`);
      }
    }
  };

  // Withdraw handler with Web3 signature
  const handleWithdraw = async () => {
    if (!apiKey) {
      alert('No API key found. Please pair from desktop first.');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Enter a valid amount');
      return;
    }

    if (amount > principal) {
      alert(`Cannot withdraw more than available principal ($${principal.toFixed(2)})`);
      return;
    }

    setIsWithdrawing(true);
    try {
      const { signAndExecuteWithdrawal } = await import('@/lib/web3-vault');
      const result = await signAndExecuteWithdrawal();
      const response = await fetch('/api/vault/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          walletAddress: result.walletAddress,
          txHash: result.txHash,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Withdrawal failed: ${error.error || error.message || 'Unknown error'}`);
        return;
      }

      const settled = await response.json();
      if (updateUserState) {
        updateUserState({
          principal: 0,
          battery: 0,
          remaining: 0,
          advance: 0,
        });
      }
      if (refreshStatus) {
        refreshStatus().catch(console.warn);
      }
      alert(`Withdrawal sent.\nPayout: $${((settled.payout6Dec || 0) / 1_000000).toFixed(2)}\n${result.explorerUrl}`);
      setWithdrawAmount('');
    } catch (err: any) {
      console.error('Withdraw error:', err);
      
      if (err.message && err.message.includes('rejected')) {
        alert('❌ Withdrawal cancelled - you rejected the wallet signature');
      } else {
        alert(`❌ Withdrawal failed: ${err.message || 'Check console'}`);
      }
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Update spend limit handler
  const handleUpdateSpendLimit = async (newLimit: number) => {
    if (!apiKey) return;

    try {
      const response = await fetch('/api/vault/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          maxPerCallUsdc: Math.round(newLimit * 1_000000),
        }),
      });

      if (!response.ok) {
        console.error('Failed to update spend limit');
        return;
      }

      setMaxPerCall(newLimit);
    } catch (err) {
      console.error('Update spend limit error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-2">
        <div>
          <h1 className="text-3xl font-display">UNTOUCHED</h1>
          <p className="text-sm text-white/50 font-mono mt-1">Principal-Protected Gateway</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-xs text-white/50 font-mono">{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Vault Status Card */}
      <div className="relative bg-black border border-emerald-500/30 rounded-lg p-6 mb-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-emerald-400 text-sm font-mono uppercase tracking-wider flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Vault Balance
            </span>
            <span className="text-xs text-white/40 font-mono">Principal-Protected</span>
          </div>
          <div className="text-5xl font-display text-white mb-2">
            ${principal.toFixed(2)}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-emerald-400/70">
              Available: ${principal.toFixed(2)}
            </span>
            <span className="text-white/40 font-mono">
              5.0% APY
            </span>
          </div>
        </div>
      </div>

      {/* Quick Stake Actions */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <button
          onClick={() => handleQuickStake(10)}
          className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg py-3 text-emerald-400 font-medium text-sm transition-colors"
        >
          +$10
        </button>
        <button
          onClick={() => handleQuickStake(50)}
          className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg py-3 text-emerald-400 font-medium text-sm transition-colors"
        >
          +$50
        </button>
        <button
          onClick={() => handleQuickStake(100)}
          className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg py-3 text-emerald-400 font-medium text-sm transition-colors"
        >
          +$100
        </button>
        <button
          onClick={() => handleQuickStake(250)}
          className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg py-3 text-emerald-400 font-medium text-sm transition-colors"
        >
          +$250
        </button>
      </div>

      {/* Yield Battery Card with Ring Visualization */}
      <div className="relative bg-black border border-cyan-500/30 rounded-lg p-6 mb-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-6">
            {/* Battery Ring */}
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="8"
                />
                {/* Progress ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="url(#batteryGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${batteryPercent * 2.51} 251`}
                  className="transition-all duration-500"
                />
                <defs>
                  <linearGradient id="batteryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#67e8f9" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-xl font-display text-cyan-400">{batteryPercent.toFixed(0)}%</div>
                </div>
              </div>
            </div>

            {/* Battery Info */}
            <div className="flex-1">
              <div className="text-cyan-400 text-sm font-mono uppercase tracking-wider mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Yield Battery
              </div>
              <div className="text-3xl font-display text-white mb-1">
                ${remaining.toFixed(4)}
              </div>
              <div className="text-xs text-cyan-400/70">
                Remaining: ${remaining.toFixed(4)} • Used: ${usedCredit.toFixed(4)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Autonomous Spend Limit Slider */}
      <div className="bg-black border border-white/10 rounded-lg p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm text-white/50 font-mono uppercase tracking-wider">Autonomous Spend Limit</label>
          <span className="text-lg font-display text-white">${maxPerCall.toFixed(3)}</span>
        </div>
        <input
          type="range"
          min="0.001"
          max="0.025"
          step="0.001"
          value={maxPerCall}
          onChange={(e) => {
            const newLimit = parseFloat(e.target.value);
            setMaxPerCall(newLimit);
            handleUpdateSpendLimit(newLimit);
          }}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
        />
        <div className="flex items-center justify-between mt-2 text-xs text-white/40 font-mono">
          <span>$0.001</span>
          <span>$0.025</span>
        </div>
        <div className="mt-3 text-xs text-white/50">
          Requests exceeding this amount are blocked instantly (0ms, HTTP 403)
        </div>
      </div>

      {/* Withdraw Principal */}
      <div className="bg-black border border-amber-500/30 rounded-lg p-6 mb-6">
        <div className="text-amber-400 text-sm font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Withdraw Principal
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Amount (USD)"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-amber-400/50"
            step="0.01"
            min="0"
            max={principal}
          />
          <button
            onClick={handleWithdraw}
            disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-white/20 disabled:text-white/40 text-black rounded font-medium text-sm transition-colors"
          >
            {isWithdrawing ? 'Processing...' : 'Withdraw'}
          </button>
        </div>
        <div className="text-xs text-amber-400/60 mt-3">
          Available: ${principal.toFixed(2)} • Forfeits proportional yield
        </div>
      </div>

      {/* Live x402 Receipt Feed */}
      <div className="bg-black border border-white/10 rounded-lg p-6">
        <h3 className="text-xl font-display mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Live x402 Receipt Feed
        </h3>

        {recentReceipts.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm mb-1">No activity yet</p>
            <p className="text-xs text-white/30">Agent requests will appear here in real-time</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentReceipts.map((receipt) => {
              const costUSD = receipt.costUSDC / 1_000000;
              const isBlocked = receipt.provider === 'blocked';
              const isFree = costUSD === 0 && !isBlocked;

              return (
                <div
                  key={receipt.id}
                  className={`relative p-3 rounded-lg border overflow-hidden ${
                    isBlocked
                      ? 'border-red-500/30'
                      : isFree
                      ? 'border-cyan-500/30'
                      : 'border-emerald-500/30'
                  }`}
                >
                  <div className={`absolute inset-0 ${
                    isBlocked
                      ? 'bg-gradient-to-br from-red-500/10 to-transparent'
                      : isFree
                      ? 'bg-gradient-to-br from-cyan-500/10 to-transparent'
                      : 'bg-gradient-to-br from-emerald-500/10 to-transparent'
                  } pointer-events-none`} />
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate">
                          {receipt.model || 'AI Request'}
                        </div>
                      </div>
                      <div className={`text-xs font-mono font-semibold ml-3 ${
                        isBlocked ? 'text-red-400' : isFree ? 'text-cyan-400' : 'text-emerald-400'
                      }`}>
                        {isBlocked ? 'BLOCKED' : costUSD > 0 ? `-$${costUSD.toFixed(4)}` : 'FREE'}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-white/40 font-mono">
                      <span className="truncate">{receipt.provider}</span>
                      <span className="ml-2">{new Date(receipt.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Safe Space */}
      <div className="h-8"></div>
    </div>
  );
}
