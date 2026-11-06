'use client';

import { useState, useEffect } from 'react';
import { useAppState } from '@/components/providers/AppStateProvider';
import Link from 'next/link';
import { APIKeyManager } from '@/components/dashboard/APIKeyManager';
import { ExecutionTracePanel } from '@/components/dashboard/ExecutionTracePanel';
import type { ExecutionTrace } from '@/lib/infrgate';
import { toast } from 'sonner';
import {
  Shield,
  Zap,
  Receipt,
  Copy,
  Check,
  Smartphone,
  Terminal,
  Sparkles,
  Search,
  Palette,
  TrendingUp,
  DollarSign,
  Lock,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Code2,
  Cpu,
  Database,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export default function DashboardPage() {
  const { 
    userState, 
    receipts, 
    pendingApproval, 
    connected, 
    apiKey, 
    walletAddress,
    walletStatus,
    connectWallet, 
    connectDemoWallet, 
    disconnectWallet,
    refreshStatus,
    updateUserState,
    setApiKey,
  } = useAppState();
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isWaitingStepUp, setIsWaitingStepUp] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [executionTrace, setExecutionTrace] = useState<ExecutionTrace | null>(null);
  const [selectedReceiptTrace, setSelectedReceiptTrace] = useState<ExecutionTrace | null>(null);
  const [lastPrompt, setLastPrompt] = useState<{ model: string; prompt: string } | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const yieldModels = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', cost: '$1 / 1M' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', cost: '$1 / 1M' },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', cost: '$1 / 1M' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', cost: '$1 / 1M' },
  ];

  const lockedModels = [
    { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'o1', name: 'o1' },
  ];

  const arcTools = [
    { id: 'web-search', name: 'Web Search', icon: Search },
    { id: 'creative', name: 'Creative', icon: Palette },
    { id: 'predictions', name: 'Predictions', icon: TrendingUp },
    { id: 'financial', name: 'Financial', icon: DollarSign },
  ];

  const handleSendPrompt = async (useIdempotencyKey = false) => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setResponse('');
    setIsWaitingStepUp(false);

    // Save last prompt for replay
    setLastPrompt({ model: selectedModel, prompt });

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };

      // Add Idempotency-Key header if replaying
      if (useIdempotencyKey) {
        headers['Idempotency-Key'] = `replay-${Date.now()}`;
      }

      const res = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: selectedModel, messages: [{ role: 'user', content: prompt }] }),
      });

      if (res.status === 402) { setIsWaitingStepUp(true); return; }
      if (res.status === 403) { 
        const data = await res.json();
        setResponse('❌ Request blocked by spend policy'); 
        if (data.executionTrace) {
          setExecutionTrace(data.executionTrace);
        }
        setIsLoading(false); 
        return; 
      }
      if (!res.ok) { const error = await res.json(); setResponse(`Error: ${error.error || 'Request failed'}`); setIsLoading(false); return; }

      const data = await res.json();
      setResponse(data.choices[0]?.message?.content || 'No response');
      
      // Store execution trace if present
      if (data.executionTrace) {
        setExecutionTrace(data.executionTrace);
        setSelectedReceiptTrace(null); // Clear receipt selection when new trace arrives
      }
    } catch (error) {
      setResponse(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      setIsWaitingStepUp(false);
    }
  };

  const handleReplayLastPrompt = () => {
    if (!lastPrompt) return;
    setSelectedModel(lastPrompt.model);
    setPrompt(lastPrompt.prompt);
    handleSendPrompt(true);
  };

  const handleDeposit = async (amount: number) => {
    if (!walletAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    const toastId = toast.loading('Confirm the USDC stake in MetaMask...');

    try {
      const { signAndExecuteDeposit } = await import('@/lib/web3-vault');
      const result = await signAndExecuteDeposit(amount);
      toast.loading('Syncing the confirmed stake...', { id: toastId });

      const response = await fetch('/api/vault/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          walletAddress,
          txHash: result.txHash,
        }),
      });
      const depositData = await response.json();
      if (!response.ok) {
        throw new Error(depositData.error || 'Stake sync failed');
      }
      if (depositData.apiKey) {
        setApiKey(depositData.apiKey);
        localStorage.setItem('untouched_api_key', depositData.apiKey);
      }
      updateUserState({
        principal: depositData.principal,
        battery: depositData.battery,
        remaining: depositData.remaining,
        advance: depositData.advance,
      });
      toast.success(`Staked $${amount}. Yield battery unlocked.`, { id: toastId });
      toast.message(result.explorerUrl);
    } catch (error) {
      toast.error((error as Error).message || 'Deposit failed', { id: toastId });
    }
  };

  const copyToClipboard = async (text: string, type: 'url' | 'key') => {
    await navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const pairUrl = typeof window !== 'undefined' ? `${window.location.origin}/mobile?apiKey=${encodeURIComponent(apiKey)}${walletAddress ? `&wallet=${encodeURIComponent(walletAddress)}` : ''}` : '';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pairUrl)}`;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-20">
            <Link href="/landing" className="flex items-center gap-3 group">
              <span className="text-2xl font-display text-white group-hover:text-white/80 transition-colors duration-300">
                UNTOUCHED
              </span>
              <span className="hidden md:flex items-center gap-2 text-xs text-white/40 font-mono uppercase tracking-wider border-l border-white/10 pl-3">
                <Terminal className="w-3 h-3" />
                Developer Dashboard
              </span>
            </Link>

            <div className="flex items-center gap-4">
              {/* Wallet Connection */}
              {!walletAddress ? (
                <button
                  onClick={connectWallet}
                  disabled={walletStatus === 'reconnecting'}
                  className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded font-medium text-sm transition-all duration-300 shadow-lg hover:shadow-orange-500/50 disabled:opacity-70"
                >
                  <span>{walletStatus === 'reconnecting' ? 'Restoring wallet…' : 'Connect Wallet'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  {/* Connected Wallet Badge */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/30 rounded">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-mono text-emerald-300">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </span>
                  </div>
                  {/* Agent Signer Badge */}
                  {userState?.agentSigner && (
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded">
                      <Terminal className="w-3 h-3 text-white/60" />
                      <span className="text-xs font-mono text-white/60">
                        Agent: {userState.agentSigner.slice(0, 6)}...
                      </span>
                    </div>
                  )}
                  <button
                    onClick={disconnectWallet}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/20 text-white/70 hover:text-white rounded text-sm transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}

              <div className="hidden lg:flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors">
                  <Shield className="w-3.5 h-3.5 text-white/60" />
                  <span className="text-xs font-mono text-white/60">
                    <span className="text-white font-medium">${((userState?.principal || 0) / 1_000000).toFixed(2)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors">
                  <Zap className="w-3.5 h-3.5 text-white/60" />
                  <span className="text-xs font-mono text-white/60">
                    <span className="text-white font-medium">${((userState?.remaining || 0) / 1_000000).toFixed(4)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded">
                  <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className="text-xs font-mono text-white/60">{connected ? 'Live' : 'Offline'}</span>
                </div>
              </div>

              <button
                onClick={() => setShowPairModal(true)}
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

      {/* Hero Stats Bar OR Connect Wallet Prompt */}
      <section className="border-b border-white/10 bg-gradient-to-b from-black to-black/95">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12">
          {!walletAddress ? (
            /* Connect Wallet Prompt */
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-500/30 mb-6">
                <span className="text-4xl">🦊</span>
              </div>
              <h2 className="text-3xl font-display mb-4">Connect Your Wallet to Start</h2>
              <p className="text-white/60 mb-8 max-w-md mx-auto">
                Create your principal-protected vault by connecting your Web3 wallet. Your deposit is secured in USYC on Arc Testnet.
              </p>
              <button
                onClick={connectWallet}
                disabled={walletStatus === 'reconnecting'}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-orange-500/50 disabled:opacity-70"
              >
                <span>{walletStatus === 'reconnecting' ? 'Restoring wallet…' : 'Connect Wallet'}</span>
              </button>
            </div>
          ) : (
            /* Stats Cards */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Principal Card */}
            <div className={`group transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="relative overflow-hidden rounded-lg hover-lift">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-white/20 to-white/0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-black border border-white/10 group-hover:border-white/20 rounded-lg p-6 transition-colors duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <span className="flex items-center gap-2 text-xs text-white/40 font-mono uppercase tracking-wider">
                      <Shield className="w-4 h-4" />
                      Protected Principal
                    </span>
                    <Lock className="w-4 h-4 text-white/30 group-hover:text-white/50 transition-colors" />
                  </div>
                  <div className="text-5xl font-display tabular-nums mb-2 text-white">
                    ${((userState?.principal || 0) / 1_000000).toFixed(2)}
                  </div>
                  <span className="text-sm text-white/50">Earning 5.0% APY • USYC Vault</span>
                </div>
              </div>
            </div>

            {/* Battery Card */}
            <div className={`group transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="relative overflow-hidden rounded-lg hover-lift">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-white/20 to-white/0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-black border border-white/10 group-hover:border-white/20 rounded-lg p-6 transition-colors duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <span className="flex items-center gap-2 text-xs text-white/40 font-mono uppercase tracking-wider">
                      <Zap className="w-4 h-4" />
                      Yield Battery
                    </span>
                    <Sparkles className="w-4 h-4 text-white/30 group-hover:text-white/50 transition-colors" />
                  </div>
                  <div className="text-5xl font-display tabular-nums mb-2 text-white">
                    ${((userState?.remaining || 0) / 1_000000).toFixed(4)}
                  </div>
                  <span className="text-sm text-white/50">Available for AI prompts</span>
                </div>
              </div>
            </div>

            {/* Receipts Card */}
            <div className={`group transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="relative overflow-hidden rounded-lg hover-lift">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-white/20 to-white/0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-black border border-white/10 group-hover:border-white/20 rounded-lg p-6 transition-colors duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <span className="flex items-center gap-2 text-xs text-white/40 font-mono uppercase tracking-wider">
                      <Receipt className="w-4 h-4" />
                      Total Receipts
                    </span>
                    <CheckCircle className="w-4 h-4 text-white/30 group-hover:text-white/50 transition-colors" />
                  </div>
                  <div className="text-5xl font-display tabular-nums mb-2 text-white">
                    {receipts.length}
                  </div>
                  <span className="text-sm text-white/50">Zero principal deducted</span>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </section>

      {/* Main Content - Only show if wallet connected */}
      {walletAddress && (
      <section className="max-w-[1400px] mx-auto px-6 lg:px-12 py-8">
        {/* API Keys & Drop-In Setup */}
        <div className="mb-8">
          <APIKeyManager vaultId={apiKey} />
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* API Endpoint */}
            <div className={`slide-up`} style={{ animationDelay: '0.1s' }}>
              <div className="relative group">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-white/10 to-white/0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-black/50 border border-white/10 rounded-lg p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <Terminal className="w-5 h-5 text-white/60" />
                    <h3 className="text-lg font-medium">API Endpoint</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center gap-2 text-xs text-white/50 font-mono uppercase tracking-wider mb-2">
                        <Code2 className="w-3.5 h-3.5" />
                        Base URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value="http://localhost:3000/api/v1"
                          readOnly
                          className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 font-mono text-sm focus:border-white/30 focus:bg-white/10 transition-all"
                        />
                        <button
                          onClick={() => copyToClipboard('http://localhost:3000/api/v1', 'url')}
                          className="group flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded transition-all hover-scale"
                        >
                          {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-xs text-white/50 font-mono uppercase tracking-wider mb-2">
                        <Lock className="w-3.5 h-3.5" />
                        API Key
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={apiKey}
                          readOnly
                          className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 font-mono text-sm focus:border-white/30 focus:bg-white/10 transition-all"
                        />
                        <button
                          onClick={() => copyToClipboard(apiKey, 'key')}
                          className="group flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded transition-all hover-scale"
                        >
                          {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 text-xs text-white/40">
                      <ExternalLink className="w-3 h-3" />
                      <span>Compatible with OpenAI SDK, Cursor, LangChain</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Deposit Tiers */}
            <div className="slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="relative group">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-white/10 to-white/0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-black/50 border border-white/10 rounded-lg p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <Database className="w-5 h-5 text-white/60" />
                    <h3 className="text-lg font-medium">Deposit Tiers</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[10, 50, 100, 250].map((amount, i) => (
                      <button
                        key={amount}
                        onClick={() => handleDeposit(amount)}
                        className="group relative px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded font-medium transition-all duration-300 overflow-hidden hover-lift"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      >
                        <span className="relative z-10 text-lg text-white font-display">${amount}</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      </button>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-white/10 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">USYC NAV</span>
                      <span className="font-mono text-white/80">$1.00000000</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">APY Rate</span>
                      <span className="font-mono text-white/80">5.0%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Simulator */}
            <div className="slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="relative bg-black/50 border border-white/10 rounded-lg p-6 backdrop-blur-sm">
                <h3 className="text-lg font-medium mb-2">Yield reconcile</h3>
                <p className="text-sm text-white/60">
                  Chainlink CRE reads this vault and official USYC every 6 hours, checks the gateway spend ledger, and repays used yield on-chain.
                </p>
              </div>
            </div>
          </div>

          {/* Center - Playground */}
          <div className="lg:col-span-5">
            <div className="slide-up" style={{ animationDelay: '0.4s' }}>
              <div className="relative group">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-white/10 to-white/0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-black/50 border border-white/10 rounded-lg p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <Cpu className="w-5 h-5 text-white/60" />
                    <h3 className="text-lg font-medium">AI Playground</h3>
                  </div>

                  {/* Model Selector */}
                  <div className="mb-5">
                    <label className="flex items-center gap-2 text-xs text-white/50 font-mono uppercase tracking-wider mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      Model Selection
                    </label>
                    <select
                      value={selectedModel}
                      onChange={(e) => {
                        const next = yieldModels.find((model) => model.id === e.target.value);
                        if (next) setSelectedModel(e.target.value);
                      }}
                      className="w-full bg-black/60 backdrop-blur-md border border-white/20 rounded px-3 py-2.5 text-sm text-white focus:border-white/40 focus:bg-black/70 transition-all cursor-pointer shadow-lg"
                    >
                      <optgroup label="Yield battery — $1 per 1M tokens">
                        {yieldModels.map((m) => (
                          <option key={m.id} value={m.id} className="bg-black/95 text-white py-2">
                            {m.name} ({m.cost})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Locked — Protects the yield battery">
                        {lockedModels.map((m) => (
                          <option key={m.id} value={m.id} disabled className="bg-black/95 text-white/40 py-2">
                            {m.name} — Locked
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <p className="mt-2 text-xs text-white/50">Upstream API paid by Untouched. Principal untouched.</p>
                  </div>

                  {/* Arc Tools */}
                  <div className="mb-5 pb-5 border-b border-white/10">
                    <label className="flex items-center gap-2 text-xs text-white/50 font-mono uppercase tracking-wider mb-3">
                      <Activity className="w-3.5 h-3.5" />
                      Arc Marketplace MCP Tools
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {arcTools.map((tool, i) => {
                        const Icon = tool.icon;
                        return (
                          <button
                            key={tool.id}
                            className="group relative flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded text-xs font-medium transition-all duration-300 overflow-hidden"
                            style={{ animationDelay: `${i * 0.05}s` }}
                          >
                            <Icon className="w-3.5 h-3.5 text-white/60 group-hover:text-white/80 group-hover:scale-110 transition-all" />
                            <span className="text-white/70 group-hover:text-white transition-colors">{tool.name}</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Prompt */}
                  <div className="mb-4">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Enter your prompt..."
                      className="w-full h-32 bg-white/5 border border-white/10 rounded px-4 py-3 text-sm resize-none focus:border-white/30 focus:bg-white/10 transition-all placeholder:text-white/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => handleSendPrompt(false)}
                      disabled={isLoading || !prompt.trim()}
                      className="group w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed rounded font-medium transition-all duration-300 hover:gap-3 btn-shimmer overflow-hidden relative"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Send Prompt</span>
                          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </>
                      )}
                    </button>

                    {lastPrompt && (
                      <button
                        onClick={handleReplayLastPrompt}
                        disabled={isLoading}
                        className="group w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed rounded font-medium text-sm transition-all duration-300 hover:gap-3 overflow-hidden relative"
                      >
                        <span className="text-lg">🔁</span>
                        <span>Replay Last Prompt (Idempotency $0.00)</span>
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </div>

                  {/* Step-Up Warning */}
                  {isWaitingStepUp && (
                    <div className="mt-4 flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-red-400 mb-1">Blocked by Autonomous Policy</div>
                        <div className="text-xs text-white/60">Request exceeds spend limit. Adjust settings or use a lighter model.</div>
                      </div>
                    </div>
                  )}

                  {/* Response */}
                  {response && (
                    <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded slide-up">
                      <div className="text-sm text-white/80 whitespace-pre-wrap font-mono leading-relaxed">{response}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Top - Execution Trace */}
          <div className="lg:col-span-4 space-y-6">
            <div className="slide-up" style={{ animationDelay: '0.4s' }}>
              <ExecutionTracePanel trace={executionTrace || selectedReceiptTrace} />
            </div>

            {/* Right Bottom - Receipts */}
            <div className="slide-up" style={{ animationDelay: '0.5s' }}>
              <div className="sticky top-24 relative group">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-white/10 to-white/0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-black/50 border border-white/10 rounded-lg p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <Receipt className="w-5 h-5 text-white/60" />
                    <h3 className="text-lg font-medium">Live Receipts</h3>
                  </div>

                  {/* Summary */}
                  <div className="mb-5 pb-5 border-b border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">Total Prompts</span>
                      <span className="font-mono text-white font-medium">{receipts.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">Principal Used</span>
                      <span className="font-mono text-white font-medium">$0.00</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/50">Yield Spent</span>
                      <span className="font-mono text-white font-medium">
                        ${(receipts.reduce((sum, r) => sum + r.costUSDC, 0) / 1_000000).toFixed(4)}
                      </span>
                    </div>
                  </div>

                  {/* List */}
                  <div className="space-y-2.5 max-h-[600px] overflow-y-auto">
                    {receipts.length === 0 && (
                      <div className="text-center py-12 fade-in">
                        <Receipt className="w-12 h-12 mx-auto mb-3 text-white/20" />
                        <p className="text-sm text-white/40 mb-1">No receipts yet</p>
                        <p className="text-xs text-white/30">Send a prompt to get started</p>
                      </div>
                    )}

                    {receipts.map((receipt, i) => {
                      const isBlocked = receipt.provider === 'blocked';
                      const isHeavy = receipt.costUSDC > 10000;
                      return (
                        <div
                          key={receipt.id}
                          onClick={() => {
                            if (receipt.executionTrace) {
                              setSelectedReceiptTrace(receipt.executionTrace);
                              setExecutionTrace(null); // Clear live trace when viewing receipt
                            }
                          }}
                          className={`group p-3 rounded border transition-all duration-300 hover-lift cursor-pointer ${
                            isBlocked 
                              ? 'bg-red-500/10 border-red-500/30' 
                              : 'bg-white/5 border-white/10 hover:border-white/20'
                          } ${
                            selectedReceiptTrace?.requestId === receipt.id
                              ? 'ring-2 ring-white/30'
                              : ''
                          }`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate text-white/90">{receipt.model}</div>
                            </div>
                            {isBlocked ? (
                              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 ml-2" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-white/60 flex-shrink-0 ml-2" />
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/40 font-mono">{new Date(receipt.timestamp).toLocaleTimeString()}</span>
                            <span className={`font-mono font-medium ${isBlocked ? 'text-red-400' : 'text-white/80'}`}>
                              ${(receipt.costUSDC / 1_000000).toFixed(4)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                              isBlocked 
                                ? 'bg-red-500/20 text-red-400' 
                                : receipt.free 
                                ? 'bg-white/10 text-white/60' 
                                : 'bg-white/20 text-white/80'
                            }`}>
                              {isBlocked ? 'BLOCKED' : receipt.free ? 'AUTO' : 'STEP-UP'}
                            </span>
                            {receipt.x402Signature && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/20 text-emerald-400" title={receipt.x402Signature}>
                                x402: {receipt.x402Signature.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Pair Modal */}
      {showPairModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in">
          <div className="bg-black border border-white/20 rounded-lg max-w-md w-full p-8 slide-up">
            <div className="flex items-center gap-3 mb-6">
              <Smartphone className="w-6 h-6 text-white/60" />
              <h2 className="text-2xl font-display">Pair Mobile PWA</h2>
            </div>
            
            <div className="text-center mb-6">
              <div className="text-sm text-white/50 mb-4">Scan this QR code with your phone:</div>
              <div className="mb-4 flex justify-center p-4 bg-white rounded-lg hover-scale">
                <img src={qrUrl} alt="QR Code" className="w-48 h-48" />
              </div>
              <div className="font-mono text-sm bg-white/5 border border-white/10 rounded px-3 py-2 break-all text-white/70">
                {pairUrl}
              </div>
            </div>

            <button
              onClick={() => setShowPairModal(false)}
              className="w-full px-4 py-3 bg-white text-black hover:bg-white/90 rounded font-medium transition-all btn-shimmer overflow-hidden relative"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
