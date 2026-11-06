'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAppState } from '@/components/providers/AppStateProvider';
import { AppHeader } from '@/components/dashboard/AppHeader';
import { ExecutionTracePanel } from '@/components/dashboard/ExecutionTracePanel';
import type { ExecutionTrace } from '@/lib/infrgate';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Cpu,
  DollarSign,
  Palette,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

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

export default function PlaygroundPage() {
  const {
    userState,
    receipts,
    connected,
    apiKey,
    walletAddress,
    walletStatus,
    connectWallet,
    disconnectWallet,
  } = useAppState();
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isWaitingStepUp, setIsWaitingStepUp] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [executionTrace, setExecutionTrace] = useState<ExecutionTrace | null>(null);
  const [lastPrompt, setLastPrompt] = useState<{ model: string; prompt: string } | null>(null);
  const [lastUsage, setLastUsage] = useState({ prompt: 0, completion: 0, total: 0, cost: 0 });

  const totals = useMemo(() => {
    return receipts.reduce(
      (sum, receipt) => ({
        prompt: sum.prompt + (receipt.promptTokens || 0),
        completion: sum.completion + (receipt.completionTokens || 0),
        total: sum.total + (receipt.totalTokens || 0),
        cost: sum.cost + (receipt.costUSDC || 0),
      }),
      { prompt: 0, completion: 0, total: 0, cost: 0 }
    );
  }, [receipts]);

  const handleSendPrompt = async (useIdempotencyKey = false, content = prompt, model = selectedModel) => {
    if (!content.trim() || !apiKey) return;
    setIsLoading(true);
    setResponse('');
    setIsWaitingStepUp(false);
    setLastPrompt({ model, prompt: content });

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (useIdempotencyKey) {
        headers['Idempotency-Key'] = `replay-${Date.now()}`;
      }

      const res = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages: [{ role: 'user', content }] }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 402) {
        setIsWaitingStepUp(true);
        return;
      }
      if (!res.ok) {
        setResponse(`Error: ${data.error || 'Request failed'}`);
        if (data.executionTrace) setExecutionTrace(data.executionTrace);
        return;
      }

      setResponse(data.choices?.[0]?.message?.content || 'No response');
      setLastUsage({
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
        cost: 0,
      });
      if (data.executionTrace) setExecutionTrace(data.executionTrace);
    } catch (error) {
      setResponse(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      setIsWaitingStepUp(false);
    }
  };

  const pairUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/mobile?apiKey=${encodeURIComponent(apiKey)}${walletAddress ? `&wallet=${encodeURIComponent(walletAddress)}` : ''}`
    : '';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pairUrl)}`;

  return (
    <div className="min-h-screen bg-black text-white">
      <AppHeader
        active="playground"
        walletAddress={walletAddress}
        walletStatus={walletStatus}
        connected={connected}
        userState={userState}
        onConnect={connectWallet}
        onDisconnect={disconnectWallet}
        onPair={() => setShowPairModal(true)}
      />

      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-4">
        {!apiKey ? (
          <div className="border border-white/10 rounded-lg p-10 text-center">
            <h2 className="text-2xl font-display mb-3">Stake once to unlock the playground</h2>
            <p className="text-white/60 mb-6">The API key is created after the first confirmed USDC stake.</p>
            <Link href="/dashboard" className="inline-flex px-5 py-2.5 bg-white text-black rounded font-medium">
              Go to dashboard
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
              {[
                ['Prompt tokens', lastUsage.prompt.toLocaleString()],
                ['Completion tokens', lastUsage.completion.toLocaleString()],
                ['Last call', lastUsage.total.toLocaleString()],
                ['Session tokens', totals.total.toLocaleString()],
                ['Yield spent', `$${(totals.cost / 1_000000).toFixed(4)}`],
                ['Battery left', `$${((userState?.remaining || 0) / 1_000000).toFixed(4)}`],
              ].map(([label, value]) => (
                <div key={label} className="bg-black border border-white/10 rounded-lg px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">{label}</div>
                  <div className="mt-1 text-lg font-display tabular-nums">{value}</div>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-10 gap-4 items-start">
            <section className="md:col-span-7 bg-black/50 border border-white/10 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-5">
                <Cpu className="w-5 h-5 text-white/60" />
                <h1 className="text-lg font-medium">AI Playground</h1>
              </div>

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
                className="w-full bg-black/60 border border-white/20 rounded px-3 py-2.5 text-sm text-white focus:border-white/40"
              >
                <optgroup label="Yield battery — $1 per 1M tokens">
                  {yieldModels.map((model) => (
                    <option key={model.id} value={model.id} className="bg-black text-white">
                      {model.name} ({model.cost})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Locked — Protects the yield battery">
                  {lockedModels.map((model) => (
                    <option key={model.id} value={model.id} disabled className="bg-black text-white/40">
                      {model.name} — Locked
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="mt-2 mb-5 text-xs text-white/50">Upstream API paid by Untouched. Principal untouched.</p>

              <div className="mb-5 pb-5 border-b border-white/10">
                <label className="flex items-center gap-2 text-xs text-white/50 font-mono uppercase tracking-wider mb-3">
                  <Activity className="w-3.5 h-3.5" />
                  Arc Marketplace MCP Tools
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {arcTools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded text-xs text-white/70"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {tool.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt..."
                className="w-full h-48 bg-white/5 border border-white/10 rounded px-4 py-3 text-sm resize-none focus:border-white/30 placeholder:text-white/30"
              />

              <div className="mt-3 space-y-2">
                <button
                  onClick={() => handleSendPrompt(false)}
                  disabled={isLoading || !prompt.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black hover:bg-white/90 disabled:opacity-30 rounded font-medium"
                >
                  {isLoading ? 'Sending...' : 'Send Prompt'}
                  {!isLoading && <ArrowRight className="w-4 h-4" />}
                </button>
                {lastPrompt && (
                  <button
                    onClick={() => handleSendPrompt(true, lastPrompt.prompt, lastPrompt.model)}
                    disabled={isLoading}
                    className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded text-sm disabled:opacity-30"
                  >
                    Replay Last Prompt (Idempotency $0.00)
                  </button>
                )}
              </div>

              {isWaitingStepUp && (
                <div className="mt-4 flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div className="text-sm text-red-400">The yield battery cannot cover this call.</div>
                </div>
              )}

              {response && (
                <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded text-sm text-white/80 whitespace-pre-wrap font-mono leading-relaxed">
                  {response}
                </div>
              )}
            </section>

            <aside className="md:col-span-3 md:sticky md:top-24">
              <ExecutionTracePanel trace={executionTrace} />
            </aside>
            </div>
          </>
        )}
      </div>

      {showPairModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black border border-white/20 rounded-lg max-w-md w-full p-8">
            <h2 className="text-2xl font-display mb-4">Pair Mobile PWA</h2>
            <div className="mb-4 flex justify-center p-4 bg-white rounded-lg">
              <img src={qrUrl} alt="QR Code" className="w-48 h-48" />
            </div>
            <div className="font-mono text-sm bg-white/5 border border-white/10 rounded px-3 py-2 break-all text-white/70 mb-4">
              {pairUrl}
            </div>
            <button onClick={() => setShowPairModal(false)} className="w-full px-4 py-3 bg-white text-black rounded font-medium">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
