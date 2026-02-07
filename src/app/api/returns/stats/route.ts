import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = createServerClient();

    const [totalRes, pendingRes] = await Promise.all([
      supabase.from('return_requests').select('id', { count: 'exact', head: true }),
      supabase.from('return_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    return NextResponse.json({
      totalReturns: totalRes.count ?? 0,
      pendingReturns: pendingRes.count ?? 0,
    });
  } catch (err) {
    console.error('Returns stats error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error', totalReturns: 0, pendingReturns: 0 },
      { status: 500 }
    );
  }
}
