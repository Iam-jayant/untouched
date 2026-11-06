/**
 * GET /api/events
 * Server-Sent Events stream for real-time notifications
 */

import { NextRequest } from 'next/server';
import { createSSEStream } from '@/lib/sse';

export async function GET(req: NextRequest) {
  // EventSource doesn't support custom headers, so we accept apiKey as query param
  const apiKey = req.nextUrl.searchParams.get('apiKey') || 
                 req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    return new Response('Unauthorized', { status: 401 });
  }

  return createSSEStream(apiKey);
}
