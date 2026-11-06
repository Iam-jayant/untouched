'use client';

import { useEffect, useState } from 'react';
import { useAppState } from '@/components/providers/AppStateProvider';
import { toast } from 'sonner';

export default function MobilePage() {
  const {
    userState,
    receipts,
    connected,
    apiKey,
    walletAddress,
    walletStatus,
    setApiKey,
    connectWallet,
    refreshStatus,
    updateUserState,
  } = useAppState();
  const [ready, setReady] = useState(false);
  const [maxPerCall, setMaxPerCall] = useState(0.005);
  const [busy, setBusy] = useState<'stake' | 'withdraw' | null>(null);

  useEffect(() => {
    setReady(true);
    const params = new URLSearchParams(window.location.search);
    const urlApiKey = params.get('apiKey');
    if (urlApiKey) {
      localStorage.setItem('untouched_api_key', urlApiKey);
      setApiKey(urlApiKey);
      window.history.replaceState({}, '', '/mobile');
    } else {
      const storedKey = localStorage.getItem('untouched_api_key');
      if (storedKey) setApiKey(storedKey);
    }
  }, [setApiKey]);

  useEffect(() => {
    if (userState?.maxPerCallUsdc) setMaxPerCall(userState.maxPerCallUsdc / 1_000000);
  }, [userState?.maxPerCallUsdc]);

  const principal = (userState?.principal || 0) / 1_000000;
  const remaining = (userState?.remaining || 0) / 1_000000;
  const battery = (userState?.battery || 0) / 1_000000;
  const used = Math.max(0, battery - remaining);
  const batteryPercent = battery > 0 ? Math.min((remaining / battery) * 100, 100) : 0;

  const handleQuickStake = async (amount: number) => {
    if (!walletAddress) {
      await connectWallet();
      return;
    }
    setBusy('stake');
    try {
      const { signAndExecuteDeposit } = await import('@/lib/web3-vault');
      const result = await signAndExecuteDeposit(amount);
      const response = await fetch('/api/vault/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, walletAddress, txHash: result.txHash }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Stake sync failed');
      if (data.apiKey) setApiKey(data.apiKey);
      updateUserState({
        principal: data.principal,
        battery: data.battery,
        remaining: data.remaining,
        advance: data.advance,
      });
      toast.success(`Staked $${amount}`);
    } catch (error) {
      toast.error((error as Error).message || 'Stake failed');
    } finally {
      setBusy(null);
    }
  };

  const handleWithdraw = async () => {
    if (!walletAddress) {
      await connectWallet();
      return;
    }
    if (principal <= 0) {
      toast.error('There is no principal to withdraw');
      return;
    }
    setBusy('withdraw');
    try {
      const { signAndExecuteWithdrawal } = await import('@/lib/web3-vault');
      const result = await signAndExecuteWithdrawal();
      const response = await fetch('/api/vault/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, walletAddress: result.walletAddress, txHash: result.txHash }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Withdraw sync failed');
      updateUserState({ principal: 0, battery: 0, remaining: 0, advance: 0 });
      refreshStatus().catch(() => undefined);
      toast.success(`Withdrew $${((data.payout6Dec || 0) / 1_000000).toFixed(2)}`);
    } catch (error) {
      toast.error((error as Error).message || 'Withdraw failed');
    } finally {
      setBusy(null);
    }
  };

  const handleUpdateSpendLimit = async (newLimit: number) => {
    setMaxPerCall(newLimit);
    if (!apiKey) return;
    await fetch('/api/vault/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, maxPerCallUsdc: Math.round(newLimit * 1_000000) }),
    }).catch(() => undefined);
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 pt-5 pb-10">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-display">UNTOUCHED</h1>
          <p className="text-xs text-white/40 font-mono mt-1">Usage, stake, and withdraw</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-white/50">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {connected ? 'Live' : 'Offline'}
        </div>
      </header>

      {!walletAddress ? (
        <button
          onClick={connectWallet}
          disabled={ready && walletStatus === 'reconnecting'}
          className="w-full mb-4 py-3 rounded bg-orange-500 text-white font-medium disabled:opacity-70"
        >
          {ready && walletStatus === 'reconnecting' ? 'Restoring wallet…' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="mb-4 px-3 py-2 border border-emerald-500/30 rounded text-xs font-mono text-emerald-300">
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </div>
      )}

      <section className="border border-white/10 rounded-lg p-5 mb-3">
        <div className="text-xs font-mono uppercase tracking-wider text-white/40">Protected principal</div>
        <div className="text-4xl font-display mt-2">${principal.toFixed(2)}</div>
        <p className="text-sm text-white/50 mt-1">Stays in the vault. 5.0% APY.</p>
      </section>

      <section className="border border-white/10 rounded-lg p-5 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-white/40">Yield battery</div>
            <div className="text-3xl font-display mt-2">${remaining.toFixed(4)}</div>
            <p className="text-xs text-white/50 mt-1">Used ${used.toFixed(4)} of ${battery.toFixed(4)}</p>
          </div>
          <div className="text-2xl font-display text-white/80">{batteryPercent.toFixed(0)}%</div>
        </div>
        <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-white" style={{ width: `${batteryPercent}%` }} />
        </div>
      </section>

      <section className="border border-white/10 rounded-lg p-5 mb-3">
        <div className="text-xs font-mono uppercase tracking-wider text-white/40 mb-3">Stake USDC</div>
        <div className="grid grid-cols-4 gap-2">
          {[10, 50, 100, 250].map((amount) => (
            <button
              key={amount}
              disabled={busy !== null}
              onClick={() => handleQuickStake(amount)}
              className="py-3 border border-white/15 rounded text-sm font-medium disabled:opacity-40"
            >
              ${amount}
            </button>
          ))}
        </div>
        {busy === 'stake' && <p className="text-xs text-white/50 mt-3">Confirm the stake in your wallet.</p>}
      </section>

      <section className="border border-white/10 rounded-lg p-5 mb-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-white/40">Spend limit</span>
          <span className="font-display">${maxPerCall.toFixed(3)}</span>
        </div>
        <input
          type="range"
          min="0.001"
          max="0.025"
          step="0.001"
          value={maxPerCall}
          onChange={(event) => handleUpdateSpendLimit(parseFloat(event.target.value))}
          className="w-full"
        />
        <p className="text-xs text-white/40 mt-2">A call above this limit is refused. Principal is not spent.</p>
      </section>

      <button
        onClick={handleWithdraw}
        disabled={busy !== null || principal <= 0}
        className="w-full mb-4 py-3 rounded border border-white/20 text-white font-medium disabled:opacity-40"
      >
        {busy === 'withdraw' ? 'Confirm in wallet…' : `Withdraw $${principal.toFixed(2)}`}
      </button>

      <section className="border border-white/10 rounded-lg p-5">
        <h2 className="text-lg font-display mb-4">Usage</h2>
        {receipts.length === 0 ? (
          <p className="text-sm text-white/40">No prompts yet. Usage from the API key shows up here.</p>
        ) : (
          <div className="space-y-2">
            {receipts.slice(0, 20).map((receipt) => (
              <div key={receipt.id} className="flex items-center justify-between border border-white/10 rounded px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm truncate">{receipt.model}</div>
                  <div className="text-[11px] text-white/40 font-mono">{new Date(receipt.timestamp).toLocaleTimeString()}</div>
                </div>
                <div className="text-xs font-mono text-white/80">
                  {receipt.provider === 'blocked' ? 'Blocked' : `$${(receipt.costUSDC / 1_000000).toFixed(4)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
