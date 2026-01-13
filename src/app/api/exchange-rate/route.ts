import { NextRequest, NextResponse } from 'next/server';

// Cache the exchange rate for 1 hour
let cachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Fallback rate in case API fails
const FALLBACK_RATE = 18.5;

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    
    // Return cached rate if still valid
    if (cachedRate && (now - cachedRate.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        data: {
          rate: cachedRate.rate,
          from: 'USD',
          to: 'ZAR',
          cached: true,
          cachedAt: new Date(cachedRate.timestamp).toISOString(),
        },
      });
    }

    // Fetch fresh exchange rate from a free API
    // Using exchangerate-api.com free tier
    const response = await fetch(
      'https://api.exchangerate-api.com/v4/latest/USD',
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rate');
    }

    const data = await response.json();
    const zarRate = data.rates?.ZAR;

    if (!zarRate) {
      throw new Error('ZAR rate not found in response');
    }

    // Cache the rate
    cachedRate = {
      rate: zarRate,
      timestamp: now,
    };

    return NextResponse.json({
      success: true,
      data: {
        rate: zarRate,
        from: 'USD',
        to: 'ZAR',
        cached: false,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Exchange rate fetch error:', error);
    
    // Return cached rate if available, even if expired
    if (cachedRate) {
      return NextResponse.json({
        success: true,
        data: {
          rate: cachedRate.rate,
          from: 'USD',
          to: 'ZAR',
          cached: true,
          stale: true,
          cachedAt: new Date(cachedRate.timestamp).toISOString(),
        },
      });
    }

    // Return fallback rate
    return NextResponse.json({
      success: true,
      data: {
        rate: FALLBACK_RATE,
        from: 'USD',
        to: 'ZAR',
        fallback: true,
        message: 'Using fallback rate due to API error',
      },
    });
  }
}

