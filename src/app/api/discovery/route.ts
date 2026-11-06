/**
 * GET /api/discovery
 * Returns USYC price and Arc Marketplace tools (with cache + fallback)
 */

import { NextResponse } from 'next/server';
import { getUSYCPrice, getArcMarketplaceTools } from '@/lib/discovery';

export async function GET() {
  try {
    const [priceData, tools] = await Promise.all([
      getUSYCPrice(),
      getArcMarketplaceTools(),
    ]);

    return NextResponse.json({
      usycPrice: priceData,
      tools,
    });
  } catch (error) {
    console.error('[API] /discovery error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discovery data' },
      { status: 500 }
    );
  }
}
