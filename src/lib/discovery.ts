/**
 * Arc Discovery API
 * Fetches Arc Marketplace resources from Circle API with TTL cache and offline fallback
 */

import type { DiscoveryResponse } from './types';
import {
  DISCOVERY_TTL_SECONDS,
  DISCOVERY_FALLBACK_PRICE,
} from './constants';

// ============================================================================
// Types for Arc Marketplace Discovery
// ============================================================================

export interface DiscoveredTool {
  id: string;
  name: string;
  description: string;
  category: 'WEB_SEARCH_RESEARCH' | 'CREATIVE' | 'PREDICTION_MARKETS' | 'FINANCIAL_ANALYSIS';
  provider: string;
  supportsCircleGateway: boolean;
}

// ============================================================================
// In-Memory Cache
// ============================================================================

let cachedPrice: DiscoveryResponse | null = null;
let cachedTools: DiscoveredTool[] | null = null;
let toolsCacheTimestamp = 0;

function isCacheValid(): boolean {
  if (!cachedPrice) return false;
  const age = (Date.now() - cachedPrice.timestamp) / 1000;
  return age < cachedPrice.ttl;
}

function isToolsCacheValid(): boolean {
  if (!cachedTools) return false;
  const age = (Date.now() - toolsCacheTimestamp) / 1000;
  return age < DISCOVERY_TTL_SECONDS;
}

// ============================================================================
// Fetch USYC Price from Circle API
// ============================================================================

export async function getUSYCPrice(): Promise<DiscoveryResponse> {
  // Return cached if valid
  if (isCacheValid()) {
    return cachedPrice!;
  }

  // Try Circle API (commented out as we don't have real endpoint yet)
  try {
    // Fallback immediately for now
    throw new Error('Using fallback');
  } catch (error) {
    console.log('[Discovery] Using fallback USYC price');

    cachedPrice = {
      usycPrice: DISCOVERY_FALLBACK_PRICE,
      timestamp: Date.now(),
      source: 'fallback',
      ttl: DISCOVERY_TTL_SECONDS,
    };

    return cachedPrice;
  }
}

// ============================================================================
// Fetch Arc Marketplace Tools from Circle Discovery API
// ============================================================================

export async function getArcMarketplaceTools(): Promise<DiscoveredTool[]> {
  // Return cached if valid
  if (isToolsCacheValid()) {
    return cachedTools!;
  }

  // Try Circle Discovery API
  try {
    const response = await fetch(
      'https://api.circle.com/v2/x402/discovery/resources?supportsCircleGateway=true&limit=20',
      {
        headers: {
          'Content-Type': 'application/json',
        },
        next: { revalidate: DISCOVERY_TTL_SECONDS },
      }
    );

    if (!response.ok) {
      throw new Error(`Circle Discovery API returned ${response.status}`);
    }

    const data = await response.json();
    
    // Parse and categorize tools
    const tools: DiscoveredTool[] = (data?.resources || []).map((resource: any) => ({
      id: resource.id || `tool_${Math.random().toString(36).slice(2)}`,
      name: resource.name || 'Unknown Tool',
      description: resource.description || '',
      category: categorizeToolString(resource.name, resource.description),
      provider: resource.provider || 'Unknown',
      supportsCircleGateway: resource.supportsCircleGateway || false,
    }));

    cachedTools = tools;
    toolsCacheTimestamp = Date.now();

    return tools;
  } catch (error) {
    console.error('[Discovery] Circle API failed, using fallback:', error);

    // Return hardcoded fallback tools
    cachedTools = getFallbackTools();
    toolsCacheTimestamp = Date.now();

    return cachedTools;
  }
}

// ============================================================================
// Categorization Logic
// ============================================================================

function categorizeToolString(name: string, description: string): DiscoveredTool['category'] {
  const text = `${name} ${description}`.toLowerCase();
  
  if (text.includes('search') || text.includes('web') || text.includes('research')) {
    return 'WEB_SEARCH_RESEARCH';
  }
  if (text.includes('creative') || text.includes('art') || text.includes('design') || text.includes('image')) {
    return 'CREATIVE';
  }
  if (text.includes('prediction') || text.includes('market') || text.includes('bet')) {
    return 'PREDICTION_MARKETS';
  }
  if (text.includes('financial') || text.includes('trading') || text.includes('portfolio')) {
    return 'FINANCIAL_ANALYSIS';
  }
  
  return 'WEB_SEARCH_RESEARCH';
}

// ============================================================================
// Fallback Tools (for offline/demo mode)
// ============================================================================

function getFallbackTools(): DiscoveredTool[] {
  return [
    {
      id: 'perplexity_search',
      name: 'Perplexity Search',
      description: 'Real-time web search with AI summarization',
      category: 'WEB_SEARCH_RESEARCH',
      provider: 'Perplexity AI',
      supportsCircleGateway: true,
    },
    {
      id: 'tavily_research',
      name: 'Tavily Research',
      description: 'Deep research tool for comprehensive analysis',
      category: 'WEB_SEARCH_RESEARCH',
      provider: 'Tavily',
      supportsCircleGateway: true,
    },
    {
      id: 'polymarket_api',
      name: 'Polymarket Predictions',
      description: 'Access prediction market data and probabilities',
      category: 'PREDICTION_MARKETS',
      provider: 'Polymarket',
      supportsCircleGateway: true,
    },
    {
      id: 'midjourney_api',
      name: 'Midjourney Image Generation',
      description: 'AI-powered creative image generation',
      category: 'CREATIVE',
      provider: 'Midjourney',
      supportsCircleGateway: true,
    },
    {
      id: 'defillama_api',
      name: 'DeFi Llama Analytics',
      description: 'DeFi protocol analytics and TVL data',
      category: 'FINANCIAL_ANALYSIS',
      provider: 'DeFi Llama',
      supportsCircleGateway: true,
    },
  ];
}

// ============================================================================
// Debug Utilities
// ============================================================================

export function clearCache(): void {
  cachedPrice = null;
  cachedTools = null;
  toolsCacheTimestamp = 0;
}

export function getCachedPrice(): DiscoveryResponse | null {
  return cachedPrice;
}

export function getCachedTools(): DiscoveredTool[] | null {
  return cachedTools;
}
