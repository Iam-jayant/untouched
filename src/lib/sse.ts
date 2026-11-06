/**
 * SSE Manager (G1: globalThis singleton)
 * Server-Sent Events for real-time updates to clients
 */

import type { SSEManager, SSEConnection, SSEEvent } from './types';
import { SSE_HEARTBEAT_INTERVAL_MS } from './constants';

// ============================================================================
// G1: GlobalThis Singleton
// ============================================================================

function initSSE(): SSEManager {
  const connections = new Map<string, Set<SSEConnection>>();
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const manager: SSEManager = {
    connections,

    broadcast: (apiKey: string, event: SSEEvent) => {
      const conns = connections.get(apiKey);
      if (!conns) return;

      const eventData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;

      conns.forEach((conn) => {
        try {
          conn.controller.enqueue(new TextEncoder().encode(eventData));
        } catch (err) {
          console.error(`[SSE] Failed to send to ${conn.id}:`, err);
          conns.delete(conn);
        }
      });
    },

    addConnection: (apiKey: string, conn: SSEConnection) => {
      if (!connections.has(apiKey)) {
        connections.set(apiKey, new Set());
      }
      connections.get(apiKey)!.add(conn);
      console.log(`[SSE] Connection ${conn.id} added for ${apiKey}`);
    },

    removeConnection: (apiKey: string, conn: SSEConnection) => {
      const conns = connections.get(apiKey);
      if (conns) {
        conns.delete(conn);
        if (conns.size === 0) {
          connections.delete(apiKey);
        }
      }
      console.log(`[SSE] Connection ${conn.id} removed for ${apiKey}`);
    },
  };

  // Start heartbeat every 10 seconds (reduced from 30s for Vercel)
  heartbeatInterval = setInterval(() => {
    const event: SSEEvent = { type: 'heartbeat', data: { timestamp: Date.now() } };
    connections.forEach((conns, apiKey) => {
      manager.broadcast(apiKey, event);
    });
  }, 10000); // 10 seconds

  return manager;
}

export function getSSE(): SSEManager {
  if (!globalThis.__untouchedSSE) {
    globalThis.__untouchedSSE = initSSE();
  }
  return globalThis.__untouchedSSE;
}

// ============================================================================
// SSE Route Helper
// ============================================================================

/**
 * Create SSE response stream for API route
 * Usage:
 *   export async function GET(req: Request) {
 *     const apiKey = req.headers.get('authorization')?.replace('Bearer ', '');
 *     if (!apiKey) return new Response('Unauthorized', { status: 401 });
 *     return createSSEStream(apiKey);
 *   }
 */
export function createSSEStream(apiKey: string): Response {
  const sse = getSSE();
  const connectionId = `${apiKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const stream = new ReadableStream({
    start(controller) {
      const conn: SSEConnection = {
        id: connectionId,
        controller,
        send: (event: SSEEvent) => {
          const eventData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          try {
            controller.enqueue(new TextEncoder().encode(eventData));
          } catch (err) {
            console.error(`[SSE] Failed to send:`, err);
          }
        },
      };

      sse.addConnection(apiKey, conn);

      // IMMEDIATE heartbeat at t=0ms (Vercel serverless fix)
      conn.send({ type: 'heartbeat', data: { timestamp: Date.now() } });
    },

    cancel() {
      const conns = sse.connections.get(apiKey);
      if (conns) {
        const conn = Array.from(conns).find((c) => c.id === connectionId);
        if (conn) {
          sse.removeConnection(apiKey, conn);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

// ============================================================================
// Broadcast Helpers
// ============================================================================

import { getAllKeysForUser } from './agent-store';

/**
 * Broadcast to ALL connections for a user (wallet + all API keys).
 * This ensures events reach the client regardless of which key they used to connect SSE.
 */
export function broadcastToUser(walletAddress: string, event: SSEEvent): void {
  const sse = getSSE();
  const allKeys = getAllKeysForUser(walletAddress);
  for (const key of allKeys) {
    sse.broadcast(key, event);
  }
}

/**
 * Broadcast a full deposit_confirmed event with all user state fields.
 * The frontend updates principal, battery, remaining, and advance in one shot.
 */
export function broadcastDepositConfirmed(
  walletAddress: string,
  state: { principal: number; battery: number; remaining: number; advance: number }
): void {
  broadcastToUser(walletAddress, {
    type: 'deposit_confirmed',
    data: state,
  });
}

export function broadcastReceipt(apiKey: string, receipt: any): void {
  const sse = getSSE();
  sse.broadcast(apiKey, { type: 'receipt', data: receipt });
}

export function broadcastBalanceUpdate(apiKey: string, remaining: number): void {
  const sse = getSSE();
  sse.broadcast(apiKey, { type: 'balance_update', data: { remaining } });
}

export function broadcastPendingApproval(apiKey: string, approval: any): void {
  const sse = getSSE();
  sse.broadcast(apiKey, { type: 'pending_approval', data: approval });
}

export function broadcastStepUpApproved(apiKey: string, approvalId: string): void {
  const sse = getSSE();
  sse.broadcast(apiKey, { type: 'step_up_approved', data: { approvalId } });
}

export function broadcastStepUpDenied(apiKey: string, approvalId: string): void {
  const sse = getSSE();
  sse.broadcast(apiKey, { type: 'step_up_denied', data: { approvalId } });
}
