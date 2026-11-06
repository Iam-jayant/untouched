'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Plus, Key, Code2 } from 'lucide-react';
import type { APIKeyMetadata } from '@/lib/agent-store';

interface APIKeyManagerProps {
  vaultId: string;
}

export function APIKeyManager({ vaultId }: APIKeyManagerProps) {
  const [keys, setKeys] = useState<APIKeyMetadata[]>([]);
  const [activeKey, setActiveKey] = useState<string>(vaultId);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch keys on mount
  useEffect(() => {
    fetchKeys();
  }, [vaultId]);

  const fetchKeys = async () => {
    try {
      const res = await fetch(`/api/vault/keys?apiKey=${vaultId}`);
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (error) {
      console.error('Failed to fetch keys:', error);
    }
  };

  const createKey = async () => {
    if (!newKeyLabel.trim()) return;
    setIsCreating(true);

    try {
      const res = await fetch('/api/vault/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultId, label: newKeyLabel }),
      });

      if (res.ok) {
        const data = await res.json();
        await fetchKeys();
        setNewKeyLabel('');
        setShowCreateModal(false);
        setActiveKey(data.key.key);
      }
    } catch (error) {
      console.error('Failed to create key:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copySnippet = async () => {
    const snippet = `import { OpenAI } from 'openai';

const client = new OpenAI({
  apiKey: '${activeKey}',
  baseURL: '${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1'
});

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }]
});`;

    await navigator.clipboard.writeText(snippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* API Keys Card */}
      <div className="bg-black border border-white/10 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-white/60" />
            <h2 className="text-xl font-display">API Keys</h2>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-white/90 rounded font-medium text-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Create API Key
          </button>
        </div>

        {/* Keys List */}
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.key}
              className={`relative group flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer ${
                activeKey === key.key
                  ? 'bg-white/5 border-white/20'
                  : 'bg-white/[0.02] border-white/10 hover:bg-white/5 hover:border-white/15'
              }`}
              onClick={() => setActiveKey(key.key)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-medium text-white">{key.label}</span>
                  {activeKey === key.key && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-mono rounded uppercase">
                      Active
                    </span>
                  )}
                </div>
                <code className="text-xs font-mono text-white/50 break-all">
                  {key.key}
                </code>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(key.key, key.key);
                }}
                className="ml-4 p-2 hover:bg-white/10 rounded transition-colors"
              >
                {copiedKey === key.key ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-white/60" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Drop-In Snippet Card */}
      <div className="bg-black border border-white/10 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Code2 className="w-5 h-5 text-white/60" />
            <h2 className="text-xl font-display">Drop-In OpenAI Replacement</h2>
          </div>
          <button
            onClick={copySnippet}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-sm transition-all"
          >
            {copiedSnippet ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
        </div>

        <pre className="bg-white/5 border border-white/10 rounded-lg p-4 overflow-x-auto">
          <code className="text-xs text-white/80 font-mono">
{`import { OpenAI } from 'openai';

const client = new OpenAI({
  apiKey: '${activeKey}',
  baseURL: '${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1'
});

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }]
});`}
          </code>
        </pre>

        <div className="mt-4 flex items-start gap-2 text-xs text-white/50">
          <div className="w-1 h-1 rounded-full bg-white/30 mt-1.5" />
          <span>
            Compatible with OpenAI SDK, Cursor, Cline, LangChain, and any OpenAI-compatible client.
            Replace <code className="px-1 py-0.5 bg-white/10 rounded">api.openai.com</code> with your
            Untouched Gateway URL.
          </span>
        </div>
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in">
          <div className="bg-black border border-white/20 rounded-lg max-w-md w-full p-8 slide-up">
            <div className="flex items-center gap-3 mb-6">
              <Plus className="w-6 h-6 text-white/60" />
              <h2 className="text-2xl font-display">Create API Key</h2>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-white/60 mb-2 font-mono uppercase tracking-wider">
                Key Label
              </label>
              <input
                type="text"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createKey()}
                placeholder="e.g., Cursor IDE, Production Agent"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded text-white placeholder:text-white/30 focus:border-white/30 focus:bg-white/10 transition-all"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded font-medium transition-all"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={createKey}
                disabled={!newKeyLabel.trim() || isCreating}
                className="flex-1 px-4 py-3 bg-white text-black hover:bg-white/90 rounded font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed btn-shimmer"
              >
                {isCreating ? 'Creating...' : 'Create Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
